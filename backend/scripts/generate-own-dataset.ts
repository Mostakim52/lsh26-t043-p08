/**
 * Generates our own 60-student P08 dataset, in the exact schema documented
 * by P08_school_results_public.json, per the problem statement's own
 * instruction: "Create at least 60 students across two classes... Include
 * at least eight students who land on a hard edge."
 *
 * 15 students are hand-authored, each engineered to exercise one specific
 * rule from the published clarifications (R-10..R-29) precisely - see the
 * inline comment on each. The remaining 45 are generated with a seeded PRNG
 * for a realistic, reproducible bulk cohort.
 *
 * Run: npx tsx scripts/generate-own-dataset.ts
 * Output: src/db/data/own-cases.json (validated against fixtureFileSchema
 * and normalizeCase before being written, so a malformed generator can
 * never produce a file the ingestion pipeline would reject).
 */
import { writeFileSync } from "node:fs";

import { fixtureFileSchema, type FixtureCase, type FixtureMark, type FixtureStudent } from "../src/db/fixture.js";
import { normalizeCase } from "../src/db/normalize.js";

const SUBJECTS = [
  { code: "BAN", name: "Bangla", practical: false },
  { code: "ENG", name: "English", practical: false },
  { code: "MAT", name: "Mathematics", practical: false },
  { code: "PHY", name: "Physics", practical: true },
  { code: "CHE", name: "Chemistry", practical: true },
  { code: "BIO", name: "Biology", practical: true },
  { code: "HMT", name: "Higher Mathematics", practical: true },
  { code: "AGR", name: "Agriculture", practical: true },
  { code: "REL", name: "Religion", practical: false },
];
const COMPULSORY = ["BAN", "ENG", "MAT", "PHY", "CHE", "BIO"];

function whole(mark: number): FixtureMark {
  return mark;
}
function split(theory: number, practical: number): FixtureMark {
  return { theory, practical };
}
const AB = "AB" as const;

interface StudentSpec {
  id: string;
  name: string;
  class: string;
  optional: string;
  marks: Record<string, FixtureMark>;
  /** Not part of the fixture schema - documents intent, stripped before writing. */
  demonstrates: string;
}

// ---------------------------------------------------------------------------
// 15 hand-authored edge-case students (well above the "at least eight" ask).
// ---------------------------------------------------------------------------
const HANDCRAFTED: StudentSpec[] = [
  {
    id: "S001", name: "Rafiq Islam", class: "Class 9", optional: "HMT",
    demonstrates: "R-12: absence in a compulsory subject cancels an otherwise strong average",
    marks: { BAN: whole(78), ENG: whole(82), MAT: whole(75), PHY: split(62, 21), CHE: split(58, 20), BIO: AB, HMT: split(60, 20) },
  },
  {
    id: "S002", name: "Sumaiya Akter", class: "Class 9", optional: "AGR",
    demonstrates: "A genuine zero (not absent) fails the subject exactly like a low mark, but must never look like AB",
    marks: { BAN: whole(76), ENG: whole(80), MAT: whole(0), PHY: split(60, 20), CHE: split(55, 19), BIO: split(62, 21), AGR: split(58, 20) },
  },
  {
    id: "S003", name: "Tanvir Hasan", class: "Class 9", optional: "REL",
    demonstrates: "R-11: practical fail (5 < 8) fails the subject despite a comfortably passing theory mark",
    marks: { BAN: whole(65), ENG: whole(70), MAT: whole(68), PHY: split(55, 5), CHE: split(50, 18), BIO: split(52, 17), REL: whole(60) },
  },
  {
    id: "S004", name: "Farhana Begum", class: "Class 9", optional: "AGR",
    demonstrates: "R-11 mirror case: theory fail (20 < 25) fails the subject despite a passing practical mark",
    marks: { BAN: whole(60), ENG: whole(65), MAT: whole(62), PHY: split(50, 18), CHE: split(20, 15), BIO: split(55, 16), AGR: split(48, 16) },
  },
  {
    id: "S005", name: "Rakibul Karim", class: "Class 9", optional: "REL",
    demonstrates: "R-29: optional grade point exactly 2.00 - contributes nothing, lands on the optional checking list",
    marks: { BAN: whole(70), ENG: whole(68), MAT: whole(66), PHY: split(52, 17), CHE: split(54, 18), BIO: split(50, 16), REL: whole(45) },
  },
  {
    id: "S006", name: "Nusrat Jahan", class: "Class 9", optional: "HMT",
    demonstrates: "R-12: an absent optional subject contributes 0 and lands on the optional checking list",
    marks: { BAN: whole(72), ENG: whole(69), MAT: whole(70), PHY: split(56, 19), CHE: split(53, 18), BIO: split(57, 19), HMT: AB },
  },
  {
    id: "S007", name: "Shakil Ahmed", class: "Class 9", optional: "REL",
    demonstrates: "AB in a compulsory AND the optional subject at once - both absent flags, one student, two list memberships",
    marks: { BAN: whole(65), ENG: AB, MAT: whole(60), PHY: split(48, 16), CHE: split(45, 15), BIO: split(50, 16), REL: AB },
  },
  {
    id: "S008", name: "Mim Sultana", class: "Class 9", optional: "HMT",
    demonstrates: "Every grade band hit exactly once across the six compulsory subjects, plus the exact 25/8 pass-mark boundaries on BIO",
    marks: { BAN: whole(80), ENG: whole(70), MAT: whole(60), PHY: split(40, 10), CHE: split(30, 10), BIO: split(25, 8), HMT: split(40, 10) },
  },
  {
    id: "S009", name: "Imran Hossain", class: "Class 9", optional: "AGR",
    demonstrates: "R-13: GPA formula's raw result (5.5) exceeds the cap - officialGpa must clamp to exactly 5.00",
    marks: { BAN: whole(90), ENG: whole(95), MAT: whole(88), PHY: split(65, 23), CHE: split(68, 22), BIO: split(70, 24), AGR: split(60, 23) },
  },
  {
    id: "S010", name: "Taslima Khatun", class: "Class 10", optional: "REL",
    demonstrates: "Two independent compulsory failures (AB + genuine zero) at once - trace must name both",
    marks: { BAN: AB, ENG: whole(75), MAT: whole(0), PHY: split(50, 18), CHE: split(48, 16), BIO: split(52, 17), REL: whole(55) },
  },
  {
    id: "S011", name: "Zahidul Islam", class: "Class 10", optional: "HMT",
    demonstrates: "R-11: theory AND practical both fail in the same subject - rule message must cite both reasons",
    marks: { BAN: whole(60), ENG: whole(62), MAT: whole(58), PHY: split(50, 17), CHE: split(15, 3), BIO: split(48, 15), HMT: split(40, 12) },
  },
  {
    id: "S012", name: "Ayesha Siddika", class: "Class 10", optional: "AGR",
    demonstrates: "Every compulsory subject at exactly the minimum passing mark (33) - GPA exactly 1.00, the D floor",
    marks: { BAN: whole(33), ENG: whole(33), MAT: whole(33), PHY: split(25, 8), CHE: split(25, 8), BIO: split(25, 8), AGR: split(25, 8) },
  },
  {
    id: "S013", name: "Mahfuzur Rahman", class: "Class 10", optional: "HMT",
    demonstrates: "Practical fail inside the OPTIONAL subject itself - appears on both the optional-concern and practical-fail lists",
    marks: { BAN: whole(70), ENG: whole(68), MAT: whole(66), PHY: split(55, 18), CHE: split(52, 17), BIO: split(50, 16), HMT: split(50, 5) },
  },
  {
    id: "S014", name: "Rummana Akter", class: "Class 10", optional: "REL",
    demonstrates: "Clean high-achieving baseline - zero checking-list flags, for contrast against the edge cases",
    marks: { BAN: whole(85), ENG: whole(88), MAT: whole(84), PHY: split(60, 22), CHE: split(58, 21), BIO: split(62, 23), REL: whole(78) },
  },
  {
    id: "S015", name: "Delwar Hossain", class: "Class 10", optional: "REL",
    demonstrates: "R-10: GPA lands on exactly 3.50, the A-/B letter-grade boundary",
    marks: { BAN: whole(65), ENG: whole(62), MAT: whole(68), PHY: split(45, 20), CHE: split(44, 21), BIO: split(43, 22), REL: whole(45) },
  },
];

// ---------------------------------------------------------------------------
// 45 generated students - seeded PRNG for a reproducible bulk cohort.
// ---------------------------------------------------------------------------
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(20260830);
const randInt = (min: number, max: number) => Math.floor(rng() * (max - min + 1)) + min;
const pick = <T,>(arr: T[]): T => arr[randInt(0, arr.length - 1)]!;

const FIRST_NAMES = [
  "Arif", "Kamal", "Rafi", "Hasib", "Omar", "Emon", "Chandan", "Tanvir", "Sadia", "Lamia",
  "Urmi", "Bithi", "Nusrat", "Jui", "Dipa", "Gias", "Farzana", "Sumon", "Rubel", "Nasir",
  "Meherun", "Shahana", "Kabir", "Faruk", "Anisur",
];
const LAST_NAMES = ["Islam", "Begum", "Akter", "Rahman", "Hossain", "Karim", "Khatun", "Das", "Ahmed", "Sultana"];

function randomMark(hasPractical: boolean, failChance: number, absentChance: number): FixtureMark {
  if (rng() < absentChance) return AB;
  const fails = rng() < failChance;
  if (hasPractical) {
    const theory = fails && rng() < 0.5 ? randInt(6, 24) : randInt(25, 75);
    const practical = fails && rng() >= 0.5 ? randInt(1, 7) : randInt(8, 25);
    return split(theory, practical);
  }
  return whole(fails ? randInt(0, 32) : randInt(33, 100));
}

const GENERATED: StudentSpec[] = Array.from({ length: 45 }, (_, i) => {
  const n = i + 16; // continue numbering after the 15 handcrafted
  // Handcrafted are 9x Class 9 (S001-S009) + 6x Class 10 (S010-S015); split
  // the 45 generated as 21/24 so the full 60 lands close to an even 30/30.
  const className = n <= 36 ? "Class 9" : "Class 10";
  const optional = pick(["HMT", "AGR", "REL"]);
  const optionalHasPractical = optional !== "REL";
  const marks: Record<string, FixtureMark> = {};
  for (const code of COMPULSORY) {
    const subject = SUBJECTS.find((s) => s.code === code)!;
    marks[code] = randomMark(subject.practical, 0.12, 0.03);
  }
  marks[optional] = randomMark(optionalHasPractical, 0.15, 0.05);
  return {
    id: `S${String(n).padStart(3, "0")}`,
    name: `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`,
    class: className,
    optional,
    marks,
    demonstrates: "generated bulk cohort",
  };
});

const ALL_STUDENTS: StudentSpec[] = [...HANDCRAFTED, ...GENERATED];

// Sanity: exactly 60, ids unique, both classes present.
if (ALL_STUDENTS.length !== 60) throw new Error(`expected 60 students, got ${ALL_STUDENTS.length}`);
const ids = new Set(ALL_STUDENTS.map((s) => s.id));
if (ids.size !== 60) throw new Error("duplicate student id");

const fixtureCase: FixtureCase = {
  case_id: "OWN-01",
  subjects: SUBJECTS,
  compulsory: COMPULSORY,
  students: ALL_STUDENTS.map(
    ({ id, name, class: className, optional, marks }): FixtureStudent => ({
      id,
      name,
      class: className,
      optional,
      marks,
    }),
  ),
};

const fixtureFile = {
  schema_version: "2.1",
  problem_id: "P08",
  cases: [fixtureCase],
};

// Validate against the exact same pipeline the real seed uses - a malformed
// generator fails here, loudly, before ever touching the database.
const parsed = fixtureFileSchema.parse(fixtureFile);
const normalized = normalizeCase(parsed.cases[0]!);
console.log(`Validated: ${normalized.students.length} students, ${normalized.subjects.length} subjects`);
console.log(`Classes: ${[...new Set(normalized.students.map((s) => s.className))].join(", ")}`);

const outPath = new URL("../src/db/data/own-cases.json", import.meta.url);
writeFileSync(outPath, JSON.stringify(fixtureFile, null, 2) + "\n", "utf-8");
console.log(`Written to ${outPath.pathname}`);

console.log("\nHand-authored edge cases:");
for (const s of HANDCRAFTED) {
  console.log(`  ${s.id} (${s.name}): ${s.demonstrates}`);
}
