import { Router } from "express";
import { z } from "zod";

import { requireAuth } from "../auth/middleware.js";
import { ACTIVE_CASE_ID } from "../config/dataset.js";
import { prisma } from "../db/prisma.js";
import { buildResultsCsv, parseMarksCsv, type CsvRow } from "./csv.js";
import { ApiError } from "./errors.js";

const router = Router();
router.use(requireAuth);

async function loadActiveSession() {
  const session = await prisma.examSession.findUnique({
    where: { caseId: ACTIVE_CASE_ID },
    include: { subjects: { orderBy: { displayOrder: "asc" } } },
  });
  if (!session) {
    throw new ApiError(500, "NO_ACTIVE_DATASET", `No session seeded for caseId ${ACTIVE_CASE_ID}`);
  }
  return session;
}

async function nextRollNo(sessionId: string): Promise<string> {
  const students = await prisma.student.findMany({ where: { sessionId }, select: { rollNo: true } });
  const maxN = students.reduce((max, s) => {
    const n = Number.parseInt(/\d+/.exec(s.rollNo)?.[0] ?? "0", 10);
    return Number.isNaN(n) ? max : Math.max(max, n);
  }, 0);
  return `S${String(maxN + 1).padStart(3, "0")}`;
}

const markInputSchema = z
  .object({
    code: z.string().min(1),
    theory: z.number().int().nullable().optional(),
    practical: z.number().int().nullable().optional(),
    absent: z.boolean().optional(),
  })
  .refine((m) => m.absent || m.theory !== undefined || m.practical !== undefined, {
    message: "either absent:true, or at least one of theory/practical, is required",
  });

const studentInputSchema = z.object({
  name: z.string().min(1),
  className: z.string().min(1),
  optionalCode: z.string().min(1),
  marks: z.array(markInputSchema).min(1),
});

/**
 * Validates one subject's marks against the field-rules table (theory
 * 0-75/practical 0-25 when the subject has a practical part, 0-100 for a
 * whole-paper mark, absent implies no scores) and returns the row Prisma
 * needs. Throws a 422 ApiError naming the offending field on any violation -
 * "the frontend does not sanitise marks" per CLAUDE.md, so the backend must.
 */
function validateMark(
  mark: z.infer<typeof markInputSchema>,
  subject: { code: string; hasPractical: boolean },
): { isAbsent: boolean; wholeScore: number | null; theoryScore: number | null; practicalScore: number | null } {
  if (mark.absent) {
    return { isAbsent: true, wholeScore: null, theoryScore: null, practicalScore: null };
  }
  if (subject.hasPractical) {
    if (mark.theory == null || mark.practical == null) {
      throw new ApiError(422, "INVALID_MARK", `${subject.code}: theory and practical are both required`);
    }
    if (mark.theory < 0 || mark.theory > 75) {
      throw new ApiError(422, "INVALID_MARK", `theory must be 0-75 for ${subject.code}`);
    }
    if (mark.practical < 0 || mark.practical > 25) {
      throw new ApiError(422, "INVALID_MARK", `practical must be 0-25 for ${subject.code}`);
    }
    return { isAbsent: false, wholeScore: null, theoryScore: mark.theory, practicalScore: mark.practical };
  }
  if (mark.theory == null) {
    throw new ApiError(422, "INVALID_MARK", `${subject.code}: a mark is required`);
  }
  if (mark.theory < 0 || mark.theory > 100) {
    throw new ApiError(422, "INVALID_MARK", `mark must be 0-100 for ${subject.code}`);
  }
  return { isAbsent: false, wholeScore: mark.theory, theoryScore: null, practicalScore: null };
}

router.post("/students", async (req, res) => {
  const parsed = studentInputSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(422, "INVALID_BODY", parsed.error.issues[0]?.message ?? "invalid body");
  }
  const session = await loadActiveSession();
  const subjectByCode = new Map(session.subjects.map((s) => [s.code, s]));
  const compulsory = session.subjects.filter((s) => s.isCompulsory);

  const optionalSubject = subjectByCode.get(parsed.data.optionalCode);
  if (!optionalSubject) {
    throw new ApiError(422, "INVALID_MARK", `unknown optional subject "${parsed.data.optionalCode}"`, );
  }
  if (optionalSubject.isCompulsory) {
    throw new ApiError(422, "INVALID_MARK", `"${parsed.data.optionalCode}" is compulsory, not a valid optional pick`);
  }

  const expectedCodes = [...compulsory.map((s) => s.code), parsed.data.optionalCode];
  const providedCodes = parsed.data.marks.map((m) => m.code);
  const missing = expectedCodes.filter((c) => !providedCodes.includes(c));
  if (missing.length > 0) {
    throw new ApiError(422, "INVALID_BODY", `missing marks for: ${missing.join(", ")}`);
  }

  const validatedMarks = parsed.data.marks
    .filter((m) => expectedCodes.includes(m.code))
    .map((m) => ({ code: m.code, ...validateMark(m, subjectByCode.get(m.code)!) }));

  const rollNo = await nextRollNo(session.id);
  const student = await prisma.student.create({
    data: {
      sessionId: session.id,
      rollNo,
      name: parsed.data.name,
      className: parsed.data.className,
      optionalSubjectId: optionalSubject.id,
      marks: {
        create: validatedMarks.map((m) => ({
          subjectId: subjectByCode.get(m.code)!.id,
          isAbsent: m.isAbsent,
          wholeScore: m.wholeScore,
          theoryScore: m.theoryScore,
          practicalScore: m.practicalScore,
        })),
      },
    },
    include: { marks: { include: { subject: true } }, optionalSubject: true },
  });

  res.status(201).json({
    id: student.id,
    roll: Number.parseInt(/\d+/.exec(student.rollNo)?.[0] ?? "0", 10),
    name: student.name,
    className: student.className,
    optionalCode: student.optionalSubject.code,
  });
});

router.put("/students/:id", async (req, res) => {
  const parsed = studentInputSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(422, "INVALID_BODY", parsed.error.issues[0]?.message ?? "invalid body");
  }
  const session = await loadActiveSession();
  const existing = await prisma.student.findFirst({ where: { id: req.params.id, sessionId: session.id } });
  if (!existing) {
    throw new ApiError(404, "NOT_FOUND", "student not found");
  }

  const subjectByCode = new Map(session.subjects.map((s) => [s.code, s]));
  const compulsory = session.subjects.filter((s) => s.isCompulsory);
  const optionalSubject = subjectByCode.get(parsed.data.optionalCode);
  if (!optionalSubject) {
    throw new ApiError(422, "INVALID_MARK", `unknown optional subject "${parsed.data.optionalCode}"`);
  }
  if (optionalSubject.isCompulsory) {
    throw new ApiError(422, "INVALID_MARK", `"${parsed.data.optionalCode}" is compulsory, not a valid optional pick`);
  }

  const expectedCodes = [...compulsory.map((s) => s.code), parsed.data.optionalCode];
  const providedCodes = parsed.data.marks.map((m) => m.code);
  const missing = expectedCodes.filter((c) => !providedCodes.includes(c));
  if (missing.length > 0) {
    throw new ApiError(422, "INVALID_BODY", `missing marks for: ${missing.join(", ")}`);
  }
  const validatedMarks = parsed.data.marks
    .filter((m) => expectedCodes.includes(m.code))
    .map((m) => ({ code: m.code, ...validateMark(m, subjectByCode.get(m.code)!) }));

  await prisma.$transaction([
    prisma.studentMark.deleteMany({ where: { studentId: existing.id } }),
    prisma.student.update({
      where: { id: existing.id },
      data: {
        name: parsed.data.name,
        className: parsed.data.className,
        optionalSubjectId: optionalSubject.id,
        marks: {
          create: validatedMarks.map((m) => ({
            subjectId: subjectByCode.get(m.code)!.id,
            isAbsent: m.isAbsent,
            wholeScore: m.wholeScore,
            theoryScore: m.theoryScore,
            practicalScore: m.practicalScore,
          })),
        },
      },
    }),
  ]);

  res.json({ id: existing.id, name: parsed.data.name, className: parsed.data.className, optionalCode: parsed.data.optionalCode });
});

const patchMarkSchema = z.union([
  z.object({ absent: z.literal(true) }),
  z.object({ theory: z.number().int(), practical: z.number().int().optional() }),
]);

router.patch("/students/:id/marks/:subjectCode", async (req, res) => {
  const parsed = patchMarkSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(422, "INVALID_BODY", "body must be { absent: true } or { theory, practical? }");
  }
  const session = await loadActiveSession();
  const student = await prisma.student.findFirst({ where: { id: req.params.id, sessionId: session.id } });
  if (!student) throw new ApiError(404, "NOT_FOUND", "student not found");

  const subject = session.subjects.find((s) => s.code === req.params.subjectCode);
  if (!subject) throw new ApiError(422, "INVALID_MARK", `unknown subject "${req.params.subjectCode}"`);

  const mark: z.infer<typeof markInputSchema> =
    "absent" in parsed.data
      ? { code: subject.code, absent: true }
      : { code: subject.code, theory: parsed.data.theory, practical: parsed.data.practical ?? null };
  const validated = validateMark(mark, subject);

  await prisma.studentMark.upsert({
    where: { studentId_subjectId: { studentId: student.id, subjectId: subject.id } },
    create: { studentId: student.id, subjectId: subject.id, ...validated },
    update: validated,
  });

  res.json({ studentId: student.id, subjectCode: subject.code, ...validated });
});

router.get("/export/results.csv", async (_req, res) => {
  const session = await loadActiveSession();
  const students = await prisma.student.findMany({
    where: { sessionId: session.id },
    orderBy: { rollNo: "asc" },
    include: { optionalSubject: true, marks: { include: { subject: true } } },
  });

  const rows: CsvRow[] = students.map((s) => {
    const marks: CsvRow["marks"] = {};
    for (const m of s.marks) {
      marks[m.subject.code] = m.isAbsent
        ? { absent: true }
        : m.subject.hasPractical
          ? { theory: m.theoryScore ?? undefined, practical: m.practicalScore ?? undefined }
          : { whole: m.wholeScore ?? undefined };
    }
    return { roll: s.rollNo, name: s.name, className: s.className, optionalCode: s.optionalSubject.code, marks };
  });

  const csv = buildResultsCsv(session.subjects, rows);
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${session.caseId}-results.csv"`);
  res.send(csv);
});

router.post("/import", async (req, res) => {
  const csvText: unknown = req.body;
  if (typeof csvText !== "string" || csvText.length === 0) {
    throw new ApiError(422, "INVALID_BODY", "request body must be raw CSV text (Content-Type: text/csv)");
  }

  const session = await loadActiveSession();
  const compulsoryCodes = session.subjects.filter((s) => s.isCompulsory).map((s) => s.code);
  const { rows, errors } = parseMarksCsv(csvText, session.subjects, compulsoryCodes);

  const subjectByCode = new Map(session.subjects.map((s) => [s.code, s]));
  // subjectCode is only a lookup key for resolving subjectId - Prisma's
  // StudentMark has no such column, so it must not be spread into create data.
  const toMarkCreateInput = (m: (typeof rows)[number]["marks"][number]) => ({
    subjectId: subjectByCode.get(m.subjectCode)!.id,
    isAbsent: m.isAbsent,
    wholeScore: m.wholeScore,
    theoryScore: m.theoryScore,
    practicalScore: m.practicalScore,
  });

  // Batched, not per-row: a per-row findFirst + transaction was ~3 sequential
  // round trips to a remote Postgres for every row (240+ for an 80-student
  // CSV). One fetch, then bulk writes.
  const existingStudents = await prisma.student.findMany({
    where: { sessionId: session.id },
    select: { id: true, rollNo: true },
  });
  const existingByRoll = new Map(existingStudents.map((s) => [s.rollNo, s.id]));

  const toUpdate = rows.filter((r) => existingByRoll.has(r.roll));
  const toCreate = rows.filter((r) => !existingByRoll.has(r.roll));

  if (toUpdate.length > 0) {
    const updateIds = toUpdate.map((r) => existingByRoll.get(r.roll)!);
    await prisma.studentMark.deleteMany({ where: { studentId: { in: updateIds } } });
    // Field values differ per row, so the student record itself still needs
    // one update() each - but that's now the only per-row round trip left,
    // and it can run concurrently since each touches a different row.
    await Promise.all(
      toUpdate.map((row) =>
        prisma.student.update({
          where: { id: existingByRoll.get(row.roll)! },
          data: { name: row.name, className: row.className, optionalSubjectId: subjectByCode.get(row.optionalCode)!.id },
        }),
      ),
    );
    await prisma.studentMark.createMany({
      data: toUpdate.flatMap((row) =>
        row.marks.map((m) => ({ studentId: existingByRoll.get(row.roll)!, ...toMarkCreateInput(m) })),
      ),
    });
  }

  if (toCreate.length > 0) {
    await prisma.student.createMany({
      data: toCreate.map((row) => ({
        sessionId: session.id,
        rollNo: row.roll,
        name: row.name,
        className: row.className,
        optionalSubjectId: subjectByCode.get(row.optionalCode)!.id,
      })),
    });
    const created = await prisma.student.findMany({
      where: { sessionId: session.id, rollNo: { in: toCreate.map((r) => r.roll) } },
      select: { id: true, rollNo: true },
    });
    const createdByRoll = new Map(created.map((s) => [s.rollNo, s.id]));
    await prisma.studentMark.createMany({
      data: toCreate.flatMap((row) =>
        row.marks.map((m) => ({ studentId: createdByRoll.get(row.roll)!, ...toMarkCreateInput(m) })),
      ),
    });
  }

  res.json({ imported: rows.length, rejected: errors, totalRows: rows.length + errors.length });
});

export default router;
