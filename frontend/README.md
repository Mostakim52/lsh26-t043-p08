# Result Processing and GPA Engine — frontend

Team **t043** · Problem **p09** · LSH26-8490-C900

A result office console: it loads a cohort of marks, grades every student against the
published rules, and shows the working. The grading engine runs in the browser, so the
GPA a judge reads on screen is produced by the code in `src/engine/` and nothing else.

## Run it

```bash
npm install
```

```bash
npm run dev
```

Then open http://localhost:5173.

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server on port 5173 |
| `npm run build` | Type-check and produce `dist/` |
| `npm test` | 28 engine tests, including every seeded edge case |
| `npm run gen:data` | Regenerates `public/data/sample-results.json` (deterministic) |

## The four required items

**1. The cohort.** `public/data/sample-results.json` holds **64 students across two
classes** (Class 9 - Section A and Class 10 - Section A), each with six compulsory
subjects and one optional fourth subject. Practical subjects carry separate theory and
practical marks. **Twelve** records are hand-written edge cases, each carrying an
`edgeCase` note that the app displays — see the table below.

**2. The calculation.** `src/engine/engine.ts` grades every subject, then the GPA and
letter grade. `src/engine/rules.ts` holds every threshold and scale; the Rules screen
renders from those same constants, so the documentation cannot drift from the maths.

**3. The per-student trace.** Open any student. The subject table gives the mark used,
the grade point it produced and the rule that decided it, one row per subject. Below it
the GPA ledger shows the compulsory sum, the optional credit, the division, the cap and
the cancellation. When a strong average is cancelled, a red banner at the top names the
subject that caused it and keeps the uncancelled average in view (R-13).

**4. The checking lists.** The Checking lists screen carries the three lists from R-29 —
optional rule, practical fail, absent — each with a plain-language "what a teacher checks
by hand" column, an *Also on* column for students caught by more than one rule, CSV
export and a print stylesheet.

## The rules, as implemented

- Practical subjects: theory out of 75 (pass 25) plus practical out of 25 (pass 8).
  Failing either part fails the subject, grade point 0. **R-11**
- Absent in a compulsory subject: AB, grade point 0, overall result F. Absent in the
  optional: contributes 0 and goes on the checking list. **R-12**
- `GPA = (sum of the six compulsory grade points + max(0, optional grade point - 2)) / 6`,
  capped at 5.00, shown to 2 dp. Any compulsory failure reports 0.00 and F, with the
  uncancelled average still visible in the trace. **R-13**
- Letter grade read from the rounded final GPA: A+ = 5.00, A = 4.00–4.99, A- = 3.50–3.99,
  B = 3.00–3.49, C = 2.00–2.99, D = 1.00–1.99, otherwise F. **R-10**
- Checking lists: optional grade point ≤ 2.00 (absent included), any practical part below
  8, any AB. A student can appear on more than one. **R-29**

### One assumption

The brief fixes the marking for subjects **with** a practical part but does not say how a
subject **without** one is marked. This engine treats those as a single written paper out
of 100 with a pass mark of 33 — the same threshold the two component pass marks add up to
(25 + 8 = 33). It is stated on the Rules screen too. Changing `MARKS` in
`src/engine/rules.ts` moves the calculation and the documentation together.

The subject mark → grade point scale (80+ = 5.00, 70–79 = 4.00, 60–69 = 3.50, 50–59 =
3.00, 40–49 = 2.00, 33–39 = 1.00) is the standard scale that the given GPA → letter table
mirrors; it lives in `SUBJECT_GRADE_SCALE`.

## Seeded edge cases

| Student | Class | What it exercises |
| --- | --- | --- |
| Tahmina Akter | 9 | Strong average (4.67, mean mark 82.43) cancelled to 0.00 F by one failed compulsory subject |
| Nayeem Hossain | 9 | Practical fail (6 / 25) with a passing theory mark (58 / 75) |
| Sumaiya Rahman | 9 | Optional grade point exactly 2.00, so `max(0, 2 - 2)` adds nothing |
| Rakib Islam | 9 | AB in a compulsory subject cancels a 4.08 average |
| Nusrat Jahan Mim | 9 | AB in the optional subject: contributes 0, GPA still stands at 4.08 |
| Sazzad Hossain | 10 | GPA cap: 5.50 held at 5.00 |
| Farzana Yeasmin | 10 | Boundary: exactly 3.50 is A-, not B |
| Mehedi Hasan | 10 | Boundary: 3.4167 rounds to 3.42, which is B |
| Habibur Rahman | 10 | Component pass marks exactly met: 25 theory + 8 practical passes at 33 |
| Arif Mahmud | 10 | Practical fail inside the optional subject; the compulsory six still carry 4.33 |
| Israt Jahan | 10 | Theory fail with a passing practical — no checking list catches it, only the trace |
| Marzia Sultana | 10 | AB twice: one compulsory, one optional, so two lists |

## Where marks come from

`src/lib/api.ts` fetches the dataset. Today that is the sample JSON in `public/data/`;
point `VITE_RESULTS_URL` at the backend when it is ready. The engine consumes the
`Dataset` shape in `src/engine/types.ts` either way, so nothing else has to change.

## Layout

```
src/
  engine/       grading rules, subject and student evaluation, checking lists, tests
  components/   the four screens plus shared UI pieces
  lib/          data loading and formatting helpers
  styles/       one stylesheet, light and dark
scripts/        deterministic sample-data generator
public/data/    sample-results.json
```
