# ConnectSphere

Event planning and venue booking system for **ConnectSphere Event Services**,
built by Group 7 for IS212 Software Project Management.

**Live app:** <https://spm-group7-connect-sphere.vercel.app> (deployed from
`main`; sign in with a seeded account below).

## What it does

ConnectSphere replaces event planning by email and spreadsheets with one
system, where every event has one status, one assigned Coordinator, and
arrangements that can't clash:

1. An **Event Organiser** drafts an event request and submits it.
2. An **Event Coordinator** is assigned automatically, reviews it, asks
   questions if needed, and approves or rejects it.
3. In planning, the Coordinator books a venue and requests equipment.
   **Venue Staff** and **Technical Support** decide those requests, and the
   system refuses a double-booked venue or over-reserved equipment.
4. When the arrangements are complete, the Coordinator **confirms** the event.
5. **Attendees** register for confirmed events, up to each event's capacity.

Week 7 added two more roles. They can sign in, but until their stories land
they only read their own notifications:

- The **Event Coordinator Lead** will assign new requests to Coordinators from
  an unassigned queue, replacing automatic assignment (SCRUM-165), and see
  every Coordinator's workload (SCRUM-141).
- The **Safety Officer** will review an event's venue and equipment before it
  can be confirmed (SCRUM-166). Their approval doesn't confirm the event; the
  Coordinator still does.

Release 1 covers the twenty features in the Week 4 project instructions, and
Sprint 3 adds the Week 7 changes. The full picture (all seven roles, the event
lifecycle, scope) is in [`docs/product-context.md`](docs/product-context.md).

**Course material:** the customer briefing, the Week 4 project instructions
(the twenty Release 1 features and the grading rubric) and the customer's Q&A
answers are in the team's
[shared Google Drive folder](https://drive.google.com/drive/folders/1G4cNyWOcldw0iawiJfmJ1WbCiy_YZbv0).
The repository already reflects them: the stories in `docs/backlog/` quote
the customer where it matters, so you rarely need to open the folder.

## Start here

| If you want to… | Read |
|---|---|
| Run the app | [Getting started](#getting-started), below |
| Know what we are building and for whom | [`docs/product-context.md`](docs/product-context.md) |
| Check a story's acceptance criteria | `docs/backlog/SCRUM-n.md` (the key is in your branch name) |
| See the planned test cases for a story | `docs/testing/SCRUM-n.md` |
| Build a feature and open a pull request | [`CONTRIBUTING.md`](CONTRIBUTING.md) |
| Know why something is built the way it is | [`docs/adr/`](docs/adr/README.md) |
| Add a column or table | [`docs/data-model.md`](docs/data-model.md) |
| Work with an AI coding assistant | [`CLAUDE.md`](CLAUDE.md) |

## Stack

Next.js (App Router) · TypeScript (strict) · Tailwind CSS · shadcn/ui · Prisma ·
PostgreSQL · Zod · Auth.js (NextAuth v5) · Vitest · Playwright · GitHub Actions.

Exact versions are pinned in `package.json` (no caret ranges).

---

## Getting started

From a clean laptop this takes about ten minutes. The team shares one live
**Supabase** database (project `connectsphere`, ref `cczgpvrwmgirvryqecpb`,
Singapore), so you need no local database to run the app.

### Prerequisites

- **Node.js 24 LTS** and npm. `.nvmrc` pins it, so run `nvm use` (or
  `fnm use`). CI and Vercel both run Node 24.
- **The Supabase database password**, from the team lead or the Supabase
  dashboard (Project Settings → Database).
- **Docker Desktop** (optional): only for the offline fallback and for the
  integration tests, which need a local database.

### Steps

```bash
# 1. Install dependencies (this also generates the Prisma client)
npm install

# 2. Create your local env file
cp .env.example .env
#    Replace <PASSWORD> in both database URLs. Keep the session pooler on
#    port 5432 exactly as given; .env.example explains why not 6543 and why
#    not db.<ref>.supabase.co. Then set AUTH_SECRET to any 32-byte string:
#    npx auth secret        (writes it for you)   or
#    openssl rand -base64 32

# 3. Apply any pending migrations to the shared database
npm run db:deploy

# 4. Load the seed data (idempotent: deletes nothing, but resets every
#    seeded row to its seed values)
npm run db:seed

# 5. Run the app
npm run dev
```

Open <http://localhost:3000>. You'll be redirected to `/login`.

> **Never run `npm run db:reset` while `.env` points at Supabase.** It drops
> and rebuilds the schema, which wipes the whole team's data. `db:reset` is
> for the local Docker database only. On the shared database, `db:deploy` and
> `db:seed` are all you ever need.

### Local database (Docker)

`.env` points at the shared database, so anything that writes test data or
drops tables runs against a local Postgres instead: the integration tests,
`test:coverage`, the e2e specs, `db:migrate` and `db:reset`. Point the
terminal at Docker first, so a forgotten `.env` can't send them to Supabase:

```bash
docker compose up -d
export DATABASE_URL="postgresql://connectsphere:connectsphere@localhost:5432/connectsphere?schema=public"
export DIRECT_URL="$DATABASE_URL"
npm run db:reset           # LOCAL ONLY: drop, migrate, seed
npm run test:coverage      # likewise test:integration, test:e2e, db:migrate
```

In PowerShell, set `$env:DATABASE_URL` and `$env:DIRECT_URL` instead. The
integration tests skip unless `DATABASE_URL` is localhost, and so do the e2e
specs that guard with `usesLocalDatabase`. Some older e2e specs (for example
`e2e/events.spec.ts`) write without that guard, so never run `test:e2e`
with `.env` pointing at Supabase.

Offline, the same exports let you run the app against Docker too.

> **Postgres 13 or newer is required.** The schema uses the `btree_gist`
> extension (the migration creates it) for the constraints that make venue
> double-booking impossible. Supabase (Postgres 17) and the `postgres:16`
> Docker image both include it.

### Sign in

Every seeded account uses the password **`Password123!`**:

| Email | Role | Why it exists |
|---|---|---|
| `organiser@test.local` | Event Organiser | Owns most seeded events |
| `coordinator@test.local` | Event Coordinator | Assigned to most seeded events |
| `venuestaff@test.local` | Venue Staff | Decided the seeded venue bookings |
| `techsupport@test.local` | Technical Support | Owns the seeded equipment reservations |
| `attendee@test.local` | Attendee | Registered for several events |
| `organiser2@test.local` | Event Organiser | Owns one event, to prove another organiser is refused (SCRUM-68) |
| `coordinator2@test.local` | Event Coordinator | The "previous" coordinator in the reassignment audit entry (SCRUM-21) |
| `attendee2@test.local` | Attendee | Needed to fill an event (SCRUM-74) |
| `attendee3@test.local` | Attendee | Has one withdrawn registration (SCRUM-77) |
| `attendee4@test.local` | Attendee | Deliberately unregistered, so free to take the last place |

No seeded account has the **Event Coordinator Lead** or **Safety Officer**
role yet: neither role has a page beyond Notifications, so there is nothing to
demo. Their sign-in is unit-tested instead (SCRUM-172, TC-172-01).

---

## What the seed gives you

Every scenario exists so a specific acceptance criterion can be
**demonstrated**, not just described. If you add seed data, say in a comment
which story needs it.

**Events:** one in each of the nine statuses (SCRUM-23), plus:

| Event | What it demonstrates |
|---|---|
| `evt_full` | Expected attendance 3, which is its registration capacity, with three active registrations: **full** (SCRUM-74) |
| `evt_last_seat` | Expected attendance 3 with two registrations: **exactly one place left**. The simultaneous-registration test uses it, and `attendee4` is free to take it. |
| `evt_reg_not_open` | Registration opens in a week (SCRUM-75) |
| `evt_reg_closed` | Registration closed yesterday (SCRUM-75) |
| `evt_other_organiser` | Owned by `organiser2`. Loading it as `organiser` must look exactly like "not found" (SCRUM-68). |
| `evt_draft` | No dates and no attendance, which proves those columns really are optional (SCRUM-15) |

**Venues:** four. The Executive Boardroom (capacity 14, few facilities) gives
the suitability check something to mark *not suitable* (SCRUM-40). The Grand
Auditorium and Exhibition Hall already have approved bookings, so availability
and search have a real clash to exclude (SCRUM-36/38). Seminar Room 2.1 has a
maintenance period that is **not** a booking (SCRUM-36/37).

**Equipment:** five pooled types. Three of the ten projectors are in for
maintenance and one PA speaker is written off, so the available quantity is
never simply `totalQuantity` (SCRUM-29/30).

**Also seeded:** an open clarification request; a pending change request with
three changed fields (two major, one not); venue bookings that are approved,
pending, rejected and cancelled (none held or expired yet); an
approved and a pending equipment request with a status history; read and
unread notifications; and audit entries.

> **To demo reserving equipment** (SCRUM-155): sign in as Technical Support,
> open **Equipment requests**, start reviewing and approve the pending
> "Planning — Freshman Orientation" request, then reserve it on **Equipment**.
> The seed has no approved request ready to reserve on purpose: SCRUM-27's
> tests need "Approved — Research Symposium" to have none.

Dates are **relative to today**, not hard-coded, so "registration closes next
week" stays true all term. Row IDs are fixed and tests use them directly, so
don't rename one without updating its callers.

---

## Data model

`prisma/schema.prisma` covers all twenty Release 1 features. Every model and
field names the story that needs it; if you can't find the story for a column,
it should not be there. [`docs/data-model.md`](docs/data-model.md) has the
story-to-table map and the reasoning behind the modelling decisions most
likely to come up in the Q&A.

### Two conventions everything depends on

1. **Periods that touch at an endpoint do not overlap.** A booking ending at
   14:00 does not clash with one starting at 14:00 (SCRUM-29/30/31/36/38/50/53).
   The database stores half-open `[)` ranges, and `lib/period.ts` states the
   rule once for the application. Every availability query must use it.
2. **All datetimes are stored in UTC** (`timestamp(3)`) and shown in Singapore
   time, only through `formatDate` / `formatDateTime` in `lib/datetime.ts`.
   Because the columns carry no time zone, range constraints use `tsrange`,
   not `tstzrange`.

### Rules the database enforces

These live in the migrations under `prisma/migrations/`, below the
`Domain constraints Prisma cannot express` banner and in later migrations.
They make the acceptance criteria hold even when a server action forgets a
check, so don't work around them.

- **A venue is never double-booked.** An `EXCLUDE USING gist` constraint
  refuses a second approved or held booking whose occupied period (its times
  widened by setup and turnaround, SCRUM-159) overlaps an existing one, even
  when two approvals commit at the same instant (SCRUM-53, ADR 0010).
- **A booking never lands on recorded unavailability.** A trigger refuses a
  held or approved booking whose occupied period overlaps recorded
  unavailability, and refuses two overlapping unavailability periods at one
  venue (SCRUM-37, ADR 0010). Since SCRUM-172 the database allows
  unavailability over a booking, for SCRUM-161 to flag it; until then the
  record action still refuses it, under the same venue lock.
- **One live booking per venue per event.** An event can hold at most one
  pending, held or approved booking at each venue; rejected, cancelled and
  expired ones don't count (SCRUM-162 AC2). One venue per event (SCRUM-50 AC8)
  is now enforced by the request action only, until SCRUM-162 lifts it.
- **One open equipment request per event**, and no equipment type twice on a
  request (SCRUM-27).
- **One registration per attendee per event** (SCRUM-73).
- **Operational notes are permanent.** A trigger refuses editing or deleting
  an event's note (a whole event's deletion still cascades), and a CHECK
  refuses a blank one (SCRUM-25 AC6).
- **A rejection carries its reason**, for events, bookings and change requests
  (SCRUM-19/53/128), and a rejected event also carries its outcome: amend and
  resubmit, or start a new request (SCRUM-126).
- **Every event is in Singapore time.** `Event.timezone` must be
  `Asia/Singapore` (SCRUM-129).
- **Valid numbers and periods.** Attendance, capacities, and requested and
  reserved quantities must be above zero (an equipment pool may be zero), and
  every `endAt` must be after its `startAt`.

### Two rules the database cannot enforce

Both are counted pools: overlapping rows are legal until their sum exceeds a
limit. Both are enforced with `SELECT … FOR UPDATE` inside the writing
transaction. **Don't remove these locks.**

- **Registration capacity** (SCRUM-74): lock the `Event` row.
- **Equipment quantity** (SCRUM-31, ADR 0007): lock the `Equipment` rows, in
  id order, after the `Event` row.

---

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| **`npm run verify`** | **Run before every push:** typecheck, lint and unit tests, the checks CI fails on most |
| `npm run build` / `npm run start` | Production build / serve it |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint (Next and Prettier config) |
| `npm run format` / `npm run format:check` | Prettier: write / check only |
| `npm test` | All Vitest tests, unit and integration |
| `npm run test:unit` | Unit tests only (database mocked) |
| `npm run test:integration` | Integration tests against a real Postgres: **local database only** |
| `npm run test:coverage` | All Vitest tests with the 100% coverage check that CI runs: **local database only** |
| `npm run test:e2e` | Playwright: builds and serves the app, then runs the specs: **local database only** |
| `npm run db:deploy` | Apply pending migrations; the only migration command for the shared database |
| `npm run db:seed` | Re-run the idempotent seed on the shared database: deletes nothing, but resets seeded rows to their seed values |
| `npm run db:migrate` | Create and apply a new migration: **local database only** |
| `npm run db:reset` | Drop, migrate and seed: **local Docker only** |
| `npm run db:generate` | Regenerate the Prisma client |

> **"Local database only"** means the terminal points at Docker first: see
> [Local database (Docker)](#local-database-docker). Never run these bare:
> `.env` points at the shared database. Without a local database the
> integration tests are skipped, and `test:coverage` fails on files only they
> cover.
>
> **Playwright** also needs a browser the first time
> (`npx playwright install chromium`).

### Migration rules

- **Never edit or delete a migration that is already on `main`.** Fix forward
  with a new one. The graders rebuild the database from scratch, and
  rewritten history is how a team ends up with one nobody can rebuild.
- **Never use `prisma db push`.** It changes the schema without a migration
  file, so your change reaches nobody else's database and production drifts.
- **Keep migrations additive.** Merging to `main` applies a migration to the
  shared database before the new code is live (`deploy.yml`), while the
  previous deployment is still serving, and it stays applied if the build
  then fails. So add tables, nullable columns or columns with a default, and
  constraints existing rows already meet. Dropping or renaming a column the
  running code reads, or changing its type, takes two pull requests: first
  stop the code using it, then remove it.
- **If a migration fails part way,** later deploys stop with Prisma's P3009
  ("migrate found failed migrations") until it is resolved. Fix the database
  by hand or in a new migration, then mark it with
  `npx prisma migrate resolve --applied <name>` (or `--rolled-back <name>`)
  against the shared database, and re-run the deploy from the Actions tab.
- **Announce a `schema.prisma` change at standup before you make it.** Five
  people edit that one file, and it is this repo's most common merge conflict.
- If `prisma migrate dev` reports drift mentioning the partial or GiST
  indexes, that is expected: Prisma can't model partial `WHERE` indexes or
  `EXCLUDE` constraints, so it ignores them. Don't "fix" it by deleting them.

---

## Project layout

Routes are grouped by **domain**, not by role. A route several roles use is
one folder whose page switches on the user's role (ADR 0001's addendum). Each
domain folder maps to one backlog epic.

```
.env.example                  Every variable the app reads
docker-compose.yml            Local Postgres: offline fallback and integration tests
proxy.ts                      Auth gate for every protected route (was middleware.ts)
auth.ts, auth.config.ts       Auth.js set-up (JWT sessions, ADR 0002)
prisma/
  schema.prisma               The full Release 1 data model
  migrations/                 Ordered, never rewritten; the constraints live here
  seed.ts                     Idempotent demo data
app/
  (auth)/login/               Sign-in page
  (app)/                      Everything behind sign-in (protected by proxy.ts)
    layout.tsx                Shell: header, role-based nav, user menu
    page.tsx                  Sends each role to its landing page
    events/                   SCRUM-6   event requests to confirmation; the reference feature
    venues/                   SCRUM-7   venue catalogue, search and availability calendar
    bookings/                 SCRUM-7   booking requests and Venue Staff decisions
    equipment-requests/       SCRUM-10  Coordinator requests, Technical Support review
    equipment/                SCRUM-10  availability check and reserving approved requests
    registrations/            SCRUM-11  an attendee's registrations
    notifications/            SCRUM-8   each user's notification list (SCRUM-48)
lib/
  auth/can.ts                 Authorisation: roles and relationships, in one place (ADR 0004)
  auth/guard.ts               requireSession(), used by every page
  schemas/                    Zod schemas shared by forms and actions
  equipment/                  Equipment availability and request rules
  period.ts                   The one overlap rule for every period
  datetime.ts                 The only place dates are formatted (Asia/Singapore)
  db.ts, db-errors.ts         Shared Prisma client; recognising Postgres refusals
components/ui/                shadcn/ui primitives
tests/
  unit/                       Vitest with the database mocked
  integration/                Vitest against a real Postgres: locks, transactions, races
e2e/                          Playwright specs, one or more per journey
docs/
  product-context.md          The product in one page: roles, features, scope, lifecycle
  backlog/                    Every story's acceptance criteria, generated from Jira
  testing/                    Test case specifications, one file per story
  data-model.md               What each table is for and which story needs it
  adr/                        Architecture Decision Records, with an index
  evidence/                   Screenshots and CI logs captured for sprint reviews
.github/
  workflows/                  CI, the GLM review, its memory, and deploys
  ai-review/                  The GLM reviewer's instructions and memory
```

`docs/backlog/` is generated from Jira. **Jira is the source of truth**, so
re-sync rather than editing those files (see `docs/backlog/README.md`).

---

## Production notes (Vercel + Supabase)

- The app runs on Vercel and the database on Supabase. Production deploys from
  GitHub Actions when `main` changes (ADR 0009); there are no preview deploys.
- Set **both** `DATABASE_URL` and `DIRECT_URL` to the Supabase **session
  pooler**: port `5432`, user `postgres.<project-ref>`, host
  `aws-0-<region>.pooler.supabase.com`. The two "obvious" alternatives fail:
  - the direct host `db.<ref>.supabase.co` is **IPv6-only**, so on an
    IPv4-only network (most homes and campus Wi-Fi) it times out silently;
  - the transaction pooler (port `6543`, `?pgbouncer=true`) breaks the
    prepared statements the `pg` driver adapter relies on.
- Production needs exactly three variables: `DATABASE_URL`, `DIRECT_URL` and
  `AUTH_SECRET`. **Paste them without quotes.** The quotes in `.env.example`
  are dotenv syntax, and Vercel stores them literally.
- Don't set `AUTH_URL` in production: the app reads the host from the request.
  Don't set `AUTH_TRUST_HOST` either: it is `trustHost: true` in
  `auth.config.ts`, so it can't be forgotten or mis-quoted.
- After changing an environment variable, **redeploy**. A running deployment
  keeps the values it was built with.
- **Migrations apply themselves.** Every production deploy runs `prisma migrate
  deploy` against the shared database before it builds (`deploy.yml`), so the
  database is always on the schema of the code on `main`; if a migration
  fails, nothing is deployed. To apply one by hand, use `npm run db:deploy`,
  never `db:reset`.
- Supabase permits `CREATE EXTENSION btree_gist`, so the double-booking
  constraint deploys unchanged.

> **Don't use Supabase Row Level Security.** Prisma connects with a privileged
> role that bypasses it, so it would only give a false sense of protection.
> Authorisation lives in `lib/auth/can.ts` (ADR 0004).
