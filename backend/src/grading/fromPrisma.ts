import type { NormalizedStudent, NormalizedSubject } from "../db/normalize.js";

/**
 * Structural (not Prisma-generated) input types for the adapters below, so
 * they stay testable with plain objects and don't couple the grading engine
 * to a specific Prisma `include` shape.
 */
export interface PrismaSubjectLike {
  code: string;
  name: string;
  hasPractical: boolean;
  isCompulsory: boolean;
  displayOrder: number;
}

export interface PrismaMarkLike {
  isAbsent: boolean;
  wholeScore: number | null;
  theoryScore: number | null;
  practicalScore: number | null;
  subject: { code: string };
}

export interface PrismaStudentLike {
  rollNo: string;
  name: string;
  className: string;
  optionalSubject: { code: string };
  marks: PrismaMarkLike[];
}

export function toNormalizedSubject(subject: PrismaSubjectLike): NormalizedSubject {
  return {
    code: subject.code,
    name: subject.name,
    hasPractical: subject.hasPractical,
    isCompulsory: subject.isCompulsory,
    displayOrder: subject.displayOrder,
  };
}

export function toNormalizedStudent(student: PrismaStudentLike): NormalizedStudent {
  return {
    rollNo: student.rollNo,
    name: student.name,
    className: student.className,
    optionalSubjectCode: student.optionalSubject.code,
    marks: student.marks.map((mark) => ({
      subjectCode: mark.subject.code,
      isAbsent: mark.isAbsent,
      wholeScore: mark.wholeScore,
      theoryScore: mark.theoryScore,
      practicalScore: mark.practicalScore,
    })),
  };
}
