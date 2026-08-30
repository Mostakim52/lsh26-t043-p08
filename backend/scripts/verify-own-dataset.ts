import { readFileSync } from "node:fs";

import { fixtureFileSchema } from "../src/db/fixture.js";
import { normalizeCase } from "../src/db/normalize.js";
import { computeCheckingLists } from "../src/grading/checkingLists.js";
import { computeStudentResult } from "../src/grading/engine.js";

// OWN-01 was merged into the shared cases.json alongside the official PUB-*
// cases (single source of truth for the seed script) - pull it out by id.
const raw = JSON.parse(readFileSync(new URL("../src/db/data/cases.json", import.meta.url), "utf-8"));
const fixtureFile = fixtureFileSchema.parse(raw);
const ownCase = fixtureFile.cases.find((c) => c.case_id === "OWN-01");
if (!ownCase) throw new Error("OWN-01 not found in cases.json");
const normalized = normalizeCase(ownCase);

const byRoll = new Map(normalized.students.map((s) => [s.rollNo, s]));
function resultFor(rollNo: string) {
  const student = byRoll.get(rollNo);
  if (!student) throw new Error(`missing ${rollNo}`);
  return computeStudentResult(student, normalized.subjects);
}

const allResults = normalized.students.map((s) => computeStudentResult(s, normalized.subjects));
const lists = computeCheckingLists(allResults);

let failures = 0;
function assertEq(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`  ${ok ? "OK" : "FAIL"}: ${label} (expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)})`);
  if (!ok) failures++;
}
function assertTrue(label: string, cond: boolean) {
  console.log(`  ${cond ? "OK" : "FAIL"}: ${label}`);
  if (!cond) failures++;
}

console.log("S001 - absence cancels a strong average:");
{
  const r = resultFor("S001");
  assertTrue("overall fail", r.isOverallFail);
  assertEq("failure subject", r.failureSubjectCodes, ["BIO"]);
  assertTrue("uncancelled average is high (>3.5)", r.uncancelledAverage > 3.5);
  assertEq("official GPA", r.officialGpa, 0);
}

console.log("\nS002 - genuine zero, not absent:");
{
  const r = resultFor("S002");
  const mat = r.compulsoryResults.find((x) => x.subjectCode === "MAT")!;
  assertTrue("MAT not absent", !mat.isAbsent);
  assertEq("MAT wholeScore", mat.wholeScore, 0);
  assertTrue("overall fail", r.isOverallFail);
}

console.log("\nS003 - practical fail, passing theory:");
{
  const r = resultFor("S003");
  const phy = r.compulsoryResults.find((x) => x.subjectCode === "PHY")!;
  assertEq("PHY grade point", phy.gradePoint, 0);
  assertTrue("rule cites practical", phy.rule.includes("practical 5 < 8"));
  assertTrue("rule does not cite theory failing", !phy.rule.includes("theory 55"));
}

console.log("\nS004 - theory fail, passing practical:");
{
  const r = resultFor("S004");
  const che = r.compulsoryResults.find((x) => x.subjectCode === "CHE")!;
  assertEq("CHE grade point", che.gradePoint, 0);
  assertTrue("rule cites theory", che.rule.includes("theory 20 < 25"));
}

console.log("\nS005 - optional grade point exactly 2.00:");
{
  const r = resultFor("S005");
  assertEq("optional grade point", r.optionalResult.gradePoint, 2.0);
  assertTrue("on optional checking list", lists.optionalConcern.includes("S005"));
  assertTrue("not overall fail (compulsory all pass)", !r.isOverallFail);
}

console.log("\nS006 - absent optional:");
{
  const r = resultFor("S006");
  assertEq("optional grade point", r.optionalResult.gradePoint, 0);
  assertTrue("optional is absent", r.optionalResult.isAbsent);
  assertTrue("on absent list", lists.absent.includes("S006"));
  assertTrue("on optional checking list", lists.optionalConcern.includes("S006"));
}

console.log("\nS007 - absent compulsory AND optional at once:");
{
  const r = resultFor("S007");
  assertTrue("overall fail (ENG absent)", r.isOverallFail);
  assertEq("failure subjects", r.failureSubjectCodes, ["ENG"]);
  assertTrue("optional (REL) also absent", r.optionalResult.isAbsent);
  assertTrue("on absent list", lists.absent.includes("S007"));
  assertTrue("on optional checking list", lists.optionalConcern.includes("S007"));
}

console.log("\nS008 - every band + exact 25/8 boundary:");
{
  const r = resultFor("S008");
  const byCode = Object.fromEntries(r.compulsoryResults.map((x) => [x.subjectCode, x.gradePoint]));
  assertEq("BAN (80+)", byCode.BAN, 5.0);
  assertEq("ENG (70-79)", byCode.ENG, 4.0);
  assertEq("MAT (60-69)", byCode.MAT, 3.5);
  assertEq("PHY (50-59 via 40+10=50)", byCode.PHY, 3.0);
  assertEq("CHE (40-49 via 30+10)", byCode.CHE, 2.0);
  assertEq("BIO (33-39 via exact 25/8 boundary)", byCode.BIO, 1.0);
  const bio = r.compulsoryResults.find((x) => x.subjectCode === "BIO")!;
  assertTrue("BIO passes at exactly the boundary, not fails", bio.gradePoint > 0);
}

console.log("\nS008 - explicit all-six-bands-covered check:");
{
  const r = resultFor("S008");
  const bands = r.compulsoryResults.map((x) => x.gradePoint).sort((a, b) => a - b);
  assertEq("six distinct bands, sorted", bands, [1.0, 2.0, 3.0, 3.5, 4.0, 5.0]);
}

console.log("\nS009 - GPA cap at 5.00:");
{
  const r = resultFor("S009");
  assertEq("official GPA capped", r.officialGpa, 5.0);
  assertEq("letter grade", r.letterGrade, "A+");
}

console.log("\nS010 - two independent compulsory failures:");
{
  const r = resultFor("S010");
  assertEq("failure subjects (both named)", r.failureSubjectCodes.sort(), ["BAN", "MAT"]);
}

console.log("\nS011 - theory and practical both fail, same subject:");
{
  const r = resultFor("S011");
  const che = r.compulsoryResults.find((x) => x.subjectCode === "CHE")!;
  assertTrue("rule cites theory", che.rule.includes("theory 15 < 25"));
  assertTrue("rule cites practical", che.rule.includes("practical 3 < 8"));
}

console.log("\nS012 - every compulsory at exactly 33 (minimum pass), GPA exactly 1.00:");
{
  const r = resultFor("S012");
  assertTrue("no compulsory failure (33 passes)", !r.isOverallFail);
  assertEq("official GPA", r.officialGpa, 1.0);
  assertEq("letter grade", r.letterGrade, "D");
}

console.log("\nS013 - practical fail inside the optional subject:");
{
  const r = resultFor("S013");
  assertEq("optional grade point", r.optionalResult.gradePoint, 0);
  assertTrue("on optional checking list", lists.optionalConcern.includes("S013"));
  assertTrue("on practical-fail checking list", lists.practicalFail.includes("S013"));
}

console.log("\nS014 - clean baseline, zero flags:");
{
  const r = resultFor("S014");
  assertTrue("not overall fail", !r.isOverallFail);
  assertTrue("not on absent list", !lists.absent.includes("S014"));
  assertTrue("not on practical-fail list", !lists.practicalFail.includes("S014"));
  assertTrue("not on optional-concern list", !lists.optionalConcern.includes("S014"));
}

console.log("\nS015 - GPA exactly 3.50 (A-/B boundary):");
{
  const r = resultFor("S015");
  assertEq("official GPA", r.officialGpa, 3.5);
  assertEq("letter grade", r.letterGrade, "A-");
}

console.log("\nWhole-dataset sanity:");
assertTrue("60 students total", normalized.students.length === 60);
assertTrue("both classes present", new Set(normalized.students.map((s) => s.className)).size === 2);
assertTrue("at least 8 students carry a checking-list flag or failure (hard-edge requirement)",
  allResults.filter((r) => r.isOverallFail || lists.optionalConcern.includes(r.rollNo) || lists.practicalFail.includes(r.rollNo) || lists.absent.includes(r.rollNo)).length >= 8);

console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`);
process.exitCode = failures === 0 ? 0 : 1;
