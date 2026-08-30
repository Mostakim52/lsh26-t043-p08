import { loadFixture } from "./fixture.js";
import { normalizeCase, type NormalizedCase } from "./normalize.js";
import { prisma } from "./prisma.js";
import { buildMarkRows, buildStudentRows, buildSubjectRows } from "./rows.js";

/**
 * Loads the bundled dataset into the database.
 *
 * Re-running is safe: existing sessions are removed first and the cascade
 * clears their subjects, students and marks.
 */

function sessionName(caseId: string, index: number): string {
  return `Annual Examination ${index + 1} (${caseId})`;
}

async function seedCase(
  normalized: NormalizedCase,
  index: number,
): Promise<void> {
  const session = await prisma.examSession.create({
    data: {
      caseId: normalized.caseId,
      name: sessionName(normalized.caseId, index),
    },
  });

  await prisma.subject.createMany({
    data: buildSubjectRows(session.id, normalized),
  });

  const subjects = await prisma.subject.findMany({
    where: { sessionId: session.id },
    select: { id: true, code: true },
  });
  const subjectIdByCode = new Map(subjects.map((s) => [s.code, s.id]));

  await prisma.student.createMany({
    data: buildStudentRows(session.id, normalized, subjectIdByCode),
  });

  const students = await prisma.student.findMany({
    where: { sessionId: session.id },
    select: { id: true, rollNo: true },
  });
  const studentIdByRollNo = new Map(students.map((s) => [s.rollNo, s.id]));

  const markRows = buildMarkRows(normalized, subjectIdByCode, studentIdByRollNo);
  await prisma.studentMark.createMany({ data: markRows });

  console.log(
    `  ${normalized.caseId}: ${normalized.subjects.length} subjects, ` +
      `${normalized.students.length} students, ${markRows.length} marks`,
  );
}

async function main(): Promise<void> {
  const fixture = loadFixture();
  const cases = fixture.cases.map(normalizeCase);

  console.log(`[seed] validated ${cases.length} cases from the dataset`);

  const deleted = await prisma.examSession.deleteMany({});
  if (deleted.count > 0) {
    console.log(`[seed] removed ${deleted.count} existing session(s)`);
  }

  for (const [index, normalized] of cases.entries()) {
    await seedCase(normalized, index);
  }

  console.log("[seed] done");
}

main()
  .catch((error: unknown) => {
    console.error("[seed] failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
