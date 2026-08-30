import { describe, expect, it } from "vitest";

import { toClassId } from "../config/dataset.js";
import { buildDataset } from "./datasetSerializer.js";

const SUBJECTS = [
  { code: "BAN", name: "Bangla", hasPractical: false, isCompulsory: true, displayOrder: 0 },
  { code: "PHY", name: "Physics", hasPractical: true, isCompulsory: true, displayOrder: 1 },
  { code: "REL", name: "Religion", hasPractical: false, isCompulsory: false, displayOrder: 2 },
];

function student(overrides: Partial<{
  id: string; rollNo: string; name: string; className: string;
}> = {}) {
  return {
    id: overrides.id ?? "row-1",
    rollNo: overrides.rollNo ?? "S007",
    name: overrides.name ?? "Test Student",
    className: overrides.className ?? "Class 9",
    optionalSubject: { code: "REL" },
    marks: [
      { isAbsent: false, wholeScore: 70, theoryScore: null, practicalScore: null, subject: { code: "BAN" } },
      { isAbsent: false, wholeScore: null, theoryScore: 60, practicalScore: 20, subject: { code: "PHY" } },
      { isAbsent: true, wholeScore: null, theoryScore: null, practicalScore: null, subject: { code: "REL" } },
    ],
  };
}

describe("toClassId", () => {
  it("slugifies a class name", () => {
    expect(toClassId("Class 9")).toBe("class-9");
    expect(toClassId("Class 10")).toBe("class-10");
  });
});

describe("buildDataset — shape", () => {
  it("produces meta, classes, subjects and students per the documented contract", () => {
    const dataset = buildDataset(SUBJECTS, [student()], "*");

    expect(dataset.meta.school).toBeTruthy();
    expect(dataset.meta.exam).toBeTruthy();
    expect(dataset.meta.session).toBeTruthy();
    expect(new Date(dataset.meta.generatedAt).toString()).not.toBe("Invalid Date");

    expect(dataset.classes).toEqual([{ id: "class-9", name: "Class 9", session: dataset.meta.session }]);
    expect(dataset.subjects).toEqual([
      { code: "BAN", name: "Bangla", hasPractical: false, kind: "compulsory" },
      { code: "PHY", name: "Physics", hasPractical: true, kind: "compulsory" },
      { code: "REL", name: "Religion", hasPractical: false, kind: "optional" },
    ]);
  });

  it("parses the numeric roll from the rollNo id", () => {
    const dataset = buildDataset(SUBJECTS, [student({ rollNo: "S007" })], "*");
    expect(dataset.students[0]!.roll).toBe(7);
  });

  it("maps a whole-mark subject to { theory, practical: null }", () => {
    const dataset = buildDataset(SUBJECTS, [student()], "*");
    const ban = dataset.students[0]!.marks.find((m) => m.code === "BAN")!;
    expect(ban).toEqual({ code: "BAN", theory: 70, practical: null });
  });

  it("maps a practical subject to { theory, practical }, both populated", () => {
    const dataset = buildDataset(SUBJECTS, [student()], "*");
    const phy = dataset.students[0]!.marks.find((m) => m.code === "PHY")!;
    expect(phy).toEqual({ code: "PHY", theory: 60, practical: 20 });
  });

  it("maps an absent mark to null theory/practical with absent: true, never a zero", () => {
    const dataset = buildDataset(SUBJECTS, [student()], "*");
    const rel = dataset.students[0]!.marks.find((m) => m.code === "REL")!;
    expect(rel).toEqual({ code: "REL", theory: null, practical: null, absent: true });
  });

  it("sets optionalCode from the student's optional subject relation", () => {
    const dataset = buildDataset(SUBJECTS, [student()], "*");
    expect(dataset.students[0]!.optionalCode).toBe("REL");
  });
});

describe("buildDataset — scope filtering", () => {
  const class9 = student({ id: "row-9", rollNo: "S001", className: "Class 9" });
  const class10 = student({ id: "row-10", rollNo: "S002", className: "Class 10" });

  it("includes every class when scope is '*'", () => {
    const dataset = buildDataset(SUBJECTS, [class9, class10], "*");
    expect(dataset.students).toHaveLength(2);
    expect(dataset.classes.map((c) => c.id).sort()).toEqual(["class-10", "class-9"]);
  });

  it("keeps only the matching class when scope is a classId", () => {
    const dataset = buildDataset(SUBJECTS, [class9, class10], "class-9");
    expect(dataset.students).toHaveLength(1);
    expect(dataset.students[0]!.id).toBe("row-9");
    expect(dataset.classes).toEqual([{ id: "class-9", name: "Class 9", session: dataset.meta.session }]);
  });

  it("returns an empty cohort for a scope that matches no student", () => {
    const dataset = buildDataset(SUBJECTS, [class9, class10], "class-11");
    expect(dataset.students).toEqual([]);
    expect(dataset.classes).toEqual([]);
  });
});
