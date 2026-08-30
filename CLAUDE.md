# School Result Processing and GPA Engine

Team **t043** · Problem **p08** · Event start code **LSH26-8490-C900**

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

## Authentication

**The frontend performs no authentication.** It holds no account list, compares no
passwords and decides nothing about session validity. `frontend/src/lib/auth.ts` is a thin
transport over three endpoints; every accept/reject is the backend's. Do not push any of
this back into the client.

### Session handling

Set the session as an **httpOnly, SameSite=Lax cookie** at login. Do not return a token in
the JSON body: a token the page can read is a token an XSS can steal, and the frontend
deliberately keeps nothing in `localStorage` or `sessionStorage`. All three auth calls and
the marks fetch send `credentials: 'include'`.

### The `Teacher` object

`login` and `session` both return exactly this — it is what the sidebar renders:

```jsonc
{
  "username": "controller",
  "name": "Nasrin Akter",
  "role": "Exam controller",     // free text, shown under the name
  "scope": "*"                   // "*" for the whole cohort, or a classId like "c9a"
}
```

`scope` is carried for later per-class filtering. The frontend displays it but does not
enforce it — **if a teacher must not see another class, `GET /results` has to filter
server-side.**

### Seeded dev accounts

The sign-in screen shows these under a "Dev mode" panel so judges can get in without being
handed a password out of band. The panel only types them into the form; nothing client-side
checks them. Seed exactly these two, or change both sides together —
`SEEDED_ACCOUNTS` in `frontend/src/components/SignIn.tsx`:

| Username | Password | Name | Role | Scope |
| --- | --- | --- | --- | --- |
| `controller` | `result2026` | Nasrin Akter | Exam controller | `*` |
| `teacher9a` | `class9a` | Abdul Karim | Class teacher · Class 9 - Section A | `c9a` |

Hash the passwords at rest even for the demo seed. Rate-limit `/auth/login` if there is
time; the frontend surfaces whatever `error.message` you return.

### What the frontend does on each response

| Response | Frontend behaviour |
| --- | --- |
| `login` `200` | Stores the `Teacher` in React state only, then fetches results |
| `login` `401` | Shows `error.message`, stays on the gate |
| `login` `404` | Shows "no sign-in service — start the backend" |
| network failure | Shows the unreachable-service message with the URL it tried |
| `session` `200` | Restores the console without a second sign-in |
| `session` `401`/error | Shows the sign-in gate. An unreachable backend is never treated as a valid session |
| `results` `401`/`403` | Shows "your session is no longer valid, sign in again" |

## All data comes from the backend

**Nothing about a student is bundled into the app.** `VITE_RESULTS_URL` now defaults to
`/api/v1/results`, not to a local file: students, classes, subjects, marks, absences and
the optional-subject choice are all fetched. The frontend holds no cohort of its own.

What the frontend still owns is the **arithmetic** — grade points, GPA, letter grades,
traces and checking lists are derived in `src/engine/` from the marks you send. That split
is deliberate and unchanged: the backend owns the marks, the frontend owns the maths.

### TEMPORARY: preview without the backend

While `/api/v1/results` and `/auth/login` are being written, a dev-only escape hatch lets
the portal be walked end to end:

- Submitting the login form with **both fields empty** opens a preview session.
- That session, and only that session, reads `public/data/sample-results.json`.
- Every screen carries a "Preview session" banner, and the sidebar shows the account as
  *Preview session · No backend · sample marks*.

It is gated on `import.meta.env.DEV`, which Vite folds to `false` in `vite build`. The
strings `Preview session`, `Preview without the backend` and `sample-results` are all
verifiably **absent from the production bundle** — the branch cannot ship by accident.

**To remove it when the backend lands:** delete the `PREVIEW_ENABLED` block in
`frontend/src/lib/auth.ts`, the `PREVIEW_SOURCE` branch in `frontend/src/lib/api.ts`, the
`preview` state and banner in `frontend/src/App.tsx`, and the `gate__preview` /
`preview-bar` rules in the stylesheet.

## API endpoints to build

Base path `/api/v1`. JSON in, JSON out. **Authentication is now required, not optional** —
the frontend has no sign-in of its own and cannot be entered until `/auth/login` exists.
See **Authentication** below.

### Required to unblock the frontend — four endpoints

| | |
| --- | --- |
| **`POST /api/v1/auth/login`** | Body `{ "username", "password" }`. On success `200` with a `Teacher` and a session cookie; on bad credentials `401` with the error envelope. |
| **`GET /api/v1/auth/session`** | `200` with the `Teacher` for a valid session cookie, `401` otherwise. Called on every page load. |
| **`POST /api/v1/auth/logout`** | Clears the session. `204`. |
| **`GET /api/v1/results`** | The whole `Dataset` object above. **Must return `401` without a valid session** — this is the endpoint that actually protects the marks. |

Point the frontend at the backend with:

On Windows PowerShell the inline `VAR=value cmd` syntax does not work — put these in
`frontend/.env.local` and run `npm run dev` normally:

```
VITE_RESULTS_URL=http://localhost:8000/api/v1/results
VITE_AUTH_URL=http://localhost:8000/api/v1/auth
```

`frontend/src/lib/api.ts` and `frontend/src/lib/auth.ts` read those two variables and
change nothing else. Both default to same-origin paths, so a backend that also serves the
built frontend needs neither.

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

**Credentials matter here.** Every frontend call sends `credentials: 'include'`, so the
backend must set `Access-Control-Allow-Credentials: true` and echo the exact origin —
`Access-Control-Allow-Origin: *` is rejected by the browser when credentials are involved,
and the session cookie will silently never be sent.

## What changed in the frontend after the first push

Everything below is already built and on `main`; it is listed so the backend contract and
this file stay in step.

- **Teacher sign-in gate.** Marks are not fetched until the backend confirms a session, so
  an unauthenticated page load pulls no student data at all. Contract above.
- **Splash sign-in screen.** Portal name, school, staggered entrance animation, and the
  dev-mode credential panel. Honours `prefers-reduced-motion`.
- **Light / dark / system themes.** One button cycles the three. The choice is stamped as
  `data-theme` on `<html>`, persisted in `localStorage` under `gpa-console.theme`, and
  re-applied by an inline script in `index.html` before first paint so there is no flash.
  System is the default and follows the OS.
- **Responsive down to 360px.** The sidebar becomes a drawer with a scrim under 900px;
  wide tables scroll inside their own card rather than the page going sideways.
- **Logo and favicon.** `frontend/public/logo.svg` and `favicon.svg` — ascending grade
  bars with a verification tick. The favicon variant drops the tick to survive 16px.
- **Naming.** The product is the **Teacher Result Portal**; the school name sits under it
  on the splash and in the sidebar.
- **Split-card login.** Gradient splash panel on the left, form on the right, in one
  rounded card that fits the viewport — the form column scrolls inside the card rather
  than pushing the splash off screen.
- **Hand-built 3D scene.** `frontend/src/components/VaultScene.tsx` — an isometric vault
  with a slot, and an A+ result sheet filed through it on a loop. Pure CSS 3D transforms:
  no WebGL, no model file, no library, nothing added to `package.json`. It is
  `aria-hidden`, `prefers-reduced-motion` freezes it, and the sheet's travel is bounded so
  it stays inside the splash panel at every frame.
- **Password reveal toggle** and leading field icons on the login form.

### Frontend environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `VITE_RESULTS_URL` | `/api/v1/results` | Where marks are fetched from |
| `VITE_AUTH_URL` | `/api/v1/auth` | Base path of the three auth endpoints |
| `VITE_PORTAL_NAME` | `Teacher Result Portal` | Headline on the sign-in splash |
| `VITE_SCHOOL_NAME` | `Shaheed Smrity Higher Secondary School` | Shown under the portal name |

### Known consequence, flagged deliberately

Because sign-in is now entirely server-side, **the frontend cannot be entered until the
backend serves `/auth/login`.** Running `npm run dev` alone reaches the splash and stops
there with "no sign-in service". That is the intended trade for keeping credential checks
off the client — but it means the auth endpoints are the first thing to build, not the last.

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

- [ ] `POST /auth/login`, `GET /auth/session` and `POST /auth/logout` behave as above, and
      the two seeded dev accounts sign in
- [ ] `GET /api/v1/results` returns `401` without a session, and the dataset shape above
      with one, rendering in the frontend with only `VITE_RESULTS_URL` and `VITE_AUTH_URL` set
- [ ] CORS allows `http://localhost:5173` **with credentials** (exact origin, not `*`)
- [ ] The field rules table is enforced, with `422` and the error shape on failure
- [ ] Absent papers are stored as `absent: true` with null marks, never as zeros
- [ ] The sample dataset round-trips through the API unchanged
