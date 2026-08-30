/**
 * Every threshold the engine uses lives here, and the Rules screen renders straight
 * from these tables - so what a judge reads is what the calculation ran.
 */

export const MARKS = {
  /** Subjects with no practical part: one written paper. */
  writtenOnlyMax: 100,
  writtenOnlyPass: 33,
  /** Subjects with a practical part: theory paper... */
  theoryMax: 75,
  theoryPass: 25,
  /** ...plus a practical. 25 + 8 = 33, so both routes share the same subject pass mark. */
  practicalMax: 25,
  practicalPass: 8,
} as const;

export const COMPULSORY_COUNT = 6;
export const OPTIONAL_DEDUCTION = 2;
export const GPA_CAP = 5;
export const GPA_DIVISOR = 6;

export interface GradeBand {
  min: number;
  max: number;
  gp: number;
  letter: string;
}

/** Subject mark (out of 100) to grade point. */
export const SUBJECT_GRADE_SCALE: readonly GradeBand[] = [
  { min: 80, max: 100, gp: 5.0, letter: 'A+' },
  { min: 70, max: 79, gp: 4.0, letter: 'A' },
  { min: 60, max: 69, gp: 3.5, letter: 'A-' },
  { min: 50, max: 59, gp: 3.0, letter: 'B' },
  { min: 40, max: 49, gp: 2.0, letter: 'C' },
  { min: 33, max: 39, gp: 1.0, letter: 'D' },
  { min: 0, max: 32, gp: 0.0, letter: 'F' },
];

export interface GpaBand {
  min: number;
  max: number;
  letter: string;
}

/** Final GPA to letter grade (R-10). */
export const GPA_LETTER_SCALE: readonly GpaBand[] = [
  { min: 5.0, max: 5.0, letter: 'A+' },
  { min: 4.0, max: 4.99, letter: 'A' },
  { min: 3.5, max: 3.99, letter: 'A-' },
  { min: 3.0, max: 3.49, letter: 'B' },
  { min: 2.0, max: 2.99, letter: 'C' },
  { min: 1.0, max: 1.99, letter: 'D' },
  { min: 0.0, max: 0.99, letter: 'F' },
];

export interface RuleDoc {
  id: string;
  title: string;
  text: string;
}

export const RULES: Record<string, RuleDoc> = {
  'R-10': {
    id: 'R-10',
    title: 'Letter grade from the final GPA',
    text:
      'A+ = 5.00, A = 4.00 to 4.99, A- = 3.50 to 3.99, B = 3.00 to 3.49, ' +
      'C = 2.00 to 2.99, D = 1.00 to 1.99, anything else = F. The letter is read from ' +
      'the GPA after it has been rounded to 2 decimal places.',
  },
  'R-11': {
    id: 'R-11',
    title: 'Theory and practical pass marks',
    text:
      'Theory is out of 75 with a pass mark of 25. Practical is out of 25 with a pass ' +
      'mark of 8. Failing either part fails the subject: grade point 0. A subject with no ' +
      'practical part is one written paper out of 100 with a pass mark of 33 (25 + 8).',
  },
  'R-12': {
    id: 'R-12',
    title: 'Absent',
    text:
      'Absent in a compulsory subject: show AB, subject grade point 0, overall result F. ' +
      'Absent in the optional subject: it contributes 0 and the student appears on the ' +
      'checking list.',
  },
  'R-13': {
    id: 'R-13',
    title: 'GPA formula and cancellation',
    text:
      'GPA = (sum of the compulsory grade points + max(0, optional grade point - 2)) / 6, ' +
      'capped at 5.00 and shown to 2 decimal places. Any compulsory failure gives GPA 0.00 ' +
      'and letter F; the uncancelled average stays visible in the calculation trace.',
  },
  'R-29': {
    id: 'R-29',
    title: 'Office checking lists',
    text:
      'Optional list: every student whose optional grade point is 2.00 or below, an absent ' +
      'optional included. Practical fail list: every student with a practical part below 8 ' +
      'in any subject. Absent list: every student with AB in any subject. A student can ' +
      'appear on more than one list.',
  },
  'GS': {
    id: 'GS',
    title: 'Grade scale',
    text:
      'A passing subject takes its grade point from the mark out of 100: 80+ = 5.00, ' +
      '70-79 = 4.00, 60-69 = 3.50, 50-59 = 3.00, 40-49 = 2.00, 33-39 = 1.00.',
  },
};

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function formatGpa(value: number): string {
  return value.toFixed(2);
}

/** Grade point for a mark out of 100, ignoring component pass marks. */
export function gradeForMark(mark: number): GradeBand {
  const band = SUBJECT_GRADE_SCALE.find((b) => mark >= b.min && mark <= b.max);
  return band ?? SUBJECT_GRADE_SCALE[SUBJECT_GRADE_SCALE.length - 1];
}

/** Letter grade for a final GPA (R-10). */
export function letterForGpa(gpa: number, passed: boolean): string {
  if (!passed) return 'F';
  const g = round2(gpa);
  const band = GPA_LETTER_SCALE.find((b) => g >= b.min);
  return band ? band.letter : 'F';
}
