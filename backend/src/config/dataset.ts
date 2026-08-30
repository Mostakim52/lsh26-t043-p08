/**
 * The frontend's Dataset contract has no concept of switching between exam
 * sittings — one GET returns the whole cohort. Of the sessions seeded from
 * the official fixture, this is the one exposed as "the" results.
 */
export const ACTIVE_CASE_ID = "PUB-01";

/** Stable class id from a class name, e.g. "Class 9" -> "class-9". */
export function toClassId(className: string): string {
  return className
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
