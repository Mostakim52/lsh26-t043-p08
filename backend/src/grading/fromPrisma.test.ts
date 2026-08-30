import { describe, expect, it } from "vitest";

import { toNormalizedStudent, toNormalizedSubject } from "./fromPrisma.js";

describe("toNormalizedSubject", () => {
  it("maps every field 1:1", () => {
    const result = toNormalizedSubject({
      code: "PHY",
      name: "Physics",
      hasPractical: true,
      isCompulsory: true,
      displayOrder: 3,
    });

    expect(result).toEqual({
      code: "PHY",
      name: "Physics",
      hasPractical: true,
      isCompulsory: true,
      displayOrder: 3,
    });
  });
});

describe("toNormalizedStudent", () => {
  it("resolves optionalSubjectCode from the nested optionalSubject relation", () => {
    const result = toNormalizedStudent({
      rollNo: "S001",
      name: "Test Student",
      className: "Class 9",
      optionalSubject: { code: "REL" },
      marks: [],
    });

    expect(result.optionalSubjectCode).toBe("REL");
  });

  it("flattens the subject relation on each mark down to a subjectCode", () => {
    const result = toNormalizedStudent({
      rollNo: "S001",
      name: "Test Student",
      className: "Class 9",
      optionalSubject: { code: "REL" },
      marks: [
        {
          isAbsent: false,
          wholeScore: 55,
          theoryScore: null,
          practicalScore: null,
          subject: { code: "BAN" },
        },
        {
          isAbsent: false,
          wholeScore: null,
          theoryScore: 60,
          practicalScore: 20,
          subject: { code: "PHY" },
        },
      ],
    });

    expect(result.marks).toEqual([
      { subjectCode: "BAN", isAbsent: false, wholeScore: 55, theoryScore: null, practicalScore: null },
      { subjectCode: "PHY", isAbsent: false, wholeScore: null, theoryScore: 60, practicalScore: 20 },
    ]);
  });

  it("preserves an absent mark's null scores through the mapping", () => {
    const result = toNormalizedStudent({
      rollNo: "S001",
      name: "Test Student",
      className: "Class 9",
      optionalSubject: { code: "REL" },
      marks: [
        {
          isAbsent: true,
          wholeScore: null,
          theoryScore: null,
          practicalScore: null,
          subject: { code: "BIO" },
        },
      ],
    });

    expect(result.marks[0]).toEqual({
      subjectCode: "BIO",
      isAbsent: true,
      wholeScore: null,
      theoryScore: null,
      practicalScore: null,
    });
  });
});
