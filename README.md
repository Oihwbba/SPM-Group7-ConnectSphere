# ConnectSphere

Event planning and venue booking system for **ConnectSphere Event Services**
(IS212 Software Project Management). This repository is the **foundation** that
the team builds features on top of — the skeleton, the shared conventions, and
one worked reference feature. It intentionally implements **no business
features** yet; see `docs/` and `CONTRIBUTING.md`.

## Stack

Next.js (App Router) · TypeScript (strict) · Tailwind CSS · shadcn/ui · Prisma ·
PostgreSQL · Zod · Auth.js (NextAuth v5) · Vitest · Playwright · GitHub Actions.

Exact versions are pinned in `package.json` (no caret ranges).

---

## Getting started (from a clean laptop, ~10 minutes)

### Prerequisites

- **Node.js 20+** and npm
- **Docker Desktop** (for local Postgres)

### Steps

```bash
# 1. Install dependencies (also generates the Prisma client)
npm install

# 2. Create your local env file and fill nothing in — the defaults work locally
cp .env.example .env
#    Then set AUTH_SECRET to any 32-byte string, e.g.:
#    npx auth secret        (writes it for you)   — or —
#    openssl rand -base64 32

# 3. Start Postgres in Docker
docker compose up -d

# 4. Create the schema and load seed data (one command: drop, migrate, seed)
npm run db:reset

# 5. Run the app
npm run dev
```

Open <http://localhost:3000>. You'll be redirected to `/login`.

### Sign in

All seeded accounts share the password **`Password123!`**:

| Email | Role | Lands on |
|---|---|---|
| `organiser@test.local` | Event Organiser | My Events (the reference feature) |
| `coordinator@test.local` | Event Coordinator | Event Review |
| `venuestaff@test.local` | Venue Staff | Venue Bookings |
| `techsupport@test.local` | Technical Support | Equipment |
| `attendee@test.local` | Attendee | Browse Events |

There is also a second organiser (`organiser2@test.local`) and coordinator
(`coordinator2@test.local`) so cross-user access denial is testable.

---

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` / `npm run start` | Production build / serve |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint (Next + Prettier config) |
| `npm run format` | Prettier write |
| `npm test` | Vitest (unit/integration) |
| `npm run test:coverage` | Vitest with coverage report |
| `npm run test:e2e` | Playwright (builds + serves the app, then runs) |
| `npm run db:reset` | Drop, migrate and seed the database |
| `npm run db:seed` | Re-run the (idempotent) seed |
| `npm run db:migrate` | Create a new migration in development |

> Playwright needs browsers the first time: `npx playwright install chromium`.
> It also expects a seeded database — run `npm run db:reset` first locally.

---

## Project layout

```
app/
  (auth)/login/               Login page with the animated sphere
  (app)/                      Everything behind auth (middleware-protected)
    layout.tsx                Shell: header, role-based nav, user menu
    page.tsx                  Redirects each role to its landing page
    organiser/events/         ⭐ REFERENCE FEATURE — copy this shape
    coordinator/…  venue-staff/…  tech-support/…  attendee/…  notifications/
lib/
  auth/can.ts                 Authorisation: roles + relationships (one source of truth)
  auth/actions.ts             signIn / signOut server actions
  schemas/                    Zod schemas, shared by forms and actions
  datetime.ts                 The only place dates are formatted (Asia/Singapore)
  db.ts                       Shared Prisma client
components/ui/                shadcn/ui primitives
prisma/                       schema.prisma, migrations, seed.ts
docs/adr/                     Architecture Decision Records (read these!)
```

## Where to read next

- **`CONTRIBUTING.md`** — how to add your first feature by copying the reference.
- **`docs/adr/`** — why the important decisions were made (route split, JWT
  sessions, denormalised times, centralised authorisation). These are written
  to be read aloud in the oral exam.

---

## Production notes (Vercel + Supabase)

- Host the app on Vercel, the database on Supabase.
- Set `DATABASE_URL` to the **pooled** Supabase connection (port `6543`,
  `?pgbouncer=true&connection_limit=1`) and `DIRECT_URL` to the **direct**
  connection (port `5432`). Prisma uses `DIRECT_URL` for migrations only. Both
  are documented in `.env.example`.
- Set `AUTH_SECRET`, and `AUTH_URL` to the deployed URL.
- Deploy migrations with `npm run db:deploy` (`prisma migrate deploy`).
