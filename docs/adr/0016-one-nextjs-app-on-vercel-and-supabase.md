# ADR 0016 — One Next.js app with Prisma on Supabase, deployed to Vercel

Stories: none directly. This is the platform every Release 1 story runs on.

Written on 2026-10-11 (SCRUM-174), after the fact. The team chose this stack
when the project started, and the foundation commit on 2026-09-08 already uses
it. ADRs 0002, 0005, 0009 and 0010 build on this decision, so this record
explains the choice they assume.

## Context

ConnectSphere is built by a team of five students, part-time and with no
budget. These needs shaped the choice of stack:

- **No cost.** Hosting and the database have to be free for the life of the
  project.
- **One place to see the product.** The team, the Product Owner and the
  graders should all see the same running app with everyone's merged work and
  the same data. Five laptops, each with its own copy of the data, don't give
  that.
- **Rules that hold when two people act at once.** The customer's worst
  problem is a double-booked venue. Two approvals at the same moment must not
  both succeed, and the same goes for the last place at an event and for
  equipment stock. The database has to enforce these rules, not just the code
  (ADR 0007, ADR 0010).
- **Every action checked on the server**, for both role and relationship
  (ADR 0004).
- **Five people working in parallel** in one codebase, with mixed experience.
  The fewer languages and moving parts, the better.

## Decision

- **One Next.js application** (App Router, TypeScript in strict mode). Pages
  render on the server, and every change goes through a Server Action, so
  there is no separate API service to build, host or secure. Each Server
  Action checks the caller through `can()` before it reads or writes, most
  with `requirePermission` as their first statement (ADR 0004). Those that
  take form input validate it with a Zod schema.
- **PostgreSQL, hosted by Supabase, used through Prisma.** Supabase is only the
  database host: the app uses no Supabase client library, sign-in or storage.
  It connects through Supabase's session pooler in Singapore. Prisma Migrate
  keeps the schema in versioned migrations, and the rules Prisma can't express
  (exclusion constraints, triggers, partial unique indexes) are SQL in those
  same migrations (ADR 0010).
- **Auth.js** with the Credentials provider and JWT sessions (ADR 0002).
- **Vercel** hosts the app. GitHub Actions deploys every push to `main`
  (ADR 0009), and there are no preview deployments.
- **Tests in the same language**: Vitest for unit and integration tests and
  Playwright for end-to-end tests, run in CI against a throwaway Postgres
  (ADR 0005).
- The interface uses Tailwind CSS and shadcn/ui components.

The main reasons:

1. **It's free.** Vercel's Hobby plan and Supabase's free plan both cover a
   project this size.
2. **One unified view as soon as anyone merges.** `main` deploys itself to one
   URL, against the one shared database. When a pull request merges, everyone
   sees the integrated product with the same seeded accounts and data, and
   nobody has to run anyone else's branch to see it working.
3. **One language from the database to the browser.** Prisma generates
   TypeScript types from the schema, so a renamed column breaks the build
   instead of a page. Zod schemas check the same shapes on the server.
4. **PostgreSQL has what the rules need**: exclusion constraints (with
   `btree_gist`) for venue bookings that must never overlap,
   `SELECT … FOR UPDATE` row locks for stock and registration places, partial
   unique indexes and triggers.
5. **Vercel builds Next.js with no configuration**, since the same company
   makes both.

## Alternatives rejected

- **Flask, SQLAlchemy, Jinja and htmx.** A draft ADR proposed this on
  2026-09-08, kept outside the repo, and the team didn't adopt it. It means
  Python on the server and JavaScript in the browser wherever htmx isn't
  enough (dialogs, forms that show errors next to each field), so two
  languages and two sets of tools. It also loses the shared types between the
  database model and the pages. The foundation commit the same day was
  Next.js.
- **A React single-page app with a separate API** (for example Express or
  FastAPI). That is two things to deploy, an API contract to keep in step,
  sign-in checked on both sides, and twice the hosting to keep free.
- **Supabase's own client, sign-in and row-level security, called from the
  browser.** Authorisation would be split between SQL policies and app code.
  ADR 0004 keeps it in one `can()` table. Seeded accounts with Auth.js cover
  Release 1, because self-registration isn't needed (SCRUM-153).
- **SQLite or a document database.** Neither has PostgreSQL's exclusion
  constraints. SQLite also needs a disk that lasts, which Vercel's functions
  don't have, so the deployed app couldn't share it.
- **Paid plans** (Vercel Pro, a hosted server). They cost money. ADR 0009
  works around the Hobby plan's limit instead.

## Consequences

- **The free plans set limits we work around.**
  - On Hobby, Vercel deploys a commit from a private repository only when the
    account owner wrote it. So production deploys from GitHub Actions with the
    owner's token (ADR 0009).
  - Supabase's free plan allows two active projects per organisation, and it
    pauses a project after about a week with no activity. If the app stops
    connecting between sprints, restore the project from the Supabase
    dashboard.
- **One shared database gives everyone the same data, and one mistake affects
  everyone.** `npm run db:reset` against `.env` wipes it for the whole team
  (CLAUDE.md), so tests run on a local Docker database or on CI's throwaway
  one (ADR 0005). A migration has to reach the shared database before the code
  that needs it deploys (SCRUM-89).
- **No preview deployments.** A branch runs only on its author's machine until
  it merges, so CI (unit, integration and end-to-end tests) is what stands
  between a branch and production.
- **Server Actions are public endpoints.** Anyone can call one with a crafted
  request, so each one checks the caller and validates its input itself
  (ADR 0004).
- **The domain rules depend on PostgreSQL, not on Supabase.** Any host running
  Postgres 13 or newer with `btree_gist` can run the migrations (README).
- **Next.js 16 differs from the older versions most tutorials describe.**
  CLAUDE.md points to the docs shipped in `node_modules/next/dist/docs/`.
