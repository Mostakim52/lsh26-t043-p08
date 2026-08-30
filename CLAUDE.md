# School Result Processing and GPA Engine

Team **t043** · Problem **p09** · Event start code **LSH26-8490-C900**

Two halves: `frontend/` is built and working; `backend/` does not exist yet. This file is
the contract between them. If you are picking up the backend, read **Your job** and **The
data contract** — those two sections are enough to unblock the frontend on day one.

## Event ground rules

- `EVENT.md` in the repo root carries the team ID, problem ID, start code and the
  declaration of prior work. It is already committed as the first commit.
- **Do not squash, delete or rewrite Git history after 06:00 pm.** No `--amend` on pushed
  commits, no force pushes, no interactive rebase. Judges read the history.
- Both repositories must be public before submission and stay public until results are
  announced.

## Repo layout

```
EVENT.md          team ID, problem ID, start code, prior-work declaration
CLAUDE.md         this file
frontend/         React + TypeScript + Vite. Done. See frontend/README.md
backend/          not started
```

## The grading rules (canonical)

These are the rules the judges mark against. The frontend implements them in
`frontend/src/engine/rules.ts` and `frontend/src/engine/engine.ts`. If the backend ever
computes grades too, it must agree with those files exactly.

- **R-11** Practical subjects: theory out of **75**, pass mark **25**; practical out of
  **25**, pass mark **8**. Failing either part fails the subject — grade point 0.
- **R-12** Absent in a compulsory subject: show `AB`, subject grade point 0, overall
  result F. Absent in the optional subject: contributes 0 and the student appears on the
  checking list.
- **R-13** `GPA = (sum of the six compulsory grade points + max(0, optional grade point - 2)) / 6`,
  capped at 5.00, shown to 2 decimal places. Any compulsory failure gives GPA 0.00 and
  letter F; the uncancelled average stays visible in the calculation trace.
- **R-10** Letter grade from the final GPA: A+ = 5.00, A = 4.00–4.99, A- = 3.50–3.99,
  B = 3.00–3.49, C = 2.00–2.99, D = 1.00–1.99, otherwise F.
- **R-29** Checking lists — optional list: optional grade point **≤ 2.00** (an absent
  optional counts); practical fail list: any practical part **< 8**; absent list: any
  `AB`. A student can be on more than one list.

Subject mark → grade point (applied to the mark out of 100 once a subject has cleared its
pass marks): 80+ = 5.00, 70–79 = 4.00, 60–69 = 3.50, 50–59 = 3.00, 40–49 = 2.00,
33–39 = 1.00, below 33 = 0.00.

**One assumption, carried through both halves.** The brief fixes the marking for subjects
*with* a practical part but never says how a subject *without* one is marked. We treat
those as a single written paper out of **100** with a pass mark of **33** — the number the
two component pass marks add up to (25 + 8). Keep the backend consistent with this.

## Who computes what

Grading currently runs in the **frontend**, in `frontend/src/engine/`. That is deliberate:
it keeps one implementation of the rules, and it is the one covered by 28 passing tests.

**The backend's job is to own the marks, not the maths.** Serve raw marks in the shape
below and the frontend does the rest — no frontend change beyond one environment variable.
Only add server-side grading if something outside the browser needs it (a PDF transcript,
a bulk export). If you do, mirror `rules.ts` exactly and treat
`frontend/src/engine/engine.test.ts` as the conformance suite.

## The data contract

This is the shape `frontend/src/engine/types.ts` defines and the frontend fetches today
from `frontend/public/data/sample-results.json`. Match it exactly — field names,
nullability and all.

```jsonc
{
  "meta": {
    "school": "Shaheed Smrity Higher Secondary School",  // required, shown in the sidebar
    "exam": "Annual Examination",                        // required
    "session": "2025-2026",                              // required
    "generatedAt": "2026-08-30"                          // required, ISO date or timestamp
    // "seed" exists in the sample file only; a live backend omits it
  },
  "classes": [
    { "id": "c9a", "name": "Class 9 - Section A", "session": "2025-2026" }
  ],
  "subjects": [
    { "code": "BAN", "name": "Bangla",  "hasPractical": false, "kind": "compulsory" },
    { "code": "PHY", "name": "Physics", "hasPractical": true,  "kind": "compulsory" },
    { "code": "HMT", "name": "Higher Mathematics", "hasPractical": true, "kind": "optional" }
  ],
  "students": [
    {
      "id": "C9A-22",
      "roll": 22,
      "name": "Rakib Islam",
      "classId": "c9a",
      "optionalCode": "HMT",        // must reference a subject with kind "optional"
      "marks": [
        { "code": "BAN", "theory": 74, "practical": null },
        { "code": "PHY", "theory": 60, "practical": 20 },
        { "code": "ICT", "theory": null, "practical": null, "absent": true },
        { "code": "HMT", "theory": 62, "practical": 21 }
      ],
      "edgeCase": "optional free-text note, shown as a callout in the UI"
    }
  ]
}
```

### Field rules the backend must enforce

| Field | Rule |
| --- | --- |
| `subjects[].code` | Unique. Uppercase short code. `kind` is `"compulsory"` or `"optional"`. |
| `subjects[]` compulsory count | Exactly **6**, shared by every student. |
| `students[].id` | Unique across the whole dataset. |
| `students[].roll` | Unique **within a class**. |
| `students[].optionalCode` | Must match a subject whose `kind` is `"optional"`. |
| `students[].marks` | Exactly **7** entries: the 6 compulsory codes plus the student's `optionalCode`. Order does not matter — the frontend looks marks up by code. |
| `marks[].theory` | Integer. `0–75` when the subject has a practical part, `0–100` when it does not. `null` only when `absent` is true. |
| `marks[].practical` | Integer `0–25` when the subject has a practical part. **`null`** when it does not, and when `absent` is true. |
| `marks[].absent` | Optional boolean. When `true`, both `theory` and `practical` must be `null`. Absence is decided before marks, so never send an absent record with numbers on it. |

`practical: null` on a practical subject is read as a **0**, not as absent — it will fail
the subject under R-11. Send `absent: true` for a missed paper, never a null or a zero.

## API endpoints to build

Base path `/api/v1`. JSON in, JSON out. No auth for now; add it only if there is time.

### Required to unblock the frontend — one endpoint

| | |
| --- | --- |
| **`GET /api/v1/results`** | Returns the whole `Dataset` object above: `meta`, `classes`, `subjects`, `students` with marks. |

That is genuinely all the frontend needs today. Point it at the backend with:

```bash
VITE_RESULTS_URL=http://localhost:8000/api/v1/results npm run dev
```

On Windows PowerShell that inline syntax does not work — put the line in
`frontend/.env.local` instead and run `npm run dev` normally:

```
VITE_RESULTS_URL=http://localhost:8000/api/v1/results
```

`frontend/src/lib/api.ts` reads that variable and changes nothing else.

### Next, for marks entry

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/api/v1/classes` | `ClassDef[]` |
| `GET` | `/api/v1/subjects` | `SubjectDef[]` |
| `GET` | `/api/v1/students` | `Student[]`. Support `?classId=c9a`. |
| `GET` | `/api/v1/students/{id}` | One `Student` with marks, 404 if unknown. |
| `POST` | `/api/v1/students` | Create. Body is one `Student` without `id`; respond `201` with the created record including its `id`. |
| `PUT` | `/api/v1/students/{id}` | Replace name, class, `optionalCode` and the full `marks` array. |
| `PATCH` | `/api/v1/students/{id}/marks/{subjectCode}` | One subject. Body `{ "theory": 60, "practical": 20 }` or `{ "absent": true }`. This is the endpoint a marks-entry screen will hit per keystroke-save, so keep it cheap. |

Validation failures return `422` with the error shape below. Enforce every rule in the
table above server-side — the frontend does not sanitise marks.

### Optional, only if server-side grading is needed

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/api/v1/results/computed` | `StudentResult[]` as defined in `frontend/src/engine/types.ts`, including `subjects[]` with `gradePoint`, `ruleId`, `rule`, and the `trace[]` steps. |
| `GET` | `/api/v1/checklists` | The three R-29 lists, shape as `Checklist[]` in `frontend/src/engine/checklists.ts`. |
| `GET` | `/api/v1/export/results.csv` | Flat CSV for the office. |

If you build these, the frontend can render them instead of computing — but do not build
them just because they are listed. The frontend already produces all of it.

### Error shape

```json
{ "error": { "code": "INVALID_MARK", "message": "practical must be 0-25 for PHY", "field": "marks[3].practical" } }
```

Status codes: `200` ok, `201` created, `400` malformed JSON, `404` unknown id, `422`
validation failure, `500` otherwise.

### CORS

The dev frontend runs on `http://localhost:5173`. Allow that origin for `GET`, `POST`,
`PUT`, `PATCH` and the `Content-Type` header, or the browser will block every call.

## Running the frontend

```bash
cd frontend && npm install && npm run dev
```

Opens on http://localhost:5173. `npm test` runs the 28 engine tests; `npm run build`
type-checks and builds. Full detail in `frontend/README.md`.

## Test fixtures worth reusing

`frontend/public/data/sample-results.json` has 64 students across two classes, twelve of
them hand-written edge cases carrying an `edgeCase` note that says what each one exercises
— strong average cancelled by one failure, practical fail beside a passing theory mark,
optional grade point exactly 2.00, absent compulsory, absent optional, the 5.00 cap, both
sides of the 3.50 letter boundary, component pass marks exactly met, a practical fail
inside the optional subject, a theory fail no checking list catches, and an AB in two
subjects at once.

Use that file as the backend's seed data. If the backend serves it verbatim through
`GET /api/v1/results`, the frontend renders identically to today — which makes it a clean
first integration test.

## Definition of done for the backend

- [ ] `GET /api/v1/results` returns the dataset shape above and the frontend renders it
      with only `VITE_RESULTS_URL` changed
- [ ] CORS allows `http://localhost:5173`
- [ ] The field rules table is enforced, with `422` and the error shape on failure
- [ ] Absent papers are stored as `absent: true` with null marks, never as zeros
- [ ] The sample dataset round-trips through the API unchanged
