# ConnectSphere

Event planning and venue booking system for **ConnectSphere Event Services**
(IS212 Software Project Management).

This repository holds the app skeleton, the shared conventions, one worked
reference feature, and — as of the full domain-model migration — **the complete
Release-1 database schema and seed data**. The schema covers all twenty
confirmed Release-1 features so that nobody has to guess at table shapes
mid-sprint; the *features* themselves are still built sprint by sprint. See
`docs/data-model.md` and `CONTRIBUTING.md`.

## Stack

Next.js (App Router) · TypeScript (strict) · Tailwind CSS · shadcn/ui · Prisma ·
PostgreSQL · Zod · Auth.js (NextAuth v5) · Vitest · Playwright · GitHub Actions.

Exact versions are pinned in `package.json` (no caret ranges).

---

## Getting started (from a clean laptop, ~10 minutes)

The team's shared database is the live **Supabase** project `connectsphere`
(ref `cczgpvrwmgirvryqecpb`, Singapore). You develop against it directly —
no local database needed.

### Prerequisites

- **Node.js 20.9+** and npm (required by Next.js 16)
- **The Supabase database password** — from the team lead, or the Supabase
  dashboard (Project Settings → Database)
- **Docker Desktop** — *optional*, only for the offline fallback below

### Steps

```bash
# 1. Install dependencies (also generates the Prisma client)
npm install

# 2. Create your local env file
cp .env.example .env
#    Replace <PASSWORD> in the two database URLs — keep the session pooler /
#    port 5432 exactly as given (.env.example explains why NOT 6543 and why
#    NOT db.<ref>.supabase.co), then set AUTH_SECRET to any 32-byte string:
#    npx auth secret        (writes it for you)   — or —
#    openssl rand -base64 32

# 3. Apply any pending migrations to the shared database
npm run db:deploy

# 4. Load the seed data (idempotent — safe to re-run, wipes nothing)
npm run db:seed

# 5. Run the app
npm run dev
```

Open <http://localhost:3000>. You'll be redirected to `/login`.

> **Never run `npm run db:reset` while `.env` points at Supabase.** It drops
> and rebuilds the schema — that wipes the whole team's data. `db:reset` is
> for the local Docker database only (see the fallback below). On the shared
> database, `db:deploy` + `db:seed` is all you ever need.

### Offline fallback (Docker)

No internet? Swap both URLs in `.env` to the commented Docker ones, then:

```bash
docker compose up -d
npm run db:reset   # LOCAL ONLY: drop, migrate, seed
```

> **Postgres 13 or newer is required** for the local fallback. The schema
> uses the `btree_gist` extension (created automatically by the migration)
> for the constraint that makes venue double-booking impossible. Supabase
> (Postgres 17) and the `postgres:16` Docker image both include it.

### Sign in

All seeded accounts share the password **`Password123!`**:

| Email | Role | Why it exists |
|---|---|---|
| `organiser@test.local` | Event Organiser | Owns most seeded events |
| `coordinator@test.local` | Event Coordinator | Assigned to most seeded events |
| `venuestaff@test.local` | Venue Staff | Decided the seeded venue bookings |
| `techsupport@test.local` | Technical Support | Owns the seeded equipment reservations |
| `attendee@test.local` | Attendee | Registered for several events |
| `organiser2@test.local` | Event Organiser | Owns one event — proves cross-organiser access is refused (SCRUM-68) |
| `coordinator2@test.local` | Event Coordinator | The "previous" coordinator in the reassignment audit entry (SCRUM-21) |
| `attendee2@test.local` | Attendee | Needed to fill an event (SCRUM-74) |
| `attendee3@test.local` | Attendee | Has one withdrawn registration (SCRUM-77) |
| `attendee4@test.local` | Attendee | Deliberately unregistered — free to take the last place |

---

## What the seed gives you

`npm run db:seed` is idempotent — run it as often as you like. Every scenario
below exists so a specific acceptance criterion can be **demonstrated**, not
just described. If you add seed data, say in a comment which story needs it.

**Events** — one in each of the nine statuses (SCRUM-23), plus:

| Event | What it demonstrates |
|---|---|
| `evt_full` | Capacity 3, three active registrations → **full** (SCRUM-74) |
| `evt_last_seat` | Capacity 3, two registrations → **exactly one place left**. This is the row the simultaneous-registration test uses. `attendee4` is free to take it. |
| `evt_reg_not_open` | Registration opens in a week (SCRUM-75) |
| `evt_reg_closed` | Registration closed yesterday (SCRUM-75) |
| `evt_other_organiser` | Owned by `organiser2` — loading it as `organiser` must be refused indistinguishably from "not found" (SCRUM-68) |
| `evt_draft` | No dates, no attendance — proves those columns really are nullable (SCRUM-15) |

**Venues** — four, including the Executive Boardroom (capacity 14, few
facilities) so the suitability check has something to mark *not suitable*
(SCRUM-40). The Grand Auditorium and Exhibition Hall already carry approved
bookings, so availability and search have a real collision to exclude
(SCRUM-36/38). Seminar Room 2.1 has a maintenance period that is **not** a
booking (SCRUM-36/37).

**Equipment** — five pooled types. Three of the ten projectors are booked out
for maintenance and one PA speaker is written off, so available quantity is
never simply `totalQuantity` (SCRUM-29/30).

**Also seeded:** an open clarification request, a pending change request with
three changed fields (two major, one not), venue bookings in every status, an
approved and a pending equipment request with a status history, read and unread
notifications, and audit entries.

Dates are **relative to today**, not hard-coded, so "registration closes next
week" is still true in Week 11. Row IDs are fixed — tests reference them
directly, so don't rename one without updating its callers.

---

## Data model

The schema in `prisma/schema.prisma` covers all twenty Release-1 features. Every
model and field names the story that justifies it; if you cannot find the story
for a column, it should not be there.

**Read `docs/data-model.md`** for the full story-to-table map, the entity
relationships, and the reasoning behind the three modelling decisions most
likely to be asked about in the Q&A.

### Two conventions the whole codebase depends on

**1. Periods that touch at an endpoint do not overlap.** A booking ending at
14:00 does not conflict with one starting at 14:00. This is stated in
SCRUM-29/30/31/36/38/50/53 and is enforced in the database by half-open `[)`
ranges. Every availability query you write must use the same rule.

**2. All datetimes are UTC**, stored as `timestamp(3)`. Format them for display
only through `lib/datetime.ts`. Because the columns carry no time zone, range
constraints use `tsrange`, not `tstzrange`.

### Rules the database enforces (do not work around them)

These are in `prisma/migrations/20260909120000_full_domain_model/migration.sql`,
below the `Domain constraints Prisma cannot express` banner. They exist so the
acceptance criteria hold even when someone forgets a check in a server action.

- **A venue can never be double-booked.** An `EXCLUDE USING gist` constraint
  rejects a second *approved* booking overlapping an existing one — including
  when two approvals commit at the same instant (SCRUM-53).
- **No duplicate pending booking request** for the same event, venue and
  overlapping period (SCRUM-50).
- **One open equipment request per event** — a partial unique index (SCRUM-27).
- **No duplicate equipment line** on a request (SCRUM-27).
- **One registration row per attendee per event** (SCRUM-73).
- **Rejections carry a reason.** An event, booking or change request cannot be
  stored as `REJECTED` with a blank reason (SCRUM-19/43/53).
- **Positive quantities and valid periods.** Attendance, capacities and
  quantities must be `> 0`; every `endAt` must be strictly after its `startAt`
  (SCRUM-13/29/31/32/35/74/75).

### Two rules the database *cannot* enforce

Both are counted pools, where overlapping rows are legal until a sum is
exceeded. Both are handled with `SELECT … FOR UPDATE` inside the writing
transaction. **Do not remove those locks:**

- **Registration capacity** (SCRUM-74) — lock the `Event` row.
- **Equipment quantity** (SCRUM-31) — lock the `Equipment` row.

---

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| **`npm run verify`** | **Run before every push** — typecheck + lint + tests, the checks CI fails on |
| `npm run build` / `npm run start` | Production build / serve |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint (Next + Prettier config) |
| `npm run format` | Prettier write |
| `npm test` | Vitest (unit/integration) |
| `npm run test:coverage` | Vitest with coverage report |
| `npm run test:e2e` | Playwright (builds + serves the app, then runs) |
| `npm run db:reset` | Drop, migrate and seed — **local Docker only** (would wipe the shared Supabase DB) |
| `npm run db:seed` | Re-run the (idempotent) seed — safe on the shared DB |
| `npm run db:migrate` | Create a new migration in development |

> Playwright needs browsers the first time: `npx playwright install chromium`.
> It also expects a seeded database — run `npm run db:reset` first locally.

### Migration rules

- **Never edit or delete a migration that is already on `main`.** Fix forward
  with a new one. Rewriting applied history is how a team ends up with a
  database nobody can rebuild from scratch — which is exactly what the graders
  will do.
- **Never use `prisma db push`.** It writes schema changes without a migration
  file, so your change reaches nobody else's database and the deployed
  environment silently drifts.
- Announce a `schema.prisma` change at standup **before** making it. It is one
  file that five people edit, and it is the most common merge conflict in this
  repo.
- If `prisma migrate dev` ever reports drift mentioning the partial or GiST
  indexes, that is expected: Prisma cannot model partial `WHERE` indexes or
  `EXCLUDE` constraints, so it ignores them. Do not "fix" it by deleting them.

---

## Project layout

Routes are grouped by **domain**, not by role — a route several roles use is
one folder whose page dispatches on `session.user.role` (see `adr/0001`'s
addendum). Each domain folder maps to one backlog epic.

```
README.md                     Run instructions
.env.example                  Every variable the app reads
docker-compose.yml            Local Postgres — offline fallback only
.github/workflows/ci.yml      CI: typecheck, lint, migrate, seed, test, e2e
package.json                  Pinned dependencies (npm's requirements.txt)
eslint.config.mjs             ESLint flat config (Next 16 removed `next lint`)
proxy.ts                      Auth gate for every protected route (was middleware.ts)
prisma/
  schema.prisma               The full Release-1 data model
  migrations/                 Ordered, never rewritten — constraints live here
  seed.ts                     Idempotent demo data
app/
  (auth)/login/               Login page with the animated sphere
  (app)/                      Everything behind auth (protected by proxy.ts)
    layout.tsx                Shell: header, role-based nav, user menu
    page.tsx                  Redirects each role to its landing page
    events/                   ⭐ REFERENCE FEATURE — SCRUM-6 event lifecycle
      page.tsx                Role dispatch + the organiser's events table
      actions.ts              Server actions (parse → authorise → write)
      create-event-dialog.tsx Local component, not shared
    venues/                   SCRUM-7  venue catalogue & availability
    bookings/                 SCRUM-7  booking review & approval
    equipment/                SCRUM-10 equipment requests & reservations
    registrations/            SCRUM-11 attendee registration
    notifications/            SCRUM-8  notification list
lib/
  auth/can.ts                 Authorisation: roles + relationships (one source of truth)
  auth/actions.ts             signIn / signOut server actions
  auth/guard.ts               requireSession() — used by every page
  schemas/                    Zod schemas, shared by forms and actions
  nav.ts                      Nav + landing route per role (one place)
  datetime.ts                 The only place dates are formatted (Asia/Singapore)
  db.ts                       Shared Prisma client
components/ui/                shadcn/ui primitives
tests/                        Vitest unit/integration suites
  auth.test.ts                can() — the security core
  events.test.ts              Event server actions
  venues.test.ts              (empty — SCRUM-7, to be written)
  concurrency.test.ts         (empty — SCRUM-31/53/74 simultaneous cases)
e2e/                          Playwright specs (npm run test:e2e)
docs/
  backlog/                    Every story's acceptance criteria, one file
                              per SCRUM key — generated from Jira; read
                              yours before you open a PR
  data-model.md               Story-to-table map and modelling decisions
  adr/                        Architecture Decision Records (read these!)
```

## Where to read next

- **`docs/backlog/`** — the acceptance criteria for every story, one file per
  SCRUM key. Your branch key is the filename: `SCRUM-19-approve-reject` →
  `docs/backlog/SCRUM-19.md`. Read yours before you open a PR. Generated from
  Jira — **Jira is the source of truth**, so re-sync rather than editing them.
- **`docs/data-model.md`** — what each table is for and which story asked for it.
- **`CONTRIBUTING.md`** — how to add your first feature by copying the reference.
- **`docs/adr/`** — why the important decisions were made (route split, JWT
  sessions, denormalised times, centralised authorisation). These are written
  to be read aloud in the oral exam.

---

## Production notes (Vercel + Supabase)

- Host the app on Vercel, the database on Supabase.
- Set **both** `DATABASE_URL` and `DIRECT_URL` to the Supabase **session
  pooler** — port `5432`, user `postgres.<project-ref>`, host
  `aws-0-<region>.pooler.supabase.com`. Two traps make the "obvious"
  alternatives wrong:
  - the "direct" host `db.<ref>.supabase.co` is **IPv6-only** — on any
    IPv4-only network (most homes and campus Wi-Fi) it fails as a bare
    timeout, which looks like nothing and wastes an afternoon;
  - the transaction-mode pooler (port `6543`, `?pgbouncer=true`) silently
    breaks the prepared statements the `pg` driver adapter relies on.
  Session mode supports migrations and app traffic identically.
- Production needs exactly three variables: `DATABASE_URL`, `DIRECT_URL` and
  `AUTH_SECRET`. **Paste them without surrounding quotes** — the quotes in
  `.env.example` are dotenv syntax, and Vercel stores them literally.
- Do **not** set `AUTH_URL` in production. Preview URLs change per deployment,
  and a fixed value sends callbacks to the wrong host; the app reads the host
  from the request instead.
- Do **not** set `AUTH_TRUST_HOST` either — it lives in code as
  `trustHost: true` (`auth.config.ts`) so it cannot be forgotten or mis-quoted.
- After changing any environment variable you must **redeploy**; a running
  deployment keeps the values it was built with.
- Deploy migrations with `npm run db:deploy` (`prisma migrate deploy`) —
  never `db:reset` against the shared database.
- Supabase runs Postgres 17 and permits `CREATE EXTENSION btree_gist`, so the
  double-booking constraint deploys unchanged (verified against the live
  project: the EXCLUDE constraint rejects an overlapping approval with
  `23P01`).

> **Do not use Supabase Row Level Security.** Prisma connects with a privileged
> role and bypasses it, so RLS would give a false sense of protection.
> Authorisation lives in `lib/auth/can.ts` (see `docs/adr/0004`).
