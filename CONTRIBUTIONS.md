# Approach and contributions — Team t043, Problem P08

## Approach

The problem statement's grading rules are precise and unforgiving — pass
marks that apply to two different parts of a subject independently, an
optional subject that only sometimes helps, and an absence that must never
look like a zero. We treated getting that arithmetic exactly right, and
provable, as the highest-priority work: before building any UI or API
surface, the grading rules were implemented as pure, dependency-free
functions and golden-tested against real hard-edge students pulled from the
official dataset (an absence, a genuine zero, a practical fail beside a
passing theory mark, an optional subject at the exact point it stops
helping) — not synthetic data invented to make the tests pass.

The frontend and backend were built in parallel, each independently, against
a written contract (`CLAUDE.md`) agreed before either existed. When the two
were connected, the backend's originally-designed architecture (a different
auth model, a different API shape) was rebuilt to match the frontend's
already-built, already-tested contract exactly, rather than the reverse —
the frontend was the one with a working, tested product; the backend
adapted to it. That reconciliation, plus a real cross-site cookie bug found
only once both halves were deployed to separate real hosts, took as much
engineering effort as the original build.

Beyond the four required MVP items, we treated the problem statement's
instruction to "create at least 60 students" as calling for data the team
authored, not just the organizers' reference sample — so a second,
hand-engineered dataset was built and independently verified against the
grading engine before being trusted. We also built the marks-entry and CSV
upload/export feature (one of the listed bonus features) once the core four
requirements were confirmed working, per the problem's own sequencing
instruction.

## Contributions

| Member | Major contribution |
| --- | --- |
| **Mostakim Hossain** | Entire frontend: React/TypeScript/Vite application, the independent client-side grading engine (`frontend/src/engine/`, 28 tests), the sign-in flow and session handling contract (`CLAUDE.md`), all UI/UX (Overview, Students, Checking Lists, Trace views, theming, responsive layout), and the Vercel deployment. |
| **jahin-7** | Entire backend: Prisma schema and dataset ingestion pipeline, the grading engine's independent server-side implementation and its golden tests, session-cookie authentication, all REST endpoints, the marks-entry/CSV import-export feature (both the backend endpoints and the frontend UI for it), the authored 60-student dataset, the Render/Supabase/Vercel deployment and the cross-site cookie fix that connected the two halves, and this submission's documentation. |

Both members registered for team t043; contributions are reflected directly
in the repository's git history (`git log`), which was not squashed or
rewritten after the event start time.
