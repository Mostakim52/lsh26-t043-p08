import type {
  NormalizedMark,
  NormalizedStudent,
  NormalizedSubject,
} from "../db/normalize.js";
import {
  GPA_CAP,
  OPTIONAL_BONUS_FLOOR,
  PRACTICAL_PASS_MARK,
  THEORY_PASS_MARK,
  letterFromGpa,
  round2,
  scoreToGradePoint,
} from "./bands.js";

/**
 * The per-subject grading trace: what mark was used, what grade point it
 * produced, and the rule that decided it. Numeric score fields are kept
 * alongside the display string so checking-list logic never has to re-parse
 * `markUsed`.
 */
export interface SubjectGradeResult {
  subjectCode: string;
  subjectName: string;
  isCompulsory: boolean;
  hasPractical: boolean;
  isAbsent: boolean;
  wholeScore: number | null;
  theoryScore: number | null;
  practicalScore: number | null;
  markUsed: string;
  gradePoint: number;
  rule: string;
}

function gradeSubject(
  subject: NormalizedSubject,
  mark: NormalizedMark,
): SubjectGradeResult {
  const base = {
    subjectCode: subject.code,
    subjectName: subject.name,
    isCompulsory: subject.isCompulsory,
    hasPractical: subject.hasPractical,
  };

  if (mark.isAbsent) {
    return {
      ...base,
      isAbsent: true,
      wholeScore: null,
      theoryScore: null,
      practicalScore: null,
      markUsed: "AB",
      gradePoint: 0,
      rule: "absent",
    };
  }

  if (subject.hasPractical) {
    const theory = mark.theoryScore!;
    const practical = mark.practicalScore!;
    const theoryFails = theory < THEORY_PASS_MARK;
    const practicalFails = practical < PRACTICAL_PASS_MARK;

    if (theoryFails || practicalFails) {
      const reasons: string[] = [];
      if (theoryFails) reasons.push(`theory ${theory} < ${THEORY_PASS_MARK}`);
      if (practicalFails)
        reasons.push(`practical ${practical} < ${PRACTICAL_PASS_MARK}`);
      return {
        ...base,
        isAbsent: false,
        wholeScore: null,
        theoryScore: theory,
        practicalScore: practical,
        markUsed: `theory ${theory} + practical ${practical}`,
        gradePoint: 0,
        rule: `failed pass mark (${reasons.join(", ")})`,
      };
    }

    const total = theory + practical;
    const band = scoreToGradePoint(total);
    return {
      ...base,
      isAbsent: false,
      wholeScore: null,
      theoryScore: theory,
      practicalScore: practical,
      markUsed: `theory ${theory} + practical ${practical} = ${total}`,
      gradePoint: band.gradePoint,
      rule: `${band.label} -> ${band.gradePoint}`,
    };
  }

  const whole = mark.wholeScore!;
  const band = scoreToGradePoint(whole);
  return {
    ...base,
    isAbsent: false,
    wholeScore: whole,
    theoryScore: null,
    practicalScore: null,
    markUsed: `${whole}`,
    gradePoint: band.gradePoint,
    rule: `${band.label} -> ${band.gradePoint}`,
  };
}

export interface StudentResult {
  rollNo: string;
  name: string;
  className: string;
  /** Six compulsory subjects, in the session's declared order. */
  compulsoryResults: SubjectGradeResult[];
  optionalResult: SubjectGradeResult;
  /** All seven, compulsory first — the flat trace for display. */
  subjectResults: SubjectGradeResult[];
  /** Compulsory subjects whose grade point is 0. Empty when the student passed. */
  failureSubjectCodes: string[];
  isOverallFail: boolean;
  /**
   * The GPA formula's result before the compulsory-failure override is
   * applied — kept visible in the trace even when the official GPA is
   * zeroed, per the specification's own requirement.
   */
  uncancelledAverage: number;
  officialGpa: number;
  letterGrade: ReturnType<typeof letterFromGpa>;
}

/**
 * Computes one student's full result. `subjects` must contain every subject
 * for the session (compulsory and optional); the student's own optional pick
 * is resolved from `student.optionalSubjectCode`.
 */
export function computeStudentResult(
  student: NormalizedStudent,
  subjects: NormalizedSubject[],
): StudentResult {
  const subjectByCode = new Map(subjects.map((s) => [s.code, s]));
  const markByCode = new Map(student.marks.map((m) => [m.subjectCode, m]));

  const compulsorySubjects = subjects
    .filter((s) => s.isCompulsory)
    .sort((a, b) => a.displayOrder - b.displayOrder);

  const compulsoryResults = compulsorySubjects.map((subject) => {
    const mark = markByCode.get(subject.code);
    if (!mark) {
      throw new Error(
        `${student.rollNo}: missing mark for compulsory subject "${subject.code}"`,
      );
    }
    return gradeSubject(subject, mark);
  });

  const optionalSubject = subjectByCode.get(student.optionalSubjectCode);
  const optionalMark = markByCode.get(student.optionalSubjectCode);
  if (!optionalSubject || !optionalMark) {
    throw new Error(
      `${student.rollNo}: missing optional subject or mark for "${student.optionalSubjectCode}"`,
    );
  }
  const optionalResult = gradeSubject(optionalSubject, optionalMark);

  const failureSubjectCodes = compulsoryResults
    .filter((r) => r.gradePoint === 0)
    .map((r) => r.subjectCode);
  const isOverallFail = failureSubjectCodes.length > 0;

  const compulsorySum = compulsoryResults.reduce(
    (sum, r) => sum + r.gradePoint,
    0,
  );
  const optionalContribution = Math.max(
    0,
    optionalResult.gradePoint - OPTIONAL_BONUS_FLOOR,
  );
  const rawAverage = (compulsorySum + optionalContribution) / 6;
  const uncancelledAverage = round2(Math.min(rawAverage, GPA_CAP));
  const officialGpa = isOverallFail ? 0 : uncancelledAverage;

  return {
    rollNo: student.rollNo,
    name: student.name,
    className: student.className,
    compulsoryResults,
    optionalResult,
    subjectResults: [...compulsoryResults, optionalResult],
    failureSubjectCodes,
    isOverallFail,
    uncancelledAverage,
    officialGpa,
    letterGrade: letterFromGpa(officialGpa),
  };
}
