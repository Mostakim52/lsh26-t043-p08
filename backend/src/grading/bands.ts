/**
 * Subject mark -> grade point bands, exactly as published in the problem
 * statement. No other board's rules apply.
 *
 *   80 and above -> 5.0    50 to 59 -> 3.0
 *   70 to 79     -> 4.0    40 to 49 -> 2.0
 *   60 to 69     -> 3.5    33 to 39 -> 1.0
 *                          below 33 -> 0 (fail)
 */
const BANDS: ReadonlyArray<{ min: number; gradePoint: number; label: string }> = [
  { min: 80, gradePoint: 5.0, label: "80 and above" },
  { min: 70, gradePoint: 4.0, label: "70 to 79" },
  { min: 60, gradePoint: 3.5, label: "60 to 69" },
  { min: 50, gradePoint: 3.0, label: "50 to 59" },
  { min: 40, gradePoint: 2.0, label: "40 to 49" },
  { min: 33, gradePoint: 1.0, label: "33 to 39" },
  { min: 0, gradePoint: 0, label: "below 33" },
];

export interface BandMatch {
  gradePoint: number;
  label: string;
}

/** Maps a subject mark (0-100) to its grade point band. */
export function scoreToGradePoint(score: number): BandMatch {
  const band = BANDS.find((b) => score >= b.min);
  // BANDS always has a { min: 0 } floor, so this is unreachable for any
  // non-negative score — the non-null assertion documents that invariant.
  return { gradePoint: band!.gradePoint, label: band!.label };
}

/** Clinical pass marks for a subject with a practical part. */
export const THEORY_MAX = 75;
export const THEORY_PASS_MARK = 25;
export const PRACTICAL_MAX = 25;
export const PRACTICAL_PASS_MARK = 8;

/** GPA formula constants. */
export const OPTIONAL_BONUS_FLOOR = 2.0;
export const GPA_CAP = 5.0;

/**
 * Letter grade from a GPA already capped and rounded to 2 decimal places.
 * Bands: A+ = 5.00, A = 4.00-4.99, A- = 3.50-3.99, B = 3.00-3.49,
 *        C = 2.00-2.99, D = 1.00-1.99, F = fail.
 */
export function letterFromGpa(gpa: number): "A+" | "A" | "A-" | "B" | "C" | "D" | "F" {
  if (gpa >= 5) return "A+";
  if (gpa >= 4) return "A";
  if (gpa >= 3.5) return "A-";
  if (gpa >= 3) return "B";
  if (gpa >= 2) return "C";
  if (gpa >= 1) return "D";
  return "F";
}

/**
 * Rounds to 2 decimal places without the classic floating-point drift
 * (e.g. avoids 1.005 -> 1 instead of 1.01).
 */
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
