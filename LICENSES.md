# LICENSES.md

Every third-party dependency, template, and asset used in this submission,
with its license. Extracted directly from each package's own `package.json`
at the versions actually installed (not from memory), verified against the
event rules: no AGPL/GPL/LGPL/MPL/SSPL or other copyleft licenses, and no
non-commercial/personal-use-only assets are used anywhere in this project.

## Runtime dependencies

### Backend (`backend/`)

| Package | Version | License |
| --- | --- | --- |
| express | 5.2.1 | MIT |
| @prisma/client | 6.19.3 | Apache-2.0 |
| zod | 4.5.4 | MIT |
| cors | 2.8.6 | MIT |
| helmet | 8.3.0 | MIT |
| cookie-parser | 1.4.7 | MIT |
| bcryptjs | 3.0.3 | BSD-3-Clause |
| dotenv | 17.4.2 | BSD-2-Clause |

### Frontend (`frontend/`)

| Package | Version | License |
| --- | --- | --- |
| react | 19.2.8 | MIT |
| react-dom | 19.2.8 | MIT |

## Development / build-time dependencies

These are not shipped in either production artifact (the compiled backend
`dist/` output or the built frontend static bundle) - listed for completeness.

### Backend

| Package | Version | License |
| --- | --- | --- |
| typescript | 5.9.3 | Apache-2.0 |
| tsx | 4.23.13 | MIT |
| prisma (CLI) | 6.19.3 | Apache-2.0 |
| vitest | 4.1.11 | MIT |
| supertest | 7.2.2 | MIT |
| @types/node | 26.4.0 | MIT |
| @types/express | 5.0.6 | MIT |
| @types/cors | 2.8.19 | MIT |
| @types/cookie-parser | 1.4.10 | MIT |
| @types/bcryptjs | 2.4.6 | MIT |
| @types/supertest | 7.2.1 | MIT |

### Frontend

| Package | Version | License |
| --- | --- | --- |
| typescript | 5.9.3 | Apache-2.0 |
| vite | 6.4.3 | MIT |
| @vitejs/plugin-react | 4.7.0 | MIT |
| vitest | 2.1.9 | MIT |
| @types/react | 19.2.18 | MIT |
| @types/react-dom | 19.2.5 | MIT |
| @types/node | 26.4.0 | MIT |

## Infrastructure / hosting (services, not code dependencies)

| Service | Purpose | License / Terms |
| --- | --- | --- |
| Supabase | Managed Postgres hosting | Used under Supabase's free-tier Terms of Service; the database itself (PostgreSQL) is PostgreSQL License (permissive) |
| Render | Backend web service hosting | Used under Render's free-tier Terms of Service |
| Vercel | Frontend static hosting | Used under Vercel's free-tier Terms of Service |

## Templates, starters, UI kits

**None.** The frontend was scaffolded with `npm create vite` (a code
generator, not a template with pre-written UI or business logic) and then
built from scratch. The backend has no starter template - every route,
schema, and middleware was authored for this submission. No UI kit
(e.g. MUI, Chakra, shadcn) is used; all components are hand-built.

## Fonts

**None used.** The interface uses the browser/OS default system font stack
(no `@font-face`, no Google Fonts or other web font import).

## Icons

**None from a library.** Every icon in the interface (username/password
field icons, theme toggle, etc.) is a hand-authored inline SVG in the
component source, not sourced from an icon library or icon font.

## Other assets

| Asset | Description | Origin |
| --- | --- | --- |
| `frontend/public/logo.svg` | Product mark (ascending grade bars with a verification tick) | Hand-authored for this submission |
| `frontend/public/favicon.svg` | Favicon (logo variant without the tick, for legibility at 16px) | Hand-authored for this submission |
| `frontend/src/components/VaultScene.tsx` | Isometric vault animation on the sign-in splash | Hand-built with pure CSS 3D transforms - no WebGL, no 3D model file, no animation library |

## Official problem data

`backend/src/db/data/cases.json` bundles the official `P08_school_results_public.json`
dataset published by the event organizers for this problem, plus our own
authored 60-student dataset (case `OWN-01`, see README.md). The organizers'
dataset is event material, not a third-party dependency, and is used as
permitted by the problem statement.
