import { readFileSync } from "node:fs";

import { z } from "zod";

/**
 * Shape of the official P08 dataset (`P08_school_results_public.json`).
 *
 * From the published format note:
 *   - A subject without a practical part is one whole number out of 100.
 *   - A subject with a practical part is `{ theory: 0..75, practical: 0..25 }`
 *     and its mark is the sum.
 *   - `"AB"` means absent in that subject.
 */

export const ABSENT = "AB" as const;

export const fixtureMarkSchema = z.union([
  z.literal(ABSENT),
  z.number().int().min(0).max(100),
  z.object({
    theory: z.number().int().min(0).max(75),
    practical: z.number().int().min(0).max(25),
  }),
]);

export const fixtureSubjectSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  practical: z.boolean(),
});

export const fixtureStudentSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  class: z.string().min(1),
  optional: z.string().min(1),
  marks: z.record(z.string(), fixtureMarkSchema),
});

export const fixtureCaseSchema = z.object({
  case_id: z.string().min(1),
  subjects: z.array(fixtureSubjectSchema).min(1),
  compulsory: z.array(z.string().min(1)).min(1),
  students: z.array(fixtureStudentSchema).min(1),
});

export const fixtureFileSchema = z.object({
  schema_version: z.string(),
  problem_id: z.string(),
  cases: z.array(fixtureCaseSchema).min(1),
});

export type FixtureMark = z.infer<typeof fixtureMarkSchema>;
export type FixtureSubject = z.infer<typeof fixtureSubjectSchema>;
export type FixtureStudent = z.infer<typeof fixtureStudentSchema>;
export type FixtureCase = z.infer<typeof fixtureCaseSchema>;
export type FixtureFile = z.infer<typeof fixtureFileSchema>;

/** Narrows a mark to the `{ theory, practical }` form. */
export function isSplitMark(
  mark: FixtureMark,
): mark is { theory: number; practical: number } {
  return typeof mark === "object" && mark !== null;
}

/** Narrows a mark to the absent sentinel. */
export function isAbsentMark(mark: FixtureMark): mark is typeof ABSENT {
  return mark === ABSENT;
}

const DEFAULT_FIXTURE_PATH = new URL("./data/cases.json", import.meta.url);

/**
 * Reads and validates the bundled dataset. Throws with Zod's issue list if the
 * file has drifted from the documented format.
 */
export function loadFixture(path: URL | string = DEFAULT_FIXTURE_PATH): FixtureFile {
  const raw = readFileSync(path, "utf-8");
  return fixtureFileSchema.parse(JSON.parse(raw));
}
