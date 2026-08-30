/**
 * CSV round-trip for marks: GET /export/results.csv produces exactly the
 * format POST /import accepts back, so "download, edit in Excel, re-upload"
 * actually works.
 *
 * Column scheme (fixed per session's 9 subjects - see CLAUDE.md's own
 * subject list): roll, name, class, optional, then one column per
 * non-practical subject and two columns (theory/practical) per practical
 * subject. A student only fills the two optional-subject columns matching
 * their own pick; the other two optional subjects' columns are blank for
 * that row. "AB" in any mark column means absent, exactly like the
 * underlying JSON fixture format.
 */
import type { PrismaSubjectLike } from "../grading/fromPrisma.js";

export interface CsvRow {
  roll: string;
  name: string;
  className: string;
  optionalCode: string;
  marks: Record<string, { theory?: number; practical?: number; whole?: number; absent?: boolean }>;
}

function csvField(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function buildResultsCsv(subjects: PrismaSubjectLike[], rows: CsvRow[]): string {
  const ordered = [...subjects].sort((a, b) => a.displayOrder - b.displayOrder);
  const headerCols = ["roll", "name", "class", "optional"];
  for (const s of ordered) {
    if (s.hasPractical) headerCols.push(`${s.code}_theory`, `${s.code}_practical`);
    else headerCols.push(s.code);
  }

  const lines = [headerCols.join(",")];
  for (const row of rows) {
    const cols = [row.roll, row.name, row.className, row.optionalCode];
    for (const s of ordered) {
      const mark = row.marks[s.code];
      if (s.hasPractical) {
        if (!mark) {
          cols.push("", "");
        } else if (mark.absent) {
          cols.push("AB", "AB");
        } else {
          cols.push(String(mark.theory ?? ""), String(mark.practical ?? ""));
        }
      } else {
        if (!mark) cols.push("");
        else if (mark.absent) cols.push("AB");
        else cols.push(String(mark.whole ?? ""));
      }
    }
    lines.push(cols.map(csvField).join(","));
  }
  return lines.join("\r\n") + "\r\n";
}

/** Minimal RFC4180 line splitter - handles quoted fields containing commas/newlines/escaped quotes. */
export function parseCsvText(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const chars = text.replace(/\r\n/g, "\n");

  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];
    if (inQuotes) {
      if (c === '"') {
        if (chars[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => !(r.length === 1 && r[0] === ""));
}

export interface ImportRowError {
  row: number;
  reason: string;
}

export interface ImportedStudentRow {
  row: number;
  roll: string;
  name: string;
  className: string;
  optionalCode: string;
  marks: Array<{
    subjectCode: string;
    isAbsent: boolean;
    wholeScore: number | null;
    theoryScore: number | null;
    practicalScore: number | null;
  }>;
}

/**
 * Parses and validates uploaded CSV text against the session's actual
 * subjects. Every row is checked independently - one bad row does not
 * abort the rest, matching the bonus feature's own framing: "report which
 * rows were rejected and exactly why."
 */
export function parseMarksCsv(
  text: string,
  subjects: PrismaSubjectLike[],
  compulsoryCodes: string[],
): { rows: ImportedStudentRow[]; errors: ImportRowError[] } {
  const table = parseCsvText(text);
  if (table.length === 0) return { rows: [], errors: [{ row: 0, reason: "empty file" }] };

  const header = table[0]!.map((h) => h.trim());
  const subjectByCode = new Map(subjects.map((s) => [s.code, s]));
  const rows: ImportedStudentRow[] = [];
  const errors: ImportRowError[] = [];

  for (let i = 1; i < table.length; i++) {
    const line = table[i]!;
    const rowNum = i + 1; // 1-indexed with header as row 1, matching what a spreadsheet shows
    const get = (col: string): string | undefined => {
      const idx = header.indexOf(col);
      return idx === -1 ? undefined : line[idx]?.trim();
    };

    const roll = get("roll");
    const name = get("name");
    const className = get("class");
    const optionalCode = get("optional");

    if (!roll || !name || !className || !optionalCode) {
      errors.push({ row: rowNum, reason: "roll, name, class and optional are all required" });
      continue;
    }
    const optionalSubject = subjectByCode.get(optionalCode);
    if (!optionalSubject) {
      errors.push({ row: rowNum, reason: `unknown optional subject code "${optionalCode}"` });
      continue;
    }
    if (compulsoryCodes.includes(optionalCode)) {
      errors.push({ row: rowNum, reason: `"${optionalCode}" is compulsory, not a valid optional pick` });
      continue;
    }

    const expectedCodes = [...compulsoryCodes, optionalCode];
    const marks: ImportedStudentRow["marks"] = [];
    let rowFailed = false;

    for (const code of expectedCodes) {
      const subject = subjectByCode.get(code)!;
      if (subject.hasPractical) {
        const theoryRaw = get(`${code}_theory`);
        const practicalRaw = get(`${code}_practical`);
        if (theoryRaw === "AB" || practicalRaw === "AB") {
          marks.push({ subjectCode: code, isAbsent: true, wholeScore: null, theoryScore: null, practicalScore: null });
          continue;
        }
        const theory = Number(theoryRaw);
        const practical = Number(practicalRaw);
        if (theoryRaw === undefined || practicalRaw === undefined || theoryRaw === "" || practicalRaw === "") {
          errors.push({ row: rowNum, reason: `${code}: theory and practical marks are both required` });
          rowFailed = true;
          break;
        }
        if (!Number.isInteger(theory) || theory < 0 || theory > 75) {
          errors.push({ row: rowNum, reason: `${code}_theory must be an integer 0-75, got "${theoryRaw}"` });
          rowFailed = true;
          break;
        }
        if (!Number.isInteger(practical) || practical < 0 || practical > 25) {
          errors.push({ row: rowNum, reason: `${code}_practical must be an integer 0-25, got "${practicalRaw}"` });
          rowFailed = true;
          break;
        }
        marks.push({ subjectCode: code, isAbsent: false, wholeScore: null, theoryScore: theory, practicalScore: practical });
      } else {
        const wholeRaw = get(code);
        if (wholeRaw === "AB") {
          marks.push({ subjectCode: code, isAbsent: true, wholeScore: null, theoryScore: null, practicalScore: null });
          continue;
        }
        const whole = Number(wholeRaw);
        if (wholeRaw === undefined || wholeRaw === "") {
          errors.push({ row: rowNum, reason: `${code}: mark is required` });
          rowFailed = true;
          break;
        }
        if (!Number.isInteger(whole) || whole < 0 || whole > 100) {
          errors.push({ row: rowNum, reason: `${code} must be an integer 0-100, got "${wholeRaw}"` });
          rowFailed = true;
          break;
        }
        marks.push({ subjectCode: code, isAbsent: false, wholeScore: whole, theoryScore: null, practicalScore: null });
      }
    }

    if (rowFailed) continue;
    rows.push({ row: rowNum, roll, name, className, optionalCode, marks });
  }

  return { rows, errors };
}
