export type SubjectKind = 'compulsory' | 'optional';

export interface SubjectDef {
  code: string;
  name: string;
  /** Practical subjects are marked as theory /75 + practical /25. Others are a single written /100. */
  hasPractical: boolean;
  kind: SubjectKind;
}

export interface ClassDef {
  id: string;
  name: string;
  session: string;
}

export interface SubjectMark {
  code: string;
  /** Written mark. /100 for a written-only subject, /75 for the theory part of a practical subject. */
  theory: number | null;
  /** Practical mark /25. null for subjects with no practical part. */
  practical: number | null;
  /** Student did not sit the paper. Marks are ignored and the subject shows AB. */
  absent?: boolean;
}

export interface Student {
  id: string;
  roll: number;
  name: string;
  classId: string;
  /** Subject code of the student's optional (fourth) subject. */
  optionalCode: string;
  marks: SubjectMark[];
  /** Set on hand-seeded records so the edge-case set is auditable. */
  edgeCase?: string;
}

export interface Dataset {
  meta: {
    school: string;
    exam: string;
    session: string;
    generatedAt: string;
    /** Only the sample generator sets this; a live backend has no seed. */
    seed?: number;
  };
  classes: ClassDef[];
  subjects: SubjectDef[];
  students: Student[];
}

export type SubjectStatus = 'pass' | 'fail' | 'absent';

export interface SubjectResult {
  code: string;
  name: string;
  kind: SubjectKind;
  hasPractical: boolean;
  theory: number | null;
  practical: number | null;
  /** Mark the grade point was read from. null when absent. */
  total: number | null;
  /** How the mark reads on the transcript: "74 / 100", "58 + 21 = 79 / 100", "AB". */
  markUsed: string;
  gradePoint: number;
  letter: string;
  status: SubjectStatus;
  /** Rule that decided this grade point. */
  ruleId: string;
  rule: string;
  /** True when the practical part is below its pass mark. */
  practicalFailed: boolean;
}

export interface TraceStep {
  label: string;
  detail: string;
  value: string;
  ruleId?: string;
  /** Marks the step that cancelled an otherwise passing average. */
  emphasis?: 'cancel' | 'cap' | 'result';
}

export interface StudentFlags {
  /** Optional grade point 2.00 or below - the optional subject added nothing. */
  optionalRule: boolean;
  /** Practical part below 8 in at least one subject. */
  practicalFail: boolean;
  /** AB in at least one subject. */
  absent: boolean;
}

export interface StudentResult {
  student: Student;
  className: string;
  subjects: SubjectResult[];
  compulsory: SubjectResult[];
  optional: SubjectResult | null;
  compulsorySum: number;
  optionalGradePoint: number;
  /** max(0, optional GP - 2) */
  optionalCredit: number;
  /** GPA from the formula, before the compulsory-failure cancellation. */
  uncancelledGpa: number;
  /** Final GPA after cancellation, 2 dp. */
  gpa: number;
  letter: string;
  passed: boolean;
  /** Compulsory subjects that failed or were absent, i.e. what cancelled the result. */
  cancelledBy: SubjectResult[];
  /** Average mark across every subject sat, kept visible even when the result is cancelled. */
  averageMark: number;
  flags: StudentFlags;
  trace: TraceStep[];
}
