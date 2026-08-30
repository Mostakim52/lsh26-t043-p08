import { MARKS, OPTIONAL_DEDUCTION } from './rules';
import type { StudentResult } from './types';

export type ChecklistId = 'optional' | 'practical' | 'absent';

export interface ChecklistEntry {
  result: StudentResult;
  /** What a teacher has to verify by hand, in plain words. */
  reason: string;
  /** Subject codes the teacher should pull the script for. */
  subjects: string[];
}

export interface Checklist {
  id: ChecklistId;
  title: string;
  description: string;
  ruleId: string;
  entries: ChecklistEntry[];
}

/**
 * The three office checking lists (R-29). A student can land on more than one,
 * so the lists are built independently rather than as a partition.
 */
export function buildChecklists(results: StudentResult[]): Checklist[] {
  const optional: ChecklistEntry[] = [];
  const practical: ChecklistEntry[] = [];
  const absent: ChecklistEntry[] = [];

  for (const result of results) {
    if (result.flags.optionalRule && result.optional) {
      const opt = result.optional;
      optional.push({
        result,
        reason:
          opt.status === 'absent'
            ? `Absent in optional ${opt.name}: grade point 0.00, contributes 0 to the GPA.`
            : opt.status === 'fail'
              ? // Say why the optional is a zero, not just that it is one.
                `Optional ${opt.name} scored ${opt.markUsed} but failed: ${opt.rule} ` +
                'Grade point 0.00 adds nothing to the GPA.'
              : `Optional ${opt.name} scored ${opt.markUsed} for grade point ${opt.gradePoint.toFixed(2)}, ` +
                `at or below ${OPTIONAL_DEDUCTION.toFixed(2)} so it added nothing to the GPA.`,
        subjects: [opt.code],
      });
    }

    const practicalSubjects = result.subjects.filter((s) => s.practicalFailed);
    if (practicalSubjects.length) {
      practical.push({
        result,
        reason: practicalSubjects
          .map(
            (s) =>
              `${s.name} practical ${s.practical} / ${MARKS.practicalMax} is below ${MARKS.practicalPass}` +
              (s.theory !== null && s.theory >= MARKS.theoryPass
                ? ` while theory ${s.theory} / ${MARKS.theoryMax} passed`
                : '') +
              ` - subject grade point 0.00`,
          )
          .join('. '),
        subjects: practicalSubjects.map((s) => s.code),
      });
    }

    const absentSubjects = result.subjects.filter((s) => s.status === 'absent');
    if (absentSubjects.length) {
      absent.push({
        result,
        reason: absentSubjects
          .map(
            (s) =>
              `AB in ${s.name} (${s.kind})` +
              (s.kind === 'compulsory'
                ? ' - overall result cancelled to F'
                : ' - contributes 0, GPA still stands'),
          )
          .join('. '),
        subjects: absentSubjects.map((s) => s.code),
      });
    }
  }

  return [
    {
      id: 'optional',
      title: 'Optional subject rule',
      description:
        'Optional grade point 2.00 or below, an absent optional included. The optional subject ' +
        'added nothing, so the GPA is the compulsory subjects alone.',
      ruleId: 'R-29',
      entries: optional,
    },
    {
      id: 'practical',
      title: 'Practical fail',
      description:
        `A practical part below ${MARKS.practicalPass} / ${MARKS.practicalMax} in any subject. ` +
        'The subject is grade point 0 even where the theory paper passed.',
      ruleId: 'R-29',
      entries: practical,
    },
    {
      id: 'absent',
      title: 'Absent',
      description:
        'AB in any subject. A compulsory AB cancels the result to F; an optional AB contributes 0.',
      ruleId: 'R-29',
      entries: absent,
    },
  ];
}

/** Students appearing on more than one list, which the office checks first. */
export function multiListStudents(lists: Checklist[]): Map<string, ChecklistId[]> {
  const seen = new Map<string, ChecklistId[]>();
  for (const list of lists) {
    for (const entry of list.entries) {
      const key = entry.result.student.id;
      seen.set(key, [...(seen.get(key) ?? []), list.id]);
    }
  }
  return new Map([...seen].filter(([, ids]) => ids.length > 1));
}
