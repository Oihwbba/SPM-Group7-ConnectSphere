<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-20. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-195 - Chore: Remove the placeholder tests for features that are built

| | |
|---|---|
| **Type** | Task |
| **Epic** | - |
| **Priority** | Medium |
| **Story points** | - |
| **Status in Jira** | To Do |
| **Sprint** | Backlog |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-195 |

---

Every test run reports todo tests: `tests/unit/venues.test.ts` holds three `it.todo` placeholders for SCRUM-34, SCRUM-38 and SCRUM-36/37, and `tests/integration/concurrency.test.ts` two for SCRUM-53 and SCRUM-38/50. All five features are built and tested elsewhere, so the placeholders read as missing tests. Found by the rubric audit on 2026-10-19.

**Acceptance criteria**

1. Each placeholder is removed only after naming the test that already covers it; one with no covering test is written instead of removed.
2. `npm run test:coverage` reports no todo tests, and coverage stays at 100%.
3. The PR lists each placeholder and the test that covers it.

**Change log**

* 2026-10-19: created from the rubric audit (Felicia).
