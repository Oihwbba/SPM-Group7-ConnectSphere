<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-21. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-206 - Chore: Automate the test cases still run by hand on Done stories

| | |
|---|---|
| **Type** | Task |
| **Epic** | - |
| **Priority** | Medium |
| **Story points** | - |
| **Status in Jira** | Done |
| **Sprint** | SCRUM Sprint 3 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-206 |

---

The 20 Oct audit found Done stories whose criteria were tested only by hand: TC-53-09, TC-16-05, TC-24-06, TC-13-08 (attendance of 1), TC-84-04 (message and button), TC-31-04, TC-31-05 and TC-31-09 (parts), TC-24-03 (message) and TC-36-06 (a real screen reader).

**Acceptance criteria**

1. Each of those cases is covered by an automated test, or cites an existing one that covers it, with its docs/testing entry and the index updated.
2. TC-36-06's real screen-reader pass stays manual, with the reason given; its accessible names are already tested by e2e.
3. New tests use the `SCRUM-n [ACx] TC-n-xx:` naming and pass with the whole suite against the local database.

Related: SCRUM-13, SCRUM-16, SCRUM-24, SCRUM-31, SCRUM-36, SCRUM-53, SCRUM-84, SCRUM-203.
