import { describe, expect, it } from "vitest";

import { buildResultsCsv, parseCsvText, parseMarksCsv, type CsvRow } from "./csv.js";

const SUBJECTS = [
  { code: "BAN", name: "Bangla", hasPractical: false, isCompulsory: true, displayOrder: 0 },
  { code: "PHY", name: "Physics", hasPractical: true, isCompulsory: true, displayOrder: 1 },
  { code: "REL", name: "Religion", hasPractical: false, isCompulsory: false, displayOrder: 2 },
  { code: "HMT", name: "Higher Mathematics", hasPractical: true, isCompulsory: false, displayOrder: 3 },
];
const COMPULSORY = ["BAN", "PHY"];

describe("parseCsvText", () => {
  it("splits a simple comma-separated table", () => {
    expect(parseCsvText("a,b,c\n1,2,3")).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
  });

  it("handles a quoted field containing a comma", () => {
    expect(parseCsvText('a,b\n"Islam, Md.",2')).toEqual([
      ["a", "b"],
      ["Islam, Md.", "2"],
    ]);
  });

  it("handles an escaped quote inside a quoted field", () => {
    expect(parseCsvText('a\n"She said ""hi"""')).toEqual([["a"], ['She said "hi"']]);
  });

  it("ignores a trailing blank line", () => {
    expect(parseCsvText("a,b\n1,2\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });
});

describe("buildResultsCsv / parseMarksCsv round trip", () => {
  const rows: CsvRow[] = [
    {
      roll: "S001", name: "Rafiq Islam", className: "Class 9", optionalCode: "REL",
      marks: { BAN: { whole: 70 }, PHY: { theory: 60, practical: 20 }, REL: { whole: 55 } },
    },
    {
      roll: "S002", name: "Sumaiya Akter", className: "Class 9", optionalCode: "HMT",
      marks: { BAN: { absent: true }, PHY: { theory: 50, practical: 18 }, HMT: { theory: 40, practical: 15 } },
    },
  ];

  it("round-trips: export then import produces the same marks", () => {
    const csv = buildResultsCsv(SUBJECTS, rows);
    const { rows: parsed, errors } = parseMarksCsv(csv, SUBJECTS, COMPULSORY);

    expect(errors).toEqual([]);
    expect(parsed).toHaveLength(2);

    const s001 = parsed.find((r) => r.roll === "S001")!;
    expect(s001.marks).toEqual([
      { subjectCode: "BAN", isAbsent: false, wholeScore: 70, theoryScore: null, practicalScore: null },
      { subjectCode: "PHY", isAbsent: false, wholeScore: null, theoryScore: 60, practicalScore: 20 },
      { subjectCode: "REL", isAbsent: false, wholeScore: 55, theoryScore: null, practicalScore: null },
    ]);

    const s002 = parsed.find((r) => r.roll === "S002")!;
    const ban = s002.marks.find((m) => m.subjectCode === "BAN")!;
    expect(ban).toEqual({ subjectCode: "BAN", isAbsent: true, wholeScore: null, theoryScore: null, practicalScore: null });
  });

  it("leaves the unused optional subject's columns blank in the export", () => {
    const csv = buildResultsCsv(SUBJECTS, rows);
    const lines = csv.trim().split("\r\n");
    const header = lines[0]!.split(",");
    const s001Line = lines[1]!.split(",");
    // S001 picked REL, so HMT_theory/HMT_practical should be blank for that row.
    const hmtTheoryIdx = header.indexOf("HMT_theory");
    expect(s001Line[hmtTheoryIdx]).toBe("");
  });
});

describe("parseMarksCsv — validation", () => {
  function csvWith(rows: string[]): string {
    return [
      "roll,name,class,optional,BAN,PHY_theory,PHY_practical,REL,HMT_theory,HMT_practical",
      ...rows,
    ].join("\n");
  }

  it("accepts AB in place of a whole-mark subject", () => {
    const { rows, errors } = parseMarksCsv(
      csvWith(["S001,Test,Class 9,REL,AB,60,20,55,,"]),
      SUBJECTS,
      COMPULSORY,
    );
    expect(errors).toEqual([]);
    const ban = rows[0]!.marks.find((m) => m.subjectCode === "BAN")!;
    expect(ban.isAbsent).toBe(true);
  });

  it("accepts AB in either half of a practical subject", () => {
    const { rows, errors } = parseMarksCsv(
      csvWith(["S001,Test,Class 9,REL,70,AB,20,55,,"]),
      SUBJECTS,
      COMPULSORY,
    );
    expect(errors).toEqual([]);
    const phy = rows[0]!.marks.find((m) => m.subjectCode === "PHY")!;
    expect(phy.isAbsent).toBe(true);
  });

  it("rejects a theory mark outside 0-75, naming the row and reason", () => {
    const { rows, errors } = parseMarksCsv(
      csvWith(["S001,Test,Class 9,REL,70,80,20,55,,"]),
      SUBJECTS,
      COMPULSORY,
    );
    expect(rows).toEqual([]);
    expect(errors).toEqual([{ row: 2, reason: 'PHY_theory must be an integer 0-75, got "80"' }]);
  });

  it("rejects a practical mark outside 0-25", () => {
    const { errors } = parseMarksCsv(
      csvWith(["S001,Test,Class 9,REL,70,60,30,55,,"]),
      SUBJECTS,
      COMPULSORY,
    );
    expect(errors).toEqual([{ row: 2, reason: 'PHY_practical must be an integer 0-25, got "30"' }]);
  });

  it("rejects an unknown optional subject code", () => {
    const { errors } = parseMarksCsv(
      csvWith(["S001,Test,Class 9,XYZ,70,60,20,,,,"]),
      SUBJECTS,
      COMPULSORY,
    );
    expect(errors).toEqual([{ row: 2, reason: 'unknown optional subject code "XYZ"' }]);
  });

  it("rejects picking a compulsory subject as the optional one", () => {
    const { errors } = parseMarksCsv(
      csvWith(["S001,Test,Class 9,BAN,70,60,20,,,,"]),
      SUBJECTS,
      COMPULSORY,
    );
    expect(errors).toEqual([{ row: 2, reason: '"BAN" is compulsory, not a valid optional pick' }]);
  });

  it("rejects a row missing required identity fields", () => {
    const { errors } = parseMarksCsv(csvWith([",Test,Class 9,REL,70,60,20,55,,"]), SUBJECTS, COMPULSORY);
    expect(errors).toEqual([{ row: 2, reason: "roll, name, class and optional are all required" }]);
  });

  it("keeps processing later rows after an earlier row is rejected", () => {
    const { rows, errors } = parseMarksCsv(
      csvWith(["S001,Bad,Class 9,REL,70,999,20,55,,", "S002,Good,Class 9,REL,70,60,20,55,,"]),
      SUBJECTS,
      COMPULSORY,
    );
    expect(errors).toHaveLength(1);
    expect(errors[0]!.row).toBe(2);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.roll).toBe("S002");
  });

  it("reports an empty file as an error, not a silent success", () => {
    const { rows, errors } = parseMarksCsv("", SUBJECTS, COMPULSORY);
    expect(rows).toEqual([]);
    expect(errors).toEqual([{ row: 0, reason: "empty file" }]);
  });
});
