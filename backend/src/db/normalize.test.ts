import { describe, expect, it } from "vitest";

import { loadFixture, type FixtureCase } from "./fixture.js";
import { FixtureValidationError, normalizeCase } from "./normalize.js";

/** A minimal well-formed case: one non-practical + one practical compulsory
 *  subject, plus two optional subjects (one of each kind). */
function buildCase(overrides: Partial<FixtureCase> = {}): FixtureCase {
  return {
    case_id: "TEST-01",
    subjects: [
      { code: "BAN", name: "Bangla", practical: false },
      { code: "PHY", name: "Physics", practical: true },
      { code: "REL", name: "Religion", practical: false },
      { code: "AGR", name: "Agriculture", practical: true },
    ],
    compulsory: ["BAN", "PHY"],
    students: [
      {
        id: "S001",
        name: "Test Student",
        class: "Class 9",
        optional: "REL",
        marks: { BAN: 55, PHY: { theory: 60, practical: 20 }, REL: 70 },
      },
    ],
    ...overrides,
  };
}

function caseWithMarks(
  optional: string,
  marks: FixtureCase["students"][number]["marks"],
): FixtureCase {
  return buildCase({
    students: [
      {
        id: "S001",
        name: "Test Student",
        class: "Class 9",
        optional,
        marks,
      },
    ],
  });
}

describe("normalizeCase — subjects", () => {
  it("flags compulsory subjects and preserves declaration order", () => {
    const result = normalizeCase(buildCase());

    expect(result.subjects).toEqual([
      {
        code: "BAN",
        name: "Bangla",
        hasPractical: false,
        isCompulsory: true,
        displayOrder: 0,
      },
      {
        code: "PHY",
        name: "Physics",
        hasPractical: true,
        isCompulsory: true,
        displayOrder: 1,
      },
      {
        code: "REL",
        name: "Religion",
        hasPractical: false,
        isCompulsory: false,
        displayOrder: 2,
      },
      {
        code: "AGR",
        name: "Agriculture",
        hasPractical: true,
        isCompulsory: false,
        displayOrder: 3,
      },
    ]);
  });

  it("rejects a duplicate subject code", () => {
    const input = buildCase({
      subjects: [
        { code: "BAN", name: "Bangla", practical: false },
        { code: "BAN", name: "Bangla again", practical: false },
        { code: "PHY", name: "Physics", practical: true },
        { code: "REL", name: "Religion", practical: false },
      ],
    });

    expect(() => normalizeCase(input)).toThrow(FixtureValidationError);
    expect(() => normalizeCase(input)).toThrow(/duplicate subject code "BAN"/);
  });

  it("rejects a compulsory subject missing from the subject list", () => {
    const input = buildCase({ compulsory: ["BAN", "PHY", "GONE"] });

    expect(() => normalizeCase(input)).toThrow(/compulsory subject "GONE"/);
  });
});

describe("normalizeCase — mark shapes", () => {
  it("stores a whole mark for a subject with no practical part", () => {
    const result = normalizeCase(buildCase());
    const ban = result.students[0]!.marks.find((m) => m.subjectCode === "BAN");

    expect(ban).toEqual({
      subjectCode: "BAN",
      isAbsent: false,
      wholeScore: 55,
      theoryScore: null,
      practicalScore: null,
    });
  });

  it("splits theory and practical for a subject with a practical part", () => {
    const result = normalizeCase(buildCase());
    const phy = result.students[0]!.marks.find((m) => m.subjectCode === "PHY");

    expect(phy).toEqual({
      subjectCode: "PHY",
      isAbsent: false,
      wholeScore: null,
      theoryScore: 60,
      practicalScore: 20,
    });
  });

  it("records absence with every score left null", () => {
    const input = caseWithMarks("REL", {
      BAN: "AB",
      PHY: { theory: 60, practical: 20 },
      REL: 70,
    });

    const ban = normalizeCase(input).students[0]!.marks.find(
      (m) => m.subjectCode === "BAN",
    );

    expect(ban).toEqual({
      subjectCode: "BAN",
      isAbsent: true,
      wholeScore: null,
      theoryScore: null,
      practicalScore: null,
    });
  });

  it("keeps a zero mark distinct from an absence", () => {
    const input = caseWithMarks("REL", {
      BAN: 0,
      PHY: { theory: 60, practical: 20 },
      REL: 70,
    });

    const zero = normalizeCase(input).students[0]!.marks.find(
      (m) => m.subjectCode === "BAN",
    );

    expect(zero).toEqual({
      subjectCode: "BAN",
      isAbsent: false,
      wholeScore: 0,
      theoryScore: null,
      practicalScore: null,
    });
    // The distinction the specification insists on.
    expect(zero!.isAbsent).toBe(false);
    expect(zero!.wholeScore).toBe(0);
  });

  it("records absence in a practical subject without inventing parts", () => {
    const input = caseWithMarks("REL", { BAN: 55, PHY: "AB", REL: 70 });

    const phy = normalizeCase(input).students[0]!.marks.find(
      (m) => m.subjectCode === "PHY",
    );

    expect(phy).toEqual({
      subjectCode: "PHY",
      isAbsent: true,
      wholeScore: null,
      theoryScore: null,
      practicalScore: null,
    });
  });

  it("rejects theory/practical marks on a subject with no practical part", () => {
    const input = caseWithMarks("REL", {
      BAN: { theory: 40, practical: 10 },
      PHY: { theory: 60, practical: 20 },
      REL: 70,
    });

    expect(() => normalizeCase(input)).toThrow(
      /"BAN" has no practical part but was given theory\/practical marks/,
    );
  });

  it("rejects a single whole mark on a subject with a practical part", () => {
    const input = caseWithMarks("REL", { BAN: 55, PHY: 80, REL: 70 });

    expect(() => normalizeCase(input)).toThrow(
      /"PHY" has a practical part but was given a single whole mark/,
    );
  });
});

describe("normalizeCase — student cross-references", () => {
  it("accepts a practical optional subject", () => {
    const input = caseWithMarks("AGR", {
      BAN: 55,
      PHY: { theory: 60, practical: 20 },
      AGR: { theory: 50, practical: 18 },
    });

    const result = normalizeCase(input);

    expect(result.students[0]!.optionalSubjectCode).toBe("AGR");
    expect(result.students[0]!.marks).toHaveLength(3);
  });

  it("rejects an optional subject that is not in the subject list", () => {
    const input = caseWithMarks("XXX", {
      BAN: 55,
      PHY: { theory: 60, practical: 20 },
      XXX: 70,
    });

    expect(() => normalizeCase(input)).toThrow(
      /optional subject "XXX" is not in the subject list/,
    );
  });

  it("rejects an optional subject that is also compulsory", () => {
    const input = caseWithMarks("BAN", {
      BAN: 55,
      PHY: { theory: 60, practical: 20 },
    });

    expect(() => normalizeCase(input)).toThrow(
      /optional subject "BAN" is also compulsory/,
    );
  });

  it("rejects a student missing a compulsory mark", () => {
    const input = caseWithMarks("REL", { BAN: 55, REL: 70 });

    expect(() => normalizeCase(input)).toThrow(/missing marks for PHY/);
  });

  it("rejects a student carrying a mark they should not have", () => {
    const input = caseWithMarks("REL", {
      BAN: 55,
      PHY: { theory: 60, practical: 20 },
      REL: 70,
      AGR: { theory: 50, practical: 18 },
    });

    expect(() => normalizeCase(input)).toThrow(/unexpected marks for AGR/);
  });

  it("rejects duplicate student ids", () => {
    const student = {
      id: "S001",
      name: "Test Student",
      class: "Class 9",
      optional: "REL",
      marks: { BAN: 55, PHY: { theory: 60, practical: 20 }, REL: 70 },
    };
    const input = buildCase({ students: [student, { ...student }] });

    expect(() => normalizeCase(input)).toThrow(/duplicate student id/);
  });

  it("names the offending case and student in the error", () => {
    const input = caseWithMarks("REL", { BAN: 55, REL: 70 });

    expect(() => normalizeCase(input)).toThrow(/TEST-01\/S001/);
  });
});

describe("normalizeCase — the bundled dataset", () => {
  const fixture = loadFixture();

  it("loads the three seeded cases", () => {
    expect(fixture.problem_id).toBe("P08");
    expect(fixture.cases.map((c) => c.case_id)).toEqual([
      "PUB-01",
      "PUB-02",
      "PUB-03",
    ]);
  });

  it("normalizes every case without a validation error", () => {
    for (const fixtureCase of fixture.cases) {
      expect(() => normalizeCase(fixtureCase)).not.toThrow();
    }
  });

  it("meets the problem's minimum of 60 students across two classes", () => {
    for (const fixtureCase of fixture.cases) {
      const result = normalizeCase(fixtureCase);
      const classes = new Set(result.students.map((s) => s.className));

      expect(result.students.length).toBeGreaterThanOrEqual(60);
      expect(classes.size).toBeGreaterThanOrEqual(2);
    }
  });

  it("gives every student exactly six compulsory subjects plus one optional", () => {
    for (const fixtureCase of fixture.cases) {
      const result = normalizeCase(fixtureCase);
      const compulsory = result.subjects.filter((s) => s.isCompulsory);

      expect(compulsory).toHaveLength(6);

      for (const student of result.students) {
        expect(student.marks).toHaveLength(7);

        const codes = new Set(student.marks.map((m) => m.subjectCode));
        expect(codes.size).toBe(7);
        for (const subject of compulsory) {
          expect(codes.has(subject.code)).toBe(true);
        }
        expect(codes.has(student.optionalSubjectCode)).toBe(true);
      }
    }
  });

  it("produces marks that always match their subject's practical-ness", () => {
    for (const fixtureCase of fixture.cases) {
      const result = normalizeCase(fixtureCase);
      const hasPracticalByCode = new Map(
        result.subjects.map((s) => [s.code, s.hasPractical]),
      );

      for (const student of result.students) {
        for (const mark of student.marks) {
          if (mark.isAbsent) {
            expect(mark.wholeScore).toBeNull();
            expect(mark.theoryScore).toBeNull();
            expect(mark.practicalScore).toBeNull();
            continue;
          }

          if (hasPracticalByCode.get(mark.subjectCode)) {
            expect(mark.theoryScore).not.toBeNull();
            expect(mark.practicalScore).not.toBeNull();
            expect(mark.wholeScore).toBeNull();
            expect(mark.theoryScore!).toBeGreaterThanOrEqual(0);
            expect(mark.theoryScore!).toBeLessThanOrEqual(75);
            expect(mark.practicalScore!).toBeGreaterThanOrEqual(0);
            expect(mark.practicalScore!).toBeLessThanOrEqual(25);
          } else {
            expect(mark.wholeScore).not.toBeNull();
            expect(mark.theoryScore).toBeNull();
            expect(mark.practicalScore).toBeNull();
            expect(mark.wholeScore!).toBeGreaterThanOrEqual(0);
            expect(mark.wholeScore!).toBeLessThanOrEqual(100);
          }
        }
      }
    }
  });

  it("contains both an absent mark and a genuine zero, kept distinct", () => {
    const all = fixture.cases.flatMap((c) =>
      normalizeCase(c).students.flatMap((s) => s.marks),
    );

    const absent = all.filter((m) => m.isAbsent);
    const genuineZero = all.filter((m) => !m.isAbsent && m.wholeScore === 0);

    expect(absent.length).toBeGreaterThan(0);
    expect(genuineZero.length).toBeGreaterThan(0);
    // Neither classification ever leaks into the other.
    expect(absent.every((m) => m.wholeScore === null)).toBe(true);
    expect(genuineZero.every((m) => m.isAbsent === false)).toBe(true);
  });
});
