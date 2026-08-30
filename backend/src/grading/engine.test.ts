import { describe, expect, it } from "vitest";

import { loadFixture } from "../db/fixture.js";
import { normalizeCase, type NormalizedCase } from "../db/normalize.js";
import { computeStudentResult } from "./engine.js";

/**
 * Golden tests against the real, bundled PUB-01 case. Expected values below
 * are hand-computed from that student's actual marks (see the case comment
 * on each test) — this both verifies the engine and guards against the
 * fixture data silently drifting out from under it.
 */
const pub01: NormalizedCase = normalizeCase(
  loadFixture().cases.find((c) => c.case_id === "PUB-01")!,
);

function studentByRoll(rollNo: string) {
  const student = pub01.students.find((s) => s.rollNo === rollNo);
  if (!student) throw new Error(`fixture missing ${rollNo}`);
  return student;
}

describe("computeStudentResult — golden cases from PUB-01", () => {
  it("S011: practical fail with a passing theory mark fails the subject and the student", () => {
    // PHY: theory 60 (passes), practical 5 (fails, < 8) -> grade point 0.
    // BAN 57->3.0, ENG 82->5.0, MAT 75->4.0, PHY fail->0, CHE 58+18=76->4.0,
    // BIO 69+21=90->5.0. Compulsory sum = 21.0.
    // Optional AGR 55+16=71->4.0, contribution = max(0, 4.0-2) = 2.0.
    // raw = (21.0 + 2.0) / 6 = 3.8333... -> 3.83
    const result = computeStudentResult(studentByRoll("S011"), pub01.subjects);

    const phy = result.compulsoryResults.find((r) => r.subjectCode === "PHY")!;
    expect(phy.gradePoint).toBe(0);
    expect(phy.rule).toMatch(/practical 5 < 8/);
    expect(phy.theoryScore).toBe(60);
    expect(phy.practicalScore).toBe(5);
    expect(phy.isAbsent).toBe(false);

    expect(result.failureSubjectCodes).toEqual(["PHY"]);
    expect(result.isOverallFail).toBe(true);
    expect(result.uncancelledAverage).toBe(3.83);
    expect(result.officialGpa).toBe(0);
    expect(result.letterGrade).toBe("F");
  });

  it("S027: an optional subject below the point where it helps contributes nothing", () => {
    // All six compulsory subjects pass: BAN72->4.0, ENG64->3.5, MAT76->4.0,
    // PHY52+16=68->3.5, CHE55+18=73->4.0, BIO63+18=81->5.0. Sum = 24.0.
    // Optional AGR 28+10=38->1.0, contribution = max(0, 1.0-2) = 0.
    // raw = (24.0 + 0) / 6 = 4.00 exactly.
    const result = computeStudentResult(studentByRoll("S027"), pub01.subjects);

    expect(result.optionalResult.gradePoint).toBe(1.0);
    expect(result.isOverallFail).toBe(false);
    expect(result.uncancelledAverage).toBe(4.0);
    expect(result.officialGpa).toBe(4.0);
    expect(result.letterGrade).toBe("A");
  });

  it("S032: absence in a compulsory subject fails the student but keeps the uncancelled average visible", () => {
    // BIO is "AB". BAN76->4.0, ENG58->3.0, MAT49->2.0, PHY40+17=57->3.0,
    // CHE45+19=64->3.5, BIO absent->0. Sum = 15.5.
    // Optional HMT 46+16=62->3.5, contribution = max(0, 3.5-2) = 1.5.
    // raw = (15.5 + 1.5) / 6 = 2.8333... -> 2.83
    const result = computeStudentResult(studentByRoll("S032"), pub01.subjects);

    const bio = result.compulsoryResults.find((r) => r.subjectCode === "BIO")!;
    expect(bio.isAbsent).toBe(true);
    expect(bio.gradePoint).toBe(0);
    expect(bio.markUsed).toBe("AB");

    expect(result.failureSubjectCodes).toEqual(["BIO"]);
    expect(result.isOverallFail).toBe(true);
    expect(result.officialGpa).toBe(0);
    expect(result.letterGrade).toBe("F");
    // The high-ish average must still be visible even though it's overridden.
    expect(result.uncancelledAverage).toBe(2.83);
  });

  it("S064: a genuine zero mark fails the subject exactly like a low mark, but is not an absence", () => {
    // ENG scored a real 0 (below 33 -> fail), not "AB".
    // BAN58->3.0, ENG0->0, MAT89->5.0, PHY36+13=49->2.0, CHE50+21=71->4.0,
    // BIO48+13=61->3.5. Sum = 17.5.
    // Optional AGR 42+17=59->3.0, contribution = max(0, 3.0-2) = 1.0.
    // raw = (17.5 + 1.0) / 6 = 3.0833... -> 3.08
    const result = computeStudentResult(studentByRoll("S064"), pub01.subjects);

    const eng = result.compulsoryResults.find((r) => r.subjectCode === "ENG")!;
    expect(eng.isAbsent).toBe(false);
    expect(eng.wholeScore).toBe(0);
    expect(eng.gradePoint).toBe(0);
    expect(eng.rule).toMatch(/below 33/);

    expect(result.failureSubjectCodes).toEqual(["ENG"]);
    expect(result.isOverallFail).toBe(true);
    expect(result.officialGpa).toBe(0);
    expect(result.uncancelledAverage).toBe(3.08);

    // The specification's core distinction: a zero must not look like an
    // absence anywhere in the trace.
    const anyAbsentMark = result.subjectResults.some((r) => r.isAbsent);
    expect(anyAbsentMark).toBe(false);
  });
});

/** Minimal synthetic session: 6 compulsory (1 practical) + 1 optional (practical). */
function syntheticSubjects(): NormalizedCase["subjects"] {
  return [
    { code: "C1", name: "C1", hasPractical: false, isCompulsory: true, displayOrder: 0 },
    { code: "C2", name: "C2", hasPractical: false, isCompulsory: true, displayOrder: 1 },
    { code: "C3", name: "C3", hasPractical: false, isCompulsory: true, displayOrder: 2 },
    { code: "C4", name: "C4", hasPractical: false, isCompulsory: true, displayOrder: 3 },
    { code: "C5", name: "C5", hasPractical: false, isCompulsory: true, displayOrder: 4 },
    { code: "CP", name: "CP", hasPractical: true, isCompulsory: true, displayOrder: 5 },
    { code: "OPT", name: "OPT", hasPractical: true, isCompulsory: false, displayOrder: 6 },
  ];
}

type Mark = NormalizedCase["students"][number]["marks"][number];

function passingStudent(overrides: Partial<Record<string, Mark>> = {}): NormalizedCase["students"][number] {
  const defaults: Record<string, Mark> = {
    C1: { subjectCode: "C1", isAbsent: false, wholeScore: 60, theoryScore: null, practicalScore: null },
    C2: { subjectCode: "C2", isAbsent: false, wholeScore: 60, theoryScore: null, practicalScore: null },
    C3: { subjectCode: "C3", isAbsent: false, wholeScore: 60, theoryScore: null, practicalScore: null },
    C4: { subjectCode: "C4", isAbsent: false, wholeScore: 60, theoryScore: null, practicalScore: null },
    C5: { subjectCode: "C5", isAbsent: false, wholeScore: 60, theoryScore: null, practicalScore: null },
    CP: { subjectCode: "CP", isAbsent: false, wholeScore: null, theoryScore: 50, practicalScore: 20 },
    OPT: { subjectCode: "OPT", isAbsent: false, wholeScore: null, theoryScore: 50, practicalScore: 20 },
  };
  const merged: Record<string, Mark> = { ...defaults };
  for (const [code, mark] of Object.entries(overrides)) {
    if (mark) merged[code] = mark;
  }
  return {
    rollNo: "SYN-1",
    name: "Synthetic Student",
    className: "Class Test",
    optionalSubjectCode: "OPT",
    marks: Object.values(merged),
  };
}

describe("gradeSubject boundaries (via computeStudentResult)", () => {
  const subjects = syntheticSubjects();

  it("theory exactly at the pass mark (25) passes", () => {
    const student = passingStudent({
      CP: { subjectCode: "CP", isAbsent: false, wholeScore: null, theoryScore: 25, practicalScore: 20 },
    });
    const result = computeStudentResult(student, subjects);
    const cp = result.compulsoryResults.find((r) => r.subjectCode === "CP")!;
    expect(cp.gradePoint).toBeGreaterThan(0);
  });

  it("theory one below the pass mark (24) fails the subject", () => {
    const student = passingStudent({
      CP: { subjectCode: "CP", isAbsent: false, wholeScore: null, theoryScore: 24, practicalScore: 20 },
    });
    const result = computeStudentResult(student, subjects);
    const cp = result.compulsoryResults.find((r) => r.subjectCode === "CP")!;
    expect(cp.gradePoint).toBe(0);
    expect(cp.rule).toMatch(/theory 24 < 25/);
  });

  it("practical exactly at the pass mark (8) passes", () => {
    const student = passingStudent({
      CP: { subjectCode: "CP", isAbsent: false, wholeScore: null, theoryScore: 50, practicalScore: 8 },
    });
    const result = computeStudentResult(student, subjects);
    const cp = result.compulsoryResults.find((r) => r.subjectCode === "CP")!;
    expect(cp.gradePoint).toBeGreaterThan(0);
  });

  it("practical one below the pass mark (7) fails the subject", () => {
    const student = passingStudent({
      CP: { subjectCode: "CP", isAbsent: false, wholeScore: null, theoryScore: 50, practicalScore: 7 },
    });
    const result = computeStudentResult(student, subjects);
    const cp = result.compulsoryResults.find((r) => r.subjectCode === "CP")!;
    expect(cp.gradePoint).toBe(0);
    expect(cp.rule).toMatch(/practical 7 < 8/);
  });

  it("reports both reasons when theory and practical both fail", () => {
    const student = passingStudent({
      CP: { subjectCode: "CP", isAbsent: false, wholeScore: null, theoryScore: 10, practicalScore: 3 },
    });
    const result = computeStudentResult(student, subjects);
    const cp = result.compulsoryResults.find((r) => r.subjectCode === "CP")!;
    expect(cp.gradePoint).toBe(0);
    expect(cp.rule).toMatch(/theory 10 < 25/);
    expect(cp.rule).toMatch(/practical 3 < 8/);
  });

  it("a passing student with every compulsory subject at 60 lands in the A- band", () => {
    // C1-C5 @ 60 -> 3.5 each = 17.5. CP (practical, theory50+practical20=70) -> 4.0.
    // Compulsory sum = 17.5 + 4.0 = 21.5.
    // Optional OPT (theory50+practical20=70) -> 4.0, contribution = max(0, 4.0-2) = 2.0.
    // raw = (21.5 + 2.0) / 6 = 3.91666... -> 3.92
    const result = computeStudentResult(passingStudent(), subjects);
    expect(result.isOverallFail).toBe(false);
    expect(result.officialGpa).toBe(3.92);
    expect(result.letterGrade).toBe("A-");
  });

  it("a mark of exactly 100 on a whole-paper subject bands to 5.0, not out of range", () => {
    const student = passingStudent({
      C1: { subjectCode: "C1", isAbsent: false, wholeScore: 100, theoryScore: null, practicalScore: null },
    });
    const result = computeStudentResult(student, subjects);
    const c1 = result.compulsoryResults.find((r) => r.subjectCode === "C1")!;
    expect(c1.gradePoint).toBe(5.0);
  });
});

describe("computeStudentResult — trace shape", () => {
  it("always produces six compulsory results plus exactly one optional result", () => {
    for (const student of pub01.students) {
      const result = computeStudentResult(student, pub01.subjects);

      expect(result.compulsoryResults).toHaveLength(6);
      expect(result.subjectResults).toHaveLength(7);
      expect(result.optionalResult.isCompulsory).toBe(false);
      expect(result.compulsoryResults.every((r) => r.isCompulsory)).toBe(true);
    }
  });

  it("never overrides the GPA when there is no compulsory failure", () => {
    for (const student of pub01.students) {
      const result = computeStudentResult(student, pub01.subjects);

      if (!result.isOverallFail) {
        expect(result.officialGpa).toBe(result.uncancelledAverage);
        expect(result.letterGrade).not.toBe("F");
      }
    }
  });

  it("always overrides to GPA 0.00 / F when any compulsory subject fails", () => {
    for (const student of pub01.students) {
      const result = computeStudentResult(student, pub01.subjects);

      if (result.isOverallFail) {
        expect(result.officialGpa).toBe(0);
        expect(result.letterGrade).toBe("F");
        expect(result.failureSubjectCodes.length).toBeGreaterThan(0);
      }
    }
  });

  it("keeps the GPA within [0, 5] for every student in the dataset", () => {
    for (const student of pub01.students) {
      const result = computeStudentResult(student, pub01.subjects);
      expect(result.officialGpa).toBeGreaterThanOrEqual(0);
      expect(result.officialGpa).toBeLessThanOrEqual(5);
      expect(result.uncancelledAverage).toBeGreaterThanOrEqual(0);
      expect(result.uncancelledAverage).toBeLessThanOrEqual(5);
    }
  });
});
