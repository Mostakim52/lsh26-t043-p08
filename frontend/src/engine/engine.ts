import {
  COMPULSORY_COUNT,
  GPA_CAP,
  GPA_DIVISOR,
  MARKS,
  OPTIONAL_DEDUCTION,
  formatGpa,
  gradeForMark,
  letterForGpa,
  round2,
} from './rules';
import type {
  Dataset,
  Student,
  StudentResult,
  SubjectDef,
  SubjectMark,
  SubjectResult,
  TraceStep,
} from './types';

/**
 * Grade one subject for one student.
 *
 * Order matters: absence is decided before marks (R-12), then the component pass
 * marks (R-11), and only a subject that survives both reads a grade point off the
 * scale. Every branch records the rule that decided it so the trace can show it.
 */
export function evaluateSubject(def: SubjectDef, mark: SubjectMark | undefined): SubjectResult {
  const base = {
    code: def.code,
    name: def.name,
    kind: def.kind,
    hasPractical: def.hasPractical,
  };

  if (!mark || mark.absent) {
    return {
      ...base,
      theory: null,
      practical: null,
      total: null,
      markUsed: 'AB',
      gradePoint: 0,
      letter: 'F',
      status: 'absent',
      ruleId: 'R-12',
      rule:
        def.kind === 'compulsory'
          ? 'Absent in a compulsory subject: AB, grade point 0, and the overall result becomes F.'
          : 'Absent in the optional subject: it contributes 0 and the student goes on the checking list.',
      practicalFailed: false,
    };
  }

  if (def.hasPractical) {
    const theory = mark.theory ?? 0;
    const practical = mark.practical ?? 0;
    const total = theory + practical;
    const theoryFailed = theory < MARKS.theoryPass;
    const practicalFailed = practical < MARKS.practicalPass;

    if (theoryFailed || practicalFailed) {
      const parts: string[] = [];
      if (theoryFailed) {
        parts.push(`theory ${theory} / ${MARKS.theoryMax} is below the pass mark of ${MARKS.theoryPass}`);
      }
      if (practicalFailed) {
        parts.push(
          `practical ${practical} / ${MARKS.practicalMax} is below the pass mark of ${MARKS.practicalPass}`,
        );
      }
      const passedPart = theoryFailed
        ? ''
        : ` The theory mark of ${theory} / ${MARKS.theoryMax} passed on its own.`;
      return {
        ...base,
        theory,
        practical,
        total,
        markUsed: `${theory} + ${practical} = ${total} / 100`,
        gradePoint: 0,
        letter: 'F',
        status: 'fail',
        ruleId: 'R-11',
        rule: `Failing either part fails the subject: ${parts.join(' and ')}, so grade point 0.${passedPart}`,
        practicalFailed,
      };
    }

    const band = gradeForMark(total);
    return {
      ...base,
      theory,
      practical,
      total,
      markUsed: `${theory} + ${practical} = ${total} / 100`,
      gradePoint: band.gp,
      letter: band.letter,
      status: 'pass',
      ruleId: 'GS',
      rule: `Both parts passed (theory ${theory} / ${MARKS.theoryMax}, practical ${practical} / ${MARKS.practicalMax}). Total ${total} falls in the ${band.min}-${band.max} band, so grade point ${band.gp.toFixed(2)}.`,
      practicalFailed: false,
    };
  }

  const written = mark.theory ?? 0;
  if (written < MARKS.writtenOnlyPass) {
    return {
      ...base,
      theory: written,
      practical: null,
      total: written,
      markUsed: `${written} / ${MARKS.writtenOnlyMax}`,
      gradePoint: 0,
      letter: 'F',
      status: 'fail',
      ruleId: 'R-11',
      rule: `Written ${written} / ${MARKS.writtenOnlyMax} is below the pass mark of ${MARKS.writtenOnlyPass}, so grade point 0.`,
      practicalFailed: false,
    };
  }

  const band = gradeForMark(written);
  return {
    ...base,
    theory: written,
    practical: null,
    total: written,
    markUsed: `${written} / ${MARKS.writtenOnlyMax}`,
    gradePoint: band.gp,
    letter: band.letter,
    status: 'pass',
    ruleId: 'GS',
    rule: `Written ${written} / ${MARKS.writtenOnlyMax} passed and falls in the ${band.min}-${band.max} band, so grade point ${band.gp.toFixed(2)}.`,
    practicalFailed: false,
  };
}

/** Grade one student: every subject, then the GPA, the letter and the trace behind them. */
export function evaluateStudent(
  student: Student,
  subjects: SubjectDef[],
  className: string,
): StudentResult {
  const markByCode = new Map(student.marks.map((m) => [m.code, m]));
  const compulsoryDefs = subjects.filter((s) => s.kind === 'compulsory');
  const optionalDef = subjects.find((s) => s.code === student.optionalCode) ?? null;

  const compulsory = compulsoryDefs.map((def) => evaluateSubject(def, markByCode.get(def.code)));
  const optional = optionalDef ? evaluateSubject(optionalDef, markByCode.get(optionalDef.code)) : null;
  const all = optional ? [...compulsory, optional] : compulsory;

  const compulsorySum = round2(compulsory.reduce((sum, s) => sum + s.gradePoint, 0));
  const optionalGradePoint = optional ? optional.gradePoint : 0;
  const optionalCredit = round2(Math.max(0, optionalGradePoint - OPTIONAL_DEDUCTION));

  const rawGpa = (compulsorySum + optionalCredit) / GPA_DIVISOR;
  const uncancelledGpa = round2(Math.min(GPA_CAP, rawGpa));

  const cancelledBy = compulsory.filter((s) => s.status !== 'pass');
  const passed = cancelledBy.length === 0;
  const gpa = passed ? uncancelledGpa : 0;
  const letter = letterForGpa(gpa, passed);

  const marked = all.filter((s) => s.total !== null);
  const averageMark = marked.length
    ? round2(all.reduce((sum, s) => sum + (s.total ?? 0), 0) / all.length)
    : 0;

  const flags = {
    optionalRule: optionalGradePoint <= OPTIONAL_DEDUCTION,
    practicalFail: all.some((s) => s.practicalFailed),
    absent: all.some((s) => s.status === 'absent'),
  };

  return {
    student,
    className,
    subjects: all,
    compulsory,
    optional,
    compulsorySum,
    optionalGradePoint,
    optionalCredit,
    uncancelledGpa,
    gpa,
    letter,
    passed,
    cancelledBy,
    averageMark,
    flags,
    trace: buildTrace({
      compulsory,
      optional,
      compulsorySum,
      optionalGradePoint,
      optionalCredit,
      rawGpa,
      uncancelledGpa,
      cancelledBy,
      passed,
      gpa,
      letter,
      averageMark,
    }),
  };
}

interface TraceInput {
  compulsory: SubjectResult[];
  optional: SubjectResult | null;
  compulsorySum: number;
  optionalGradePoint: number;
  optionalCredit: number;
  rawGpa: number;
  uncancelledGpa: number;
  cancelledBy: SubjectResult[];
  passed: boolean;
  gpa: number;
  letter: string;
  averageMark: number;
}

function buildTrace(input: TraceInput): TraceStep[] {
  const steps: TraceStep[] = [];

  steps.push({
    label: `Sum of the ${COMPULSORY_COUNT} compulsory grade points`,
    detail: input.compulsory.map((s) => `${s.name} ${s.gradePoint.toFixed(2)}`).join('  +  '),
    value: input.compulsorySum.toFixed(2),
    ruleId: 'R-13',
  });

  if (input.optional) {
    const gp = input.optionalGradePoint.toFixed(2);
    const helped = input.optionalCredit > 0;
    steps.push({
      label: 'Optional subject credit',
      detail:
        `${input.optional.name} scored ${input.optional.status === 'absent' ? 'AB, grade point 0.00' : gp}. ` +
        `max(0, ${gp} - ${OPTIONAL_DEDUCTION.toFixed(2)}) = ${input.optionalCredit.toFixed(2)}` +
        (helped ? '.' : ' - at or below 2.00 the optional adds nothing to the GPA.'),
      value: input.optionalCredit.toFixed(2),
      ruleId: 'R-13',
    });
  }

  steps.push({
    label: `Divide by ${GPA_DIVISOR}`,
    detail: `(${input.compulsorySum.toFixed(2)} + ${input.optionalCredit.toFixed(2)}) / ${GPA_DIVISOR} = ${input.rawGpa.toFixed(4)}`,
    value: round2(input.rawGpa).toFixed(2),
    ruleId: 'R-13',
  });

  if (input.rawGpa > GPA_CAP) {
    steps.push({
      label: 'Cap at 5.00',
      detail: `${round2(input.rawGpa).toFixed(2)} is above the cap, so the GPA is held at ${GPA_CAP.toFixed(2)}.`,
      value: GPA_CAP.toFixed(2),
      ruleId: 'R-13',
      emphasis: 'cap',
    });
  }

  if (!input.passed) {
    const names = input.cancelledBy
      .map((s) => `${s.name} (${s.status === 'absent' ? 'AB' : s.markUsed})`)
      .join(', ');
    steps.push({
      label: 'Compulsory failure cancels the GPA',
      detail:
        `Caused by ${names}. The uncancelled average of ${formatGpa(input.uncancelledGpa)} ` +
        `(average mark ${input.averageMark.toFixed(2)} / 100) stays visible here, but the ` +
        'reported GPA becomes 0.00 and the letter grade F.',
      value: '0.00',
      ruleId: input.cancelledBy.some((s) => s.status === 'absent') ? 'R-12' : 'R-13',
      emphasis: 'cancel',
    });
  }

  steps.push({
    label: 'Final GPA and letter grade',
    detail: input.passed
      ? `GPA ${formatGpa(input.gpa)} falls in the ${input.letter} band.`
      : 'A cancelled result is reported as F regardless of the marks scored.',
    value: `${formatGpa(input.gpa)}  ${input.letter}`,
    ruleId: 'R-10',
    emphasis: 'result',
  });

  return steps;
}

/** Grade a whole dataset, in roll order within each class. */
export function evaluateDataset(dataset: Dataset): StudentResult[] {
  const classNames = new Map(dataset.classes.map((c) => [c.id, c.name]));
  return dataset.students.map((student) =>
    evaluateStudent(student, dataset.subjects, classNames.get(student.classId) ?? student.classId),
  );
}
