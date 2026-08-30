import { toClassId } from "../config/dataset.js";
import type { PrismaMarkLike, PrismaStudentLike, PrismaSubjectLike } from "../grading/fromPrisma.js";

/** The `Dataset` shape documented in the repo-root CLAUDE.md, produced verbatim. */
export interface DatasetMark {
  code: string;
  theory: number | null;
  practical: number | null;
  absent?: true;
}

export interface DatasetStudent {
  id: string;
  roll: number;
  name: string;
  classId: string;
  optionalCode: string;
  marks: DatasetMark[];
}

export interface DatasetClass {
  id: string;
  name: string;
  session: string;
}

export interface DatasetSubject {
  code: string;
  name: string;
  hasPractical: boolean;
  kind: "compulsory" | "optional";
}

export interface Dataset {
  meta: {
    school: string;
    exam: string;
    session: string;
    generatedAt: string;
  };
  classes: DatasetClass[];
  subjects: DatasetSubject[];
  students: DatasetStudent[];
}

const SCHOOL_NAME = "Shaheed Smrity Higher Secondary School";
const EXAM_NAME = "Annual Examination";
const ACADEMIC_SESSION = "2025-2026";

/** Extracts the trailing digits of a roll id, e.g. "S032" -> 32. */
function rollNumber(rollNo: string): number {
  const match = /\d+/.exec(rollNo);
  return match ? Number.parseInt(match[0], 10) : 0;
}

function toDatasetMark(mark: PrismaMarkLike): DatasetMark {
  if (mark.isAbsent) {
    return { code: mark.subject.code, theory: null, practical: null, absent: true };
  }
  return {
    code: mark.subject.code,
    theory: mark.wholeScore ?? mark.theoryScore,
    practical: mark.practicalScore,
  };
}

function toDatasetStudent(student: PrismaStudentLike & { id: string }): DatasetStudent {
  return {
    id: student.id,
    roll: rollNumber(student.rollNo),
    name: student.name,
    classId: toClassId(student.className),
    optionalCode: student.optionalSubject.code,
    marks: student.marks.map(toDatasetMark),
  };
}

/**
 * Builds the Dataset the frontend fetches from GET /api/v1/results.
 *
 * `scope` implements the field the office/teacher accounts carry: "*" sees
 * every class, anything else keeps only students (and the one class) whose
 * classId matches. The frontend never enforces this itself — CLAUDE.md is
 * explicit that filtering by scope is the backend's job.
 */
export function buildDataset(
  subjects: PrismaSubjectLike[],
  students: Array<PrismaStudentLike & { id: string; className: string }>,
  scope: string,
): Dataset {
  const inScope = scope === "*" ? students : students.filter((s) => toClassId(s.className) === scope);

  const classNames = new Map<string, string>();
  for (const student of inScope) {
    classNames.set(toClassId(student.className), student.className);
  }

  return {
    meta: {
      school: SCHOOL_NAME,
      exam: EXAM_NAME,
      session: ACADEMIC_SESSION,
      generatedAt: new Date().toISOString(),
    },
    classes: [...classNames.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([id, name]) => ({ id, name, session: ACADEMIC_SESSION })),
    subjects: subjects
      .slice()
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map((s) => ({
        code: s.code,
        name: s.name,
        hasPractical: s.hasPractical,
        kind: s.isCompulsory ? "compulsory" : "optional",
      })),
    students: inScope.map(toDatasetStudent).sort((a, b) => a.roll - b.roll),
  };
}
