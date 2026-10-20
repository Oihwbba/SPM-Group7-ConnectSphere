<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-20. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-193 - Bug: SCRUM-142's TC-142-18 and SCRUM-172's migration suites time out alongside other files, and a timed-out TC-142-18 leaves a test venue behind

| | |
|---|---|
| **Type** | Task |
| **Epic** | - |
| **Priority** | Medium |
| **Story points** | - |
| **Status in Jira** | Done |
| **Sprint** | SCRUM Sprint 3 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-193 |

---

Found by Felicia running the whole Vitest suite against the local database: three integration tests can exceed Vitest's default timeout when other files run alongside them, and one of them leaves data behind when it does.

**1. SCRUM-142's TC-142-18** (`tests/integration/change-or-withdraw.test.ts`) does about twenty database round trips (a reserved request, its own venue and booking, a safety check, a change, two status updates and four readiness reads), so it can exceed the default timeout under load.

**2. A timed-out TC-142-18 leaves its venue.** On a timeout the suite's `afterAll` runs while the test is still going and deletes the test's booking. The test's `finally` then fails on `booking.delete`, so the `SCRUM-142 AC10 venue …` it made is never deleted, and that leftover venue breaks the venue-search e2e.

**3. SCRUM-172's migration suites** (`tests/integration/week7-migration.test.ts`, `w9-migration.test.ts`) create a scratch database and apply every earlier migration in `beforeAll`, which exceeds the default hook timeout alongside other files. `venue-opening-hours-migration.test.ts` already gives the same hook 60 s.

**Acceptance criteria**

1. TC-142-18 has a longer timeout, so it passes in the whole suite.
2. TC-142-18's venue is deleted even when the test times out: its `finally` can't fail because the suite already deleted the booking, and the suite's `afterAll` deletes the venue too.
3. The `beforeAll` of both SCRUM-172 migration suites has the same 60 s timeout as the opening-hours migration suite.
4. The whole Vitest suite with coverage passes against the local database.

Related: SCRUM-142, SCRUM-172, SCRUM-191.
