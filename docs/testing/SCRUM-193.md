# SCRUM-193 — Integration tests time out alongside other files: test cases

SCRUM-193 is a Bug task in Jira, not a story, so it has no file in
[docs/backlog](../backlog/README.md) until the next sync. Its acceptance
criteria, as filed:

1. SCRUM-142's TC-142-18 has a longer timeout, so it passes in the whole suite.
2. TC-142-18's venue is deleted even when the test times out: its `finally`
   can't fail because the suite already deleted the booking, and the suite's
   `afterAll` deletes the venue too.
3. The `beforeAll` of both SCRUM-172 migration suites has the same 60 s
   timeout as the opening-hours migration suite.
4. The whole Vitest suite with coverage passes against the local database.

Format and conventions: [README.md](README.md).

**Why these time out:** Vitest's defaults are 5 s a test and 10 s a hook, and
the files run in parallel against one database. TC-142-18 makes about twenty
round trips; each migration suite creates a scratch database and replays every
earlier migration in `beforeAll`. A timed-out test keeps running, so the
suite's `afterAll` can delete its booking before the test's `finally` runs.

**Shared pre-conditions for every case:** a local PostgreSQL migrated with
`npm run db:deploy` and seeded with `npm run db:seed`.

| ID | Type | Criterion | Automated |
|---|---|---|---|
| [TC-193-01](#tc-193-01) | Positive | AC 1, AC 3, AC 4 | Integration (the whole suite) |
| [TC-193-02](#tc-193-02) | Negative | AC 2 | Manual |

---

### TC-193-01

| Item | Content |
|---|---|
| Test Case ID | TC-193-01 |
| Test Scenario | [Positive] AC 1, AC 3, AC 4: the slow tests pass with the other files |
| Pre-conditions | — |
| Test Steps | 1. Run `npm run test:coverage` against the local database, with Vitest's default timeouts. |
| Test Data | — |
| Expected Result | Every file passes, including `change-or-withdraw.test.ts` (TC-142-18), `week7-migration.test.ts` and `w9-migration.test.ts`, and coverage meets its thresholds. |

**Automated by:** `tests/integration/change-or-withdraw.test.ts` › "SCRUM-142 [AC10] TC-142-18: after a line is only removed, Confirm waits for Technical Support to approve the request again"; the `beforeAll` of `tests/integration/week7-migration.test.ts` and `tests/integration/w9-migration.test.ts`

### TC-193-02

| Item | Content |
|---|---|
| Test Case ID | TC-193-02 |
| Test Scenario | [Negative] AC 2: a timed-out TC-142-18 leaves no venue behind |
| Pre-conditions | No venue named `SCRUM-142 AC10 venue …` exists. |
| Test Steps | 1. Lower TC-142-18's timeout to 200 ms. <br> 2. Run `npx vitest run tests/integration/change-or-withdraw.test.ts -t "TC-142-18"`. <br> 3. List the venues named `SCRUM-142%`. |
| Test Data | — |
| Expected Result | Step 2: the test times out. Step 3: no venue is listed. With the cleanup before this fix, one `SCRUM-142 AC10 venue …` is left. |

**Manual:** a timeout can't be forced from inside the suite without slowing it. Run on 19 Oct 2026: no venue left with the fix; one left with `main`'s cleanup.
