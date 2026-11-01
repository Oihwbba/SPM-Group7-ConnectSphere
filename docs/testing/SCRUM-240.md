# SCRUM-240 — The live app hits Supabase's connection limit because the database pool has no maximum: test cases

SCRUM-240 is a Bug task in Jira, raised from the production issue found while
testing SCRUM-198. Its acceptance criteria, as filed:

1. The database pool in `lib/db.ts` has a small maximum number of connections,
   so the running copies of the app stay under Supabase's limit of 15.
2. A test checks that the pool is created with that maximum.
3. After the fix is deployed, My Events, Bookings and sign-in load without
   "This page couldn't load", and the Vercel logs show no new
   `EMAXCONNSESSION` errors.

Format and conventions: [README.md](README.md).

**Why it failed:** Supabase's session pooler accepts 15 clients, shared by
every Vercel instance and every dev server on the shared database. The Pool had
no `max`, so each copy could open pg's default of 10. The fix caps the Pool at
3 on Supabase and leaves a local database at the default; why:
[ADR 0022](../adr/0022-cap-the-database-pool-on-supabase.md).

**Shared pre-conditions:** the unit cases mock `pg`, Prisma and the adapter,
and check the options the Pool is created with. TC-240-04 runs against the
live app after the fix is deployed.

| ID | Type | Criterion | Automated |
|---|---|---|---|
| [TC-240-01](#tc-240-01) | Positive | AC 1, AC 2 | Unit |
| [TC-240-02](#tc-240-02) | Boundary | AC 1 | Unit |
| [TC-240-03](#tc-240-03) | Negative | AC 1 | Unit |
| [TC-240-04](#tc-240-04) | Positive | AC 3 | Manual |

---

### TC-240-01

| Item | Content |
|---|---|
| Test Case ID | TC-240-01 |
| Test Scenario | [Positive] AC 1, AC 2: a pool on Supabase opens at most 3 connections |
| Pre-conditions | `DATABASE_URL` is the Supabase session pooler |
| Test Steps | 1. Load the shared Prisma client. |
| Test Data | `postgresql://postgres.ref:…@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres` |
| Expected Result | The Pool is created with that connection string and `max: 3`. |

**Automated by:** `tests/unit/db.test.ts` › "SCRUM-240 [AC1, AC2] TC-240-01: a pool on Supabase opens at most 3 connections"

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
| Expected Result | Both times the Pool is created with `max: 3`. |

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
