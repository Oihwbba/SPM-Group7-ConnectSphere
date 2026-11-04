<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-11-04. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-273 - Chore: Check every test title against its story, criteria and case in the test suite

| | |
|---|---|
| **Type** | Task |
| **Epic** | - |
| **Priority** | Medium |
| **Story points** | - |
| **Status in Jira** | Done |
| **Sprint** | SCRUM Sprint 4 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-273 |

---

## Why

SCRUM-232 (#302) and SCRUM-236 (#313) titled every e2e, unit and integration test `SCRUM-n [ACx] TC-n-xx: …`, and audited the titles by hand. TC-236-01, TC-236-02 and TC-236-03 are still Manual, so a new test with a wrong or missing prefix is only caught if a reviewer notices. On 3 Nov an audit script applying the rules #302 and #313 agreed found no title breaking them, so a test can hold the suite to them from now on.

**Acceptance criteria**

1. A unit test fails when a unit, integration or e2e test that its own story's test-case doc cites doesn't name a case (TC-236-01, SCRUM-232 AC1). A test cited only by another story's case keeps its own story's title, as #313 agreed.
2. A unit test fails when a title names a case under another story's key, a case that doesn't exist or was retired, or a criterion its case doesn't cover (TC-236-02).
3. A unit test fails when a test no doc cites carries no story or chore key in its title or a describe around it (TC-236-03, SCRUM-232 AC3), except the helpers #313 left plain, which the test lists by title.
4. `docs/testing/README.md` says where a new helper that belongs to no story is listed, and that a title built wholly at run time is only checked by its citation. TC-236-01 to TC-236-03 cite the test, and no test-case document is left stale.
5. Each check fails when the rule it checks is broken, and `npm run verify` and `npm run test:coverage` pass on a local database.

**Out of scope:** renaming any test; the audit found none to rename.

**Related:** SCRUM-236, SCRUM-232, SCRUM-196, SCRUM-271 (whose changes to `docs/testing/SCRUM-236.md` this builds on).
