# P08 — School Result Processing and GPA Engine

| Field | Value |
| --- | --- |
| Team | Parle Theka |
| Team ID | t043 |
| Problem ID | p08 |
| Event start code | LSH26-8490-C900 |
| Live URL | **https://resultportalt043.vercel.app** |
| Repository | https://github.com/Mostakim52/lsh26-t043-p08 |

A tool for a secondary school office that turns raw subject marks into final
results the same way every time, and shows the teacher exactly which rule
produced each number so a wrong entry can be caught before results are
published.

Sign in with either seeded account (shown on the sign-in screen's "Dev mode"
panel, credentials fill the form only — verified server-side):

| Username | Password | Scope |
| --- | --- | --- |
| `controller` | `result2026` | Whole cohort |
| `teacher9a` | `class9a` | Class 9 only |

---

## Repository layout

```
/
├── backend/     Node.js + TypeScript + Express REST API (Prisma + Postgres)
└── frontend/    Vite + React + TypeScript UI
```

Each half deploys and runs independently:

- `backend/` → Render (`https://p08-backend.onrender.com`)
- `frontend/` → Vercel (`https://resultportalt043.vercel.app`), which proxies
  `/api/v1/*` to the Render backend (see **Major decisions** below)

## Setup and run steps (local development)

### Backend

```bash
cd backend
npm install
cp .env.example .env      # fill in a Postgres connection string (see below)
npm run db:deploy          # apply migrations
npm run db:seed            # load the official + our own datasets
npm run db:seed:teachers   # create the two seeded accounts
npm run dev                 # http://localhost:4000
```

`DATABASE_URL`/`DIRECT_URL` in `.env` must point at a Postgres instance (we
used a free Supabase project). `FRONTEND_ORIGIN` must exactly match whatever
origin the frontend runs on — CORS is locked to an exact origin, not `*`.

Run the test suite: `npm test` (164 tests, fully offline/mocked).

### Frontend

```bash
cd frontend
npm install
cp .env.example .env.local   # leave VITE_API_BASE unset for local dev
npm run dev                   # http://localhost:5173
```

With `VITE_API_BASE` unset, the frontend calls relative `/api/v1/*` paths.
For local development against a backend running on a different port, set
`VITE_API_BASE=http://localhost:4000/api/v1` in `.env.local`.

Run the test suite: `npm test` (28 tests, the grading engine).

---

## Proof each requirement is met

### Required MVP items (problem statement)

| Requirement | Where it's satisfied |
| --- | --- |
| Grading rules exactly as specified (R-10..R-13, R-29) | `backend/src/grading/` (bands.ts, engine.ts, checkingLists.ts) and independently `frontend/src/engine/` — two separate implementations, cross-verified to agree to the decimal on every hard-edge student (see below) |
| ≥60 students, 2 classes, ≥8 hard-edge students | The official dataset (`PUB-01`, 80 students, 2 classes) already exceeds this. Our own authored dataset (`OWN-01`, case in `backend/src/db/data/cases.json`) adds 60 more students with **15** hand-engineered edge cases, each targeting one specific rule exactly (see `backend/scripts/generate-own-dataset.ts` and its companion `verify-own-dataset.ts`, which checks every one against the live grading engine before it's trusted) |
| Per-student trace: mark used, grade point, rule that decided it | `TraceView` in the frontend renders exactly this per subject, sourced from the engine's own rule strings (e.g. "Both parts passed (theory 40/75, practical 17/25). Total 57 falls in the 50-59 band, so grade point 3.00") |
| High-average-but-failed trace names the cancelling subject | The `cancelledBy` field + the "Result cancelled by X" callout on the trace view |
| Office checking list (optional / practical-fail / absent) | `ChecklistsView`, backed by `computeCheckingLists()` on the backend and `buildChecklists()` on the frontend |
| Absent ≠ scored zero | Enforced at three layers: a Postgres CHECK constraint (`isAbsent` implies all scores null), the grading engine's own type distinction, and a dedicated test (`S064` in the official dataset has a genuine `ENG: 0`; `S032` has `BIO: "AB"` — golden-tested to never collapse into the same output) |

### Bonus features (attempted, per the problem's "only after the four required items work")

| Bonus feature | Status |
| --- | --- |
| Paste/upload a marks sheet, report rejected rows with reasons | **Built.** `POST /api/v1/import` (backend) + the CSV panel in the "Marks entry" view (frontend). Validates every row independently — one bad row doesn't abort the rest — and reports `{row, reason}` for each rejection |
| Class summary (pass rate, grade distribution, worst subject) | **Built**, as the Overview page — pass rate, letter-grade distribution, per-class breakdown, checking-list load, all recomputed live from the actual marks |
| Printable individual marksheet | Not built — deprioritized under time constraints in favor of the marks-entry/CSV feature, which the team judged higher-value |

### Submission mechanics (CLAUDE.md contract, written by team t043 before the backend existed)

| Requirement | Status |
| --- | --- |
| `POST/GET/POST /api/v1/auth/{login,session,logout}` | Built and live-verified (see below) |
| `GET /api/v1/results` returns 401 without a session | Verified live |
| CORS: exact origin, credentials — not `*` | Verified live with a real `Origin` header; a disallowed origin gets the fixed configured value back, never an echo |
| Field rules (theory/practical ranges, absent semantics) enforced server-side, 422 on failure | Enforced identically in both the JSON marks-entry endpoints and the CSV importer (they share one validation function) |
| Absent papers stored as `absent: true`, never zero | Same three-layer enforcement as above |
| Sample dataset renders correctly through the API | We serve our own combined dataset (official + authored) rather than the frontend's bundled placeholder sample — a deliberate choice, see below |

---

## Major decisions

1. **Two teams, two independently-designed halves, reconciled mid-build.**
   The frontend was built end-to-end against a contract (`CLAUDE.md`) written
   before any backend existed: username/password + httpOnly session cookies,
   one flat `Dataset` endpoint, and grading computed **client-side**. The
   backend was initially built to a different, independently-designed
   architecture (Supabase Auth, JWT bearer tokens, teacher/student roles, a
   server-side grading authority). When the two were connected, the backend
   was rebuilt to match the frontend's already-tested contract exactly,
   rather than asking the frontend to change — it had 28 passing tests and
   was described as done. The backend's original grading engine wasn't
   thrown away: it's kept as two optional bonus endpoints
   (`/api/v1/results/computed`, `/api/v1/checklists`) that independently
   reproduce the same numbers the frontend computes on its own, which turned
   into the strongest correctness proof in the whole project (see below).

2. **Cross-site cookies needed a proxy, not just cookie attributes.**
   Frontend (Vercel) and backend (Render) are different top-level domains in
   production. `SameSite=None; Secure` is necessary for a cross-site cookie
   but modern Chrome increasingly blocks cross-site cookies as third-party
   regardless — login would succeed and the very next request would 401.
   Fixed with a Vercel rewrite (`frontend/vercel.json`) that proxies
   `/api/v1/*` to the Render backend, so the browser only ever talks to one
   origin and the cookie becomes first-party. No frontend code changed.

3. **Our own dataset, not just the organizers' sample.** The problem
   statement says to *create* at least 60 students; we treat the organizers'
   public sample as fixture/reference data and additionally authored our own
   60-student dataset with 15 precisely-engineered edge cases (every grade
   band hit exactly once, the exact 25/8 pass-mark boundary, GPA capped at
   5.00 and floored at 1.00, the A-/B boundary at exactly 3.50, two
   independent compulsory failures at once, etc.) — each one verified
   against the actual grading engine before being trusted, not just hand
   calculated.

4. **Marks-entry endpoints and CSV round-trip.** CLAUDE.md marks these as
   optional ("only if a marks-entry screen will hit per keystroke-save").
   We built them because the CSV upload/rejection-reporting bonus feature
   needed them anyway, and designed the CSV format to genuinely round-trip:
   export, edit in a spreadsheet, re-upload, and existing students are
   updated in place rather than duplicated.

5. **No client-side grading duplication check skipped.** Rather than trust
   that the backend's independently-built grading engine and the frontend's
   agree, we cross-verified them directly: the same hard-edge student
   (`S032`, absent in Biology) produces `uncancelledAverage: 2.83`,
   `officialGpa: 0`, letter `F` from *both* implementations, checked live
   against the deployed app, not just in unit tests.

## Known limitations

- **Free-tier cold start.** The Render backend sleeps after ~15 minutes
  idle; the first request after a gap takes 30-60 seconds to wake it. This
  is expected free-tier behavior, not a bug — a judge hitting a cold
  instance sees a slow first load, not an error.
- **No printable individual marksheet.** Listed as a bonus feature in the
  problem statement; not built, in favor of the marks-entry/CSV feature.
- **No rate limiting, CI pipeline, or error-tracking/observability.**
  Deliberately deprioritized for the MVP under the event's time constraint;
  none of these affect whether the app functions correctly for a judge.
- **Roll numbers for students added via the UI/CSV are auto-assigned**
  (next available number in the session), not client-specified, to avoid
  collision handling under time pressure.
- **Single active dataset.** The backend can hold multiple exam sessions
  (four are seeded), but the live app always serves one (`PUB-01`) — there's
  no UI to switch between them, matching the frontend's single-`Dataset`
  design.
