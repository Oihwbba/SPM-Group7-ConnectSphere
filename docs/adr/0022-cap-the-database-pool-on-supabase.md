# ADR 0022 — Cap each copy of the app at 3 database connections on Supabase

## Context

The live app sometimes showed "This page couldn't load" on My Events and
Bookings, and sign-ins sometimes failed. Vercel's logs showed
`EMAXCONNSESSION: max clients reached` (SCRUM-240).

Supabase's session pooler, which both database URLs go through (README,
"Production notes"), accepts 15 clients at once. Every copy of the app counts
against that one limit: each Vercel instance, and each teammate's `next dev`
pointed at the shared database through `.env`. `lib/db.ts` created its `pg`
Pool with no `max`, so each copy could open pg's default of 10. Two busy copies
were enough to use up the 15.

## Decision

1. **At most 3 connections per copy of the app on Supabase.** `lib/db.ts`
   gives the Pool `max: 3`. A page that runs several queries at once
   (`Promise.all`) queues the extra ones for a moment instead of opening more
   connections. Five copies at their busiest fit under the limit together.
2. **A local database keeps pg's default.** When `DATABASE_URL` points at
   `localhost` or `127.0.0.1` (the Docker database and CI's service
   container), the Pool is left at 10. The local database has no 15-client
   limit, and the concurrency tests run several transactions at once against
   it. The check is the same one the integration and e2e tests use to decide
   that a database is local.
3. **The limit doesn't depend on `NODE_ENV`.** It depends on the database
   server, not the build: a teammate's dev server on the shared database is
   capped too, and `next start` in CI on the local database isn't.

No transaction runs a query through the shared client while it holds its own
connection (every query inside `$transaction` uses `tx`), so a small pool
can't deadlock on itself. A transaction waits for a free connection instead.

## Alternatives rejected

- **`max: 1`.** It fits the most copies under the limit, but it runs a page's
  parallel queries one at a time and makes every transaction wait for every
  other request on that instance.
- **A `DATABASE_POOL_MAX` environment variable.** Production would need a
  fourth variable that the README says it doesn't, and forgetting it brings
  the bug back. Nothing yet needs a different size.
- **The transaction pooler (port 6543).** It has a much higher client limit,
  but it breaks the prepared statements the `pg` driver adapter relies on
  (`.env.example`).
- **A paid Supabase plan with a larger pool.** The project runs on the free
  tier (ADR 0016).

## Consequences

- Under a burst, a request can wait briefly for a connection instead of
  failing. A transaction that waits longer than Prisma's default `maxWait`
  (2 seconds) fails with a timeout. That is far rarer than the failures it
  replaces, and it shows up in the logs as a transaction timeout, not as
  `EMAXCONNSESSION`.
- If the app later runs on more than five instances at once, 15 is still the
  ceiling. Revisit this number then.
- Tests: `tests/unit/db.test.ts` (SCRUM-240), cases in
  [docs/testing/SCRUM-240.md](../testing/SCRUM-240.md).
