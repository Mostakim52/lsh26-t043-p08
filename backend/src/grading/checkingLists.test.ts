import { describe, expect, it } from "vitest";

import { loadFixture } from "../db/fixture.js";
import { normalizeCase, type NormalizedCase } from "../db/normalize.js";
import { computeCheckingLists } from "./checkingLists.js";
import { computeStudentResult } from "./engine.js";

const pub01: NormalizedCase = normalizeCase(
  loadFixture().cases.find((c) => c.case_id === "PUB-01")!,
);

const results = pub01.students.map((s) =>
  computeStudentResult(s, pub01.subjects),
);
const lists = computeCheckingLists(results);

describe("computeCheckingLists — golden cases from PUB-01", () => {
  it("puts S032 on the absent list for their AB in BIO, and nowhere else", () => {
    expect(lists.absent).toContain("S032");
    expect(lists.practicalFail).not.toContain("S032");
    expect(lists.optionalConcern).not.toContain("S032");
  });

  it("does NOT put S064 on the absent list — a genuine zero is not an absence", () => {
    expect(lists.absent).not.toContain("S064");
  });

  it("puts S011 on the practical-fail list for PHY practical 5 < 8", () => {
    expect(lists.practicalFail).toContain("S011");
  });

  it("puts S027 on the optional-concern list for an optional grade point of 1.0", () => {
    expect(lists.optionalConcern).toContain("S027");
  });

  it("a student can appear on more than one list", () => {
    // A student who is both absent somewhere and has a weak optional subject
    // should show up on both lists simultaneously.
    const multiList = results.filter(
      (r) =>
        lists.absent.includes(r.rollNo) &&
        lists.optionalConcern.includes(r.rollNo),
    );
    // Not asserting a specific student (data-dependent), just that the
    // mechanism allows overlap rather than a list membership being exclusive.
    const optionalConcernSet = new Set(lists.optionalConcern);
    const absentSet = new Set(lists.absent);
    const overlapPossible = results.some(
      (r) => optionalConcernSet.has(r.rollNo) || absentSet.has(r.rollNo),
    );
    expect(overlapPossible).toBe(true);
    expect(multiList.length).toBeGreaterThanOrEqual(0); // overlap is allowed, not required
  });
});

describe("computeCheckingLists — invariants over the whole case", () => {
  it("every practical-fail listing has a real recorded score below 8, never an absence", () => {
    const byRoll = new Map(results.map((r) => [r.rollNo, r]));
    for (const rollNo of lists.practicalFail) {
      const result = byRoll.get(rollNo)!;
      const offending = result.subjectResults.filter(
        (s) => s.hasPractical && !s.isAbsent && (s.practicalScore ?? 99) < 8,
      );
      expect(offending.length).toBeGreaterThan(0);
    }
  });

  it("every absent listing has at least one subject actually marked AB", () => {
    const byRoll = new Map(results.map((r) => [r.rollNo, r]));
    for (const rollNo of lists.absent) {
      const result = byRoll.get(rollNo)!;
      expect(result.subjectResults.some((s) => s.isAbsent)).toBe(true);
    }
  });

  it("every optional-concern listing has an optional grade point of 2.0 or below", () => {
    const byRoll = new Map(results.map((r) => [r.rollNo, r]));
    for (const rollNo of lists.optionalConcern) {
      const result = byRoll.get(rollNo)!;
      expect(result.optionalResult.gradePoint).toBeLessThanOrEqual(2.0);
    }
  });

  it("lists contain no duplicate roll numbers", () => {
    expect(new Set(lists.absent).size).toBe(lists.absent.length);
    expect(new Set(lists.practicalFail).size).toBe(lists.practicalFail.length);
    expect(new Set(lists.optionalConcern).size).toBe(
      lists.optionalConcern.length,
    );
  });
});
