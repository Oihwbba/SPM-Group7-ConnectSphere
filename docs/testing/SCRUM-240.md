# SCRUM-240 — The live app hits Supabase's connection limit because the database pool has no maximum: test cases

SCRUM-240 is a Bug task in Jira, raised from the production issue found while
testing SCRUM-198, and reopened on 2 Nov when AC 3 failed. Its acceptance
criteria, as in Jira:

1. The database pool in `lib/db.ts` has a small maximum number of connections,
   so the running copies of the app stay under Supabase's session pooler limit.
2. A test checks that the pool is created with that maximum.
3. After the fix is deployed, My Events, Bookings and sign-in load without
   "This page couldn't load", and the Vercel logs show no new
   `EMAXCONNSESSION` errors.
4. An idle database connection is closed within seconds even on Vercel, where
   instances are paused between requests, so instances from an earlier deploy
   don't keep holding the pooler's connections. A test checks it.
5. Supabase's session pooler accepts 43 connections (its Pool Size setting,
   raised from 15), and the docs give that limit.

Format and conventions: [README.md](README.md).

**Why it failed:** Supabase's session pooler accepts 15 clients, shared by
every Vercel instance and every dev server on the shared database. The Pool had
no `max`, so each copy could open pg's default of 10. The fix caps the Pool at
3 on Supabase and leaves a local database at the default; why:
[ADR 0022](../adr/0022-cap-the-database-pool-on-supabase.md).

**Why it failed again:** Vercel pauses an instance between requests, which also
pauses pg's timer that closes idle connections. So paused instances, including
ones left from an earlier deploy, kept their connections. The pool now closes
an idle connection after 5 seconds, and is handed to Vercel's
`attachDatabasePool`, which keeps the instance awake until it has. The
pooler's pool size went from 15 to 43
([ADR 0022, addendum](../adr/0022-cap-the-database-pool-on-supabase.md)).

**Shared pre-conditions:** the unit cases mock `pg`, Prisma and the adapter,
and check the options the Pool is created with. TC-240-06 and TC-240-07 use
the real `pg` Pool and the real `@vercel/functions` helper with fake timers,
and emit a connection's release by hand, so nothing connects. TC-240-04 and
TC-240-08 run against the live app and Supabase after the fix is deployed.
TC-240-09 runs the app's own `lib/db.ts` client against the shared Supabase
pooler, with read-only queries.

| ID | Type | Criterion | Automated |
|---|---|---|---|
| [TC-240-01](#tc-240-01) | Positive | AC 1, AC 2, AC 4 | Unit |
| [TC-240-02](#tc-240-02) | Boundary | AC 1 | Unit |
| [TC-240-03](#tc-240-03) | Negative | AC 1 | Unit |
| [TC-240-04](#tc-240-04) | Positive | AC 3 | Manual |
| [TC-240-05](#tc-240-05) | Positive | AC 4 | Unit |
| [TC-240-06](#tc-240-06) | Boundary | AC 4 | Unit |
| [TC-240-07](#tc-240-07) | Negative | AC 4 | Unit |
| [TC-240-08](#tc-240-08) | Positive | AC 5 | Manual |
| [TC-240-09](#tc-240-09) | Positive | AC 1, AC 4, AC 5 | Manual |

---

### TC-240-01

| Item | Content |
|---|---|
| Test Case ID | TC-240-01 |
| Test Scenario | [Positive] AC 1, AC 2, AC 4: a pool on Supabase opens at most 3 connections and closes an idle one after 5 seconds |
| Pre-conditions | `DATABASE_URL` is the Supabase session pooler |
| Test Steps | 1. Load the shared Prisma client. |
| Test Data | `postgresql://postgres.ref:…@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres` |
| Expected Result | The Pool is created with that connection string, `max: 3` and `idleTimeoutMillis: 5000`. |

**Automated by:** `tests/unit/db.test.ts` › "SCRUM-240 [AC1, AC2, AC4] TC-240-01: a pool on Supabase opens at most 3 connections and closes an idle one after 5 seconds"

### TC-240-02

| Item | Content |
|---|---|
| Test Case ID | TC-240-02 |
| Test Scenario | [Boundary] AC 1: a pool on a local database keeps pg's default size |
| Pre-conditions | `DATABASE_URL` is a local database |
| Test Steps | 1. Load the shared Prisma client with each URL in turn. |
| Test Data | `…@127.0.0.1:5432/connectsphere?schema=public`, `…@localhost:5432/connectsphere`, `…@localhost/connectsphere` (no port) |
| Expected Result | The Pool is created with the connection string and no `max`, so pg's default of 10 applies. |

**Automated by:** `tests/unit/db.test.ts` › "SCRUM-240 [AC1] TC-240-02: a pool on a local database keeps pg's default size (%s)"

### TC-240-03

| Item | Content |
|---|---|
| Test Case ID | TC-240-03 |
| Test Scenario | [Negative] AC 1: a database not known to be local is capped |
| Pre-conditions | Step 1: `DATABASE_URL` names a remote host beginning with `localhost`. Step 2: `DATABASE_URL` is not set. |
| Test Steps | 1. Load the shared Prisma client. <br> 2. Load it again with no `DATABASE_URL`. |
| Test Data | `postgresql://user:…@localhost.example.com:5432/postgres` |
| Expected Result | Both times the Pool is created with `max: 3` and `idleTimeoutMillis: 5000`. |

**Automated by:** `tests/unit/db.test.ts` › "SCRUM-240 [AC1] TC-240-03: a host that only starts with localhost is not local", "SCRUM-240 [AC1] TC-240-03: with no DATABASE_URL, the database isn't known to be local, so the pool is capped"

### TC-240-04

| Item | Content |
|---|---|
| Test Case ID | TC-240-04 |
| Test Scenario | [Positive] AC 3: the live app loads under load without hitting the connection limit |
| Pre-conditions | The fix is deployed to production; signed in as the seeded Event Coordinator |
| Test Steps | 1. Open My Events and Bookings in 8 tabs. <br> 2. Refresh every tab quickly, three times. <br> 3. Sign out and sign in again three times. <br> 4. In Vercel → Logs, search the time since the deploy for `EMAXCONNSESSION`. |
| Test Data | `coordinator@test.local` / `Password123!` |
| Expected Result | Every tab loads, with no "This page couldn't load"; every sign-in succeeds; the log search finds no `EMAXCONNSESSION` after the deploy. |

**Automated by:** Manual. It needs the deployed app on the shared Supabase database, which tests must not write to or load.

### TC-240-05

| Item | Content |
|---|---|
| Test Case ID | TC-240-05 |
| Test Scenario | [Positive] AC 4: the client's pool is handed to Vercel's idle-connection handling |
| Pre-conditions | `DATABASE_URL` is the Supabase session pooler, then a local database |
| Test Steps | 1. Load the shared Prisma client with each URL in turn. |
| Test Data | The Supabase URL from TC-240-01; `…@127.0.0.1:5432/connectsphere` |
| Expected Result | Each time, `attachDatabasePool` is called once, with the Pool the client uses. |

**Automated by:** `tests/unit/db.test.ts` › "SCRUM-240 [AC4] TC-240-05: the client's pool is handed to Vercel's idle-connection handling (%s)"

### TC-240-06

| Item | Content |
|---|---|
| Test Case ID | TC-240-06 |
| Test Scenario | [Boundary] AC 4: on Vercel, a released connection keeps the instance awake until the idle timeout has passed |
| Pre-conditions | `VERCEL_URL` and `VERCEL_REGION` are set; a request context provides `waitUntil`; `DATABASE_URL` is the Supabase session pooler |
| Test Steps | 1. Load the shared Prisma client. <br> 2. Release a connection from its Pool. <br> 3. Let 5000 ms pass, then 100 ms more. |
| Test Data | Fake timers; the real `pg` Pool and `@vercel/functions` |
| Expected Result | `waitUntil` is given one promise. It is still pending at 5000 ms and settled by 5100 ms, so the instance stays awake until just after the 5-second idle timeout. |

**Automated by:** `tests/unit/db-idle-connections.test.ts` › "SCRUM-240 [AC4] TC-240-06: on Vercel, a released connection keeps the instance awake until the 5-second idle timeout has passed"

### TC-240-07

| Item | Content |
|---|---|
| Test Case ID | TC-240-07 |
| Test Scenario | [Negative] AC 4: off Vercel, a released connection keeps nothing awake |
| Pre-conditions | `VERCEL_URL` and `VERCEL_REGION` are empty; a request context provides `waitUntil` |
| Test Steps | 1. Load the shared Prisma client. <br> 2. Release a connection from its Pool. |
| Test Data | The real `pg` Pool and `@vercel/functions` |
| Expected Result | `waitUntil` is never called. |

**Automated by:** `tests/unit/db-idle-connections.test.ts` › "SCRUM-240 [AC4] TC-240-07: off Vercel, a released connection keeps nothing awake"

### TC-240-08

| Item | Content |
|---|---|
| Test Case ID | TC-240-08 |
| Test Scenario | [Positive] AC 5: the session pooler accepts 43 connections |
| Pre-conditions | Signed in to the Supabase dashboard for the `connectsphere` project |
| Test Steps | 1. Open Database → Settings → Connection pooling. <br> 2. In the Supabase logs (`supavisor_logs`), search for `EMAXCONNSESSION` since the change. |
| Test Data | - |
| Expected Result | Connection pool size reads 43, and no error since the change mentions `pool_size: 15`. |

**Automated by:** Manual. The pool size is a Supabase project setting, not code.

### TC-240-09

| Item | Content |
|---|---|
| Test Case ID | TC-240-09 |
| Test Scenario | [Positive] AC 1, AC 4, AC 5: on the real Supabase pooler, the app's client uses at most 3 connections and closes each one 5 seconds after its last query |
| Pre-conditions | `DATABASE_URL` is the shared Supabase session pooler. `NODE_ENV=production`, and `VERCEL_URL` and `VERCEL_REGION` are set, as in a Vercel function. A stand-in request context records what is passed to `waitUntil`. |
| Test Steps | 1. Load the shared Prisma client from `lib/db.ts`. <br> 2. Run 10 read-only queries at once (`select 1 as n from pg_sleep(0.7)`), and count them in `pg_stat_activity` from a second connection while they run. <br> 3. Count the Pool's open connections 1 s, 4.5 s and 5.6 s after the last query. <br> 4. In the Supabase logs (`supavisor_logs`), find "Terminate received from client" for the test machine. <br> 5. Separately, open connections one at a time until the pooler refuses. |
| Test Data | Read-only queries only; at most 4 of the pooler's connections, for about 6 s |
| Expected Result | At most 3 connections open and at most 3 queries run at once on Supabase. Every connection is closed by 5.6 s after its last query, and `waitUntil` settles once they are. The pooler logs one close per connection, 5 s after its last use. The refusal names `pool_size: 43`. |

**Result on 2 Nov 2026, 14:57 UTC:** 3 connections at most, and 3 queries at once on Supabase. Open connections: 3 at 1 s after the last query, 1 at 4.5 s (the other two had been idle longer), 0 at 5.6 s. `waitUntil` settled 5.1 s after the last release. The pooler logged the three closes at 14:57:33.2, 33.2 and 33.9, each 5 s after that connection's last query. In step 5, the pooler accepted 33 connections on top of the 10 already in use and refused the 34th, naming `pool_size: 43`.

**Automated by:** Manual. It loads the shared database, which automated tests must not touch.
