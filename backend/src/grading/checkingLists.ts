import { PRACTICAL_PASS_MARK } from "./bands.js";
import type { StudentResult } from "./engine.js";

/**
 * The three office checking lists, per the published clarifications:
 *   - optional:  every student whose optional grade point is 2.0 or below
 *                (an absent optional counts, since its grade point is 0).
 *   - practical: every student with a practical part below 8 in any subject
 *                (the recorded practical score, not an absence).
 *   - absent:    every student with AB in any subject.
 * A student can appear on more than one list.
 */
export interface CheckingLists {
  optionalConcern: string[];
  practicalFail: string[];
  absent: string[];
}

export function computeCheckingLists(
  results: StudentResult[],
): CheckingLists {
  const optionalConcern: string[] = [];
  const practicalFail: string[] = [];
  const absent: string[] = [];

  for (const result of results) {
    if (result.optionalResult.gradePoint <= 2.0) {
      optionalConcern.push(result.rollNo);
    }

    const hasAbsence = result.subjectResults.some((r) => r.isAbsent);
    if (hasAbsence) {
      absent.push(result.rollNo);
    }

    const hasPracticalFail = result.subjectResults.some(
      (r) =>
        r.hasPractical &&
        !r.isAbsent &&
        r.practicalScore !== null &&
        r.practicalScore < PRACTICAL_PASS_MARK,
    );
    if (hasPracticalFail) {
      practicalFail.push(result.rollNo);
    }
  }

  return { optionalConcern, practicalFail, absent };
}
