# ADR 0005 — CI runs every job against a throwaway database

Stories: none; a team decision about the build.

## Context

Continuous integration is graded evidence for this module, and it gates the
only path into production: `main` is protected and cannot merge until the CI
job `build-and-test` passes. So the pipeline must answer, on every push and
pull request, the strongest question available: *would this code deploy and
behave correctly starting from nothing?*

The live database makes that impossible to answer directly. Application
deployments and Vercel previews all share one Supabase PostgreSQL instance, so
any CI run that seeded or wrote there would corrupt the data the whole team
develops against — and two overlapping CI runs would collide with each other.
Testing against the shared database also cannot prove the migration chain
works, because that database is already migrated.

## Decision

Every CI job provisions its own **temporary PostgreSQL container — an empty
`connectsphere` database that lives exactly as long as the job** — and runs
the full pipeline against it, in this order:

1. Start the temporary PostgreSQL container (empty database named
   `connectsphere`).
2. `npm ci` — install dependencies; Prisma Client is generated in postinstall.
3. `npm run db:deploy` — apply migrations: tables, columns, enums,
   constraints, indexes.
4. `npm run db:seed` — insert the known users, roles, events, bookings.
5. `npm run typecheck`
6. `npm run lint`
7. `npm run test:coverage` — unit + integration tests, with coverage.
8. `npx playwright install --with-deps chromium`
9. `npm run test:e2e` — Playwright builds and starts the app against the same
   container.
10. Upload artifacts: `coverage/` and `playwright-report/`.
11. Job ends — the container is discarded; nothing the tests wrote survives
    the run.

The order is deliberate. Migrate and seed **before** any test runs, so a
broken migration or seed fails the job immediately and no test result can mask
it; the Playwright run comes last because it is the slowest step and needs
everything before it.

The job lives in `.github/workflows/ci.yml`. It runs on every `pull_request`,
testing the branch merged into the current `main`, and on every `push` to
`main`, so each merged commit keeps its own result. It used to run on pushes
to every branch as well, which ran the same job twice per commit on a branch
with an open pull request; on 2026-10-01 pushes to other branches were
dropped, so a pull request shows one `build-and-test`. A branch with no pull
request open gets no CI until one is.

## Alternatives rejected

- **Run CI against the shared Supabase.** Destructive: seeding would overwrite
  the team's data, e2e writes would land in production, concurrent runs would
  collide, and the credentials would live in CI. Rejected outright.
- **No database in CI** (type-check, lint, unit tests only). Cheaper, but then
  migrations, the seed, and every e2e journey are untested until a human
  deploys — exactly the evidence the module grades. Rejected.
- **A persistent CI database** (a long-lived service or restored snapshot).
  Faster in theory, but state drifts between runs: yesterday's seed residue
  changes today's results, and the migration chain is never re-proven from
  empty. The ephemeral container costs a few seconds to start; determinism is
  worth far more. Rejected.

## Consequences

- A green run means the whole chain works from nothing: install → migrate →
  seed → build → test. That is the strongest statement CI can make, and it
  catches migration drift (an applied migration edited by hand, or a schema
  change without a migration) on every push.
- Tests may freely write to the database — the e2e suite signs in, creates
  events, and mutates state without any cleanup discipline, because
  destruction is guaranteed at step 11.
- Integration tests depend on `DATABASE_URL` being a real process environment
  variable, which CI injects. Vitest does **not** load `.env`, so those same
  tests need an explicit `DATABASE_URL` to run locally — point it at the
  Docker container (`docker compose up -d`), never at Supabase.
- Each run costs roughly 2–3 minutes of Actions time; the Playwright browser
  install is the largest slice.
- The container image (`postgres:16-alpine`, matching `docker-compose.yml`)
  is pinned independently of Supabase's Postgres version. Keep the two aligned
  when Supabase upgrades, or a query valid in CI may still fail in production.

## Addendum (2026-10-11) — Corrections from the docs audit (SCRUM-173)

The step list above uploads every artifact at the end. `.github/workflows/ci.yml`
now uploads the coverage report straight after step 7, before the Playwright
browser is installed, and the Playwright report last. The order of migrate,
seed, then tests is unchanged.
