import type { NormalizedCase } from "./normalize.js";

/**
 * Builds the flat row sets the seed inserts.
 *
 * Kept free of Prisma so the id-resolution logic — the part most likely to go
 * wrong — can be tested without a database.
 */

export interface SubjectRow {
  sessionId: string;
  code: string;
  name: string;
  hasPractical: boolean;
  isCompulsory: boolean;
  displayOrder: number;
}

export interface StudentRow {
  sessionId: string;
  rollNo: string;
  name: string;
  className: string;
  optionalSubjectId: string;
}

export interface MarkRow {
  studentId: string;
  subjectId: string;
  isAbsent: boolean;
  wholeScore: number | null;
  theoryScore: number | null;
  practicalScore: number | null;
}

export class SeedMappingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SeedMappingError";
  }
}

export function buildSubjectRows(
  sessionId: string,
  normalized: NormalizedCase,
): SubjectRow[] {
  return normalized.subjects.map((subject) => ({
    sessionId,
    code: subject.code,
    name: subject.name,
    hasPractical: subject.hasPractical,
    isCompulsory: subject.isCompulsory,
    displayOrder: subject.displayOrder,
  }));
}

export function buildStudentRows(
  sessionId: string,
  normalized: NormalizedCase,
  subjectIdByCode: ReadonlyMap<string, string>,
): StudentRow[] {
  return normalized.students.map((student) => {
    const optionalSubjectId = subjectIdByCode.get(student.optionalSubjectCode);
    if (!optionalSubjectId) {
      throw new SeedMappingError(
        `${normalized.caseId}/${student.rollNo}: optional subject "${student.optionalSubjectCode}" has no persisted id`,
      );
    }
    return {
      sessionId,
      rollNo: student.rollNo,
      name: student.name,
      className: student.className,
      optionalSubjectId,
    };
  });
}

export function buildMarkRows(
  normalized: NormalizedCase,
  subjectIdByCode: ReadonlyMap<string, string>,
  studentIdByRollNo: ReadonlyMap<string, string>,
): MarkRow[] {
  return normalized.students.flatMap((student) => {
    const studentId = studentIdByRollNo.get(student.rollNo);
    if (!studentId) {
      throw new SeedMappingError(
        `${normalized.caseId}/${student.rollNo}: student has no persisted id`,
      );
    }
    return student.marks.map((mark) => {
      const subjectId = subjectIdByCode.get(mark.subjectCode);
      if (!subjectId) {
        throw new SeedMappingError(
          `${normalized.caseId}/${student.rollNo}: subject "${mark.subjectCode}" has no persisted id`,
        );
      }
      return {
        studentId,
        subjectId,
        isAbsent: mark.isAbsent,
        wholeScore: mark.wholeScore,
        theoryScore: mark.theoryScore,
        practicalScore: mark.practicalScore,
      };
    });
  });
}
