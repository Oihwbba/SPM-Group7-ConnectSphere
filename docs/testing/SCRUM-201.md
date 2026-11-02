# SCRUM-201 — TC-124-02 borrows another suite's equipment: test cases

SCRUM-201 is a Bug task in Jira, not a story, so it has no file in
[docs/backlog](../backlog/README.md) until the next sync. Its acceptance
criteria, as filed:

1. `staff-notifications.test.ts` creates its own equipment in `beforeAll` and
   deletes it in `afterAll`, and no longer reads any other suite's equipment.
2. TC-124-02 still proves that the same equipment request sent twice at the
   same moment tells each Technical Support member once.
3. CI on the fix and on the next pull requests passes without re-runs for this
   failure.

Format and conventions: [README.md](README.md).

**Why it failed:** the suite took the first active equipment by id. Other
suites create throwaway equipment and delete it in `afterAll`, and the files run
in parallel, so that first item could be deleted under TC-124-02 (a foreign-key
error on its request line), or its request line could stop the other suite's
cleanup.

**Shared pre-conditions for every case:** a local PostgreSQL migrated with
`npm run db:deploy` and seeded with `npm run db:seed`.

| ID | Type | Criterion | Automated |
|---|---|---|---|
| [TC-201-01](#tc-201-01) | Positive | AC 1, AC 2, AC 3 | Integration (the whole suite) |

---

### TC-201-01

| Item | Content |
|---|---|
| Test Case ID | TC-201-01 |
| Test Scenario | [Positive] AC 1, AC 2, AC 3: TC-124-02 runs on its own equipment alongside the other files |
| Pre-conditions | — |
| Test Steps | 1. Run `npm run test:coverage` against the local database. |
| Test Data | The suite's own `Staff notice equipment` pool |
| Expected Result | TC-124-02 passes, and so do the suites that create and delete their own equipment (request-reservation, first-come, report-reservation, equipment-schedule, equipment-availability, concurrency). |

**Automated by:** `tests/integration/staff-notifications.test.ts` › "SCRUM-124 [AC2, AC14] TC-124-02: the same equipment request sent twice at the same moment tells each Technical Support member once", run in the whole suite.
