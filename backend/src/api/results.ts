import { Router } from "express";

import { requireAuth } from "../auth/middleware.js";
import { ACTIVE_CASE_ID, toClassId } from "../config/dataset.js";
import { prisma } from "../db/prisma.js";
import { computeCheckingLists } from "../grading/checkingLists.js";
import { computeStudentResult, type StudentResult } from "../grading/engine.js";
import { toNormalizedStudent, toNormalizedSubject } from "../grading/fromPrisma.js";
import { buildDataset } from "./datasetSerializer.js";
import { ApiError } from "./errors.js";

const router = Router();
router.use(requireAuth);

async function loadActiveSession() {
  const session = await prisma.examSession.findUnique({
    where: { caseId: ACTIVE_CASE_ID },
    include: { subjects: { orderBy: { displayOrder: "asc" } } },
  });
  if (!session) {
    // A missing seed, not a client error - the active dataset must exist.
    throw new ApiError(500, "NO_ACTIVE_DATASET", `No session seeded for caseId ${ACTIVE_CASE_ID}`);
  }
  const students = await prisma.student.findMany({
    where: { sessionId: session.id },
    orderBy: { rollNo: "asc" },
    include: { optionalSubject: true, marks: { include: { subject: true } } },
  });
  return { session, students };
}

/** Computes every in-scope student's result, for the two grading-based bonus routes. */
async function computeScopedResults(scope: string): Promise<StudentResult[]> {
  const { session, students } = await loadActiveSession();
  const normalizedSubjects = session.subjects.map(toNormalizedSubject);
  const inScope =
    scope === "*" ? students : students.filter((s) => toClassId(s.className) === scope);

  return inScope.map((student) => computeStudentResult(toNormalizedStudent(student), normalizedSubjects));
}

/** Required by CLAUDE.md: the whole cohort, scoped to the caller's `scope`. */
router.get("/results", async (req, res) => {
  const { session, students } = await loadActiveSession();
  const dataset = buildDataset(session.subjects, students, req.teacher!.scope);
  res.json(dataset);
});

/**
 * Optional (CLAUDE.md: "only if server-side grading is needed"). Reuses the
 * same grading engine the earlier phases built and golden-tested — the
 * frontend does not call this today, but it's a straight readout of the
 * same rules `frontend/src/engine/rules.ts` implements independently.
 */
router.get("/results/computed", async (req, res) => {
  res.json(await computeScopedResults(req.teacher!.scope));
});

router.get("/checklists", async (req, res) => {
  res.json(computeCheckingLists(await computeScopedResults(req.teacher!.scope)));
});

export default router;
