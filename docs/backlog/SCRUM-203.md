<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-20. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-203 - Chore: Bring test-case citations, stale notes and the backlog snapshot up to date with main

| | |
|---|---|
| **Type** | Task |
| **Epic** | - |
| **Priority** | Medium |
| **Story points** | - |
| **Status in Jira** | In Progress |
| **Sprint** | SCRUM Sprint 3 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-203 |

---

The 20 Oct audit of every Done story found that the test docs fell behind the stories that replaced or renamed things.

**What's wrong**

* Test cases cite tests that no longer exist, or now expect the opposite, after Week 7 stories superseded them: SCRUM-14, 17, 20, 69, 108 and 37. `tests/unit/event-auto-assignment.test.ts` and `e2e/coordinator-assignment.spec.ts` are gone.
* TC-67-01 expects Venue Staff to be refused the venue catalogue, which SCRUM-34 AC2 now grants.
* TC-172-14 cites a TC-37-06 test in `tests/integration/concurrency.test.ts` that doesn't exist.
* 24 citations quote an older test title, and a few name the wrong path.
* Notes say something "isn't built yet" when it is: `docs/product-context.md` (SCRUM-82), `README.md` (SCRUM-21), and the SCRUM-24, 73, 159 and 26 test docs.
* `docs/backlog` was last fully synced on 13 Oct: SCRUM-82 AC11 and SCRUM-128 AC11 are missing, 33 files show a status other than Done, and the index's sync date is wrong.

**Acceptance criteria**

1. Every "Automated by" citation in `docs/testing` names a test file that exists and a test title that appears in it. A case whose test was removed by a superseding story says which story superseded it and cites that story's test.
2. No document says a built feature "isn't built yet".
3. `docs/backlog` is regenerated from live Jira in its current format, and its index records the sync date.
4. `npm run verify` passes.

Related: SCRUM-196 (a CI check that citations exist) builds on this. Found in the 20 Oct audit.
