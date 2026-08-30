import { describe, expect, it } from "vitest";

import { loadFixture } from "./fixture.js";
import { normalizeCase, type NormalizedCase } from "./normalize.js";
import {
  buildMarkRows,
  buildStudentRows,
  buildSubjectRows,
  SeedMappingError,
} from "./rows.js";

const SESSION_ID = "session-1";

const sampleCase: NormalizedCase = {
  caseId: "TEST-01",
  subjects: [
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
  ],
  students: [
    {
      rollNo: "S001",
      name: "Test Student",
      className: "Class 9",
      optionalSubjectCode: "REL",
      marks: [
        {
          subjectCode: "BAN",
          isAbsent: false,
          wholeScore: 55,
          theoryScore: null,
          practicalScore: null,
        },
        {
          subjectCode: "PHY",
          isAbsent: false,
          wholeScore: null,
          theoryScore: 60,
          practicalScore: 20,
        },
        {
          subjectCode: "REL",
          isAbsent: true,
          wholeScore: null,
          theoryScore: null,
          practicalScore: null,
        },
      ],
    },
  ],
};

const subjectIds = new Map([
  ["BAN", "subj-ban"],
  ["PHY", "subj-phy"],
  ["REL", "subj-rel"],
]);
const studentIds = new Map([["S001", "stu-1"]]);

describe("buildSubjectRows", () => {
  it("attaches the session id to every subject", () => {
    const rows = buildSubjectRows(SESSION_ID, sampleCase);

    expect(rows).toHaveLength(3);
    expect(rows.every((r) => r.sessionId === SESSION_ID)).toBe(true);
    expect(rows[0]).toEqual({
      sessionId: SESSION_ID,
      code: "BAN",
      name: "Bangla",
      hasPractical: false,
      isCompulsory: true,
      displayOrder: 0,
    });
  });
});

describe("buildStudentRows", () => {
  it("resolves the optional subject to its persisted id", () => {
    const rows = buildStudentRows(SESSION_ID, sampleCase, subjectIds);

    expect(rows).toEqual([
      {
        sessionId: SESSION_ID,
        rollNo: "S001",
        name: "Test Student",
        className: "Class 9",
        optionalSubjectId: "subj-rel",
      },
    ]);
  });

  it("fails loudly when the optional subject was not persisted", () => {
    const incomplete = new Map([["BAN", "subj-ban"]]);

    expect(() => buildStudentRows(SESSION_ID, sampleCase, incomplete)).toThrow(
      SeedMappingError,
    );
    expect(() => buildStudentRows(SESSION_ID, sampleCase, incomplete)).toThrow(
      /TEST-01\/S001: optional subject "REL" has no persisted id/,
    );
  });
});

describe("buildMarkRows", () => {
  it("resolves both foreign keys and preserves the mark shape", () => {
    const rows = buildMarkRows(sampleCase, subjectIds, studentIds);

    expect(rows).toEqual([
      {
        studentId: "stu-1",
        subjectId: "subj-ban",
        isAbsent: false,
        wholeScore: 55,
        theoryScore: null,
        practicalScore: null,
      },
      {
        studentId: "stu-1",
        subjectId: "subj-phy",
        isAbsent: false,
        wholeScore: null,
        theoryScore: 60,
        practicalScore: 20,
      },
      {
        studentId: "stu-1",
        subjectId: "subj-rel",
        isAbsent: true,
        wholeScore: null,
        theoryScore: null,
        practicalScore: null,
      },
    ]);
  });

  it("fails loudly when a student was not persisted", () => {
    expect(() => buildMarkRows(sampleCase, subjectIds, new Map())).toThrow(
      /TEST-01\/S001: student has no persisted id/,
    );
  });

  it("fails loudly when a subject was not persisted", () => {
    const incomplete = new Map([
      ["BAN", "subj-ban"],
      ["REL", "subj-rel"],
    ]);

    expect(() => buildMarkRows(sampleCase, incomplete, studentIds)).toThrow(
      /subject "PHY" has no persisted id/,
    );
  });
});

describe("row building over the bundled dataset", () => {
  const fixture = loadFixture();

  it("produces exactly seven mark rows per student, with resolvable ids", () => {
    for (const fixtureCase of fixture.cases) {
      const normalized = normalizeCase(fixtureCase);

      // Stand in for the ids the database would hand back.
      const subjIds = new Map(
        normalized.subjects.map((s) => [s.code, `subj-${s.code}`]),
      );
      const stuIds = new Map(
        normalized.students.map((s) => [s.rollNo, `stu-${s.rollNo}`]),
      );

      const subjectRows = buildSubjectRows(SESSION_ID, normalized);
      const studentRows = buildStudentRows(SESSION_ID, normalized, subjIds);
      const markRows = buildMarkRows(normalized, subjIds, stuIds);

      expect(subjectRows).toHaveLength(9);
      expect(studentRows).toHaveLength(normalized.students.length);
      expect(markRows).toHaveLength(normalized.students.length * 7);
    }
  });

  it("never emits a mark row that would violate the database check constraint", () => {
    for (const fixtureCase of fixture.cases) {
      const normalized = normalizeCase(fixtureCase);
      const subjIds = new Map(
        normalized.subjects.map((s) => [s.code, `subj-${s.code}`]),
      );
      const stuIds = new Map(
        normalized.students.map((s) => [s.rollNo, `stu-${s.rollNo}`]),
      );

      for (const row of buildMarkRows(normalized, subjIds, stuIds)) {
        const absentShape =
          row.isAbsent &&
          row.wholeScore === null &&
          row.theoryScore === null &&
          row.practicalScore === null;

        const wholeShape =
          !row.isAbsent &&
          row.wholeScore !== null &&
          row.wholeScore >= 0 &&
          row.wholeScore <= 100 &&
          row.theoryScore === null &&
          row.practicalScore === null;

        const splitShape =
          !row.isAbsent &&
          row.wholeScore === null &&
          row.theoryScore !== null &&
          row.theoryScore >= 0 &&
          row.theoryScore <= 75 &&
          row.practicalScore !== null &&
          row.practicalScore >= 0 &&
          row.practicalScore <= 25;

        expect(absentShape || wholeShape || splitShape).toBe(true);
      }
    }
  });

  it("keeps every student's optional subject pointing at a non-compulsory subject", () => {
    for (const fixtureCase of fixture.cases) {
      const normalized = normalizeCase(fixtureCase);
      const compulsoryCodes = new Set(
        normalized.subjects.filter((s) => s.isCompulsory).map((s) => s.code),
      );

      for (const student of normalized.students) {
        expect(compulsoryCodes.has(student.optionalSubjectCode)).toBe(false);
      }
    }
  });
});
