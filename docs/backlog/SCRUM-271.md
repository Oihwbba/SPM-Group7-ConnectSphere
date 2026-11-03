<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-11-03. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-271 - Chore: Automate the manual test cases a test can check

| | |
|---|---|
| **Type** | Task |
| **Epic** | - |
| **Priority** | Medium |
| **Story points** | - |
| **Status in Jira** | In Review |
| **Sprint** | SCRUM Sprint 4 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-271 |

---

## Why

On 3 Nov every case in `docs/testing/` whose **Automated by** says Manual was reviewed. The testing README says a Manual case is "a test still to be written". Three of them describe something that should stay true, which a test can check, but they still say Manual:

* **TC-168-01** (SCRUM-168 AC1): the top bar has no search box, for every role. The e2e test runs only at phone width, and the desktop width is Manual. It also signs in as only the five roles that existed when the case was written, not the Event Coordinator Lead or the Safety Officer.
* **TC-197-04** (SCRUM-197 AC4): the README points to `docs/ai-usage.md` and `docs/ownership.md`. Manual document check.
* **TC-236-05** (SCRUM-236 AC5): every case follows the template in `docs/testing/README.md`, every summary row agrees with its case, and the README's index matches the documents. Checked by hand in #313, and it has drifted since: SCRUM-258 and SCRUM-259 aren't in the index, SCRUM-207's and SCRUM-240's case counts are wrong, and the summary rows of TC-36-06, TC-172-15 and TC-240-01 disagree with their cases.

**Acceptance criteria**

1. TC-168-01's e2e tests run at phone and desktop width for each of the seven roles, one seeded account per role, and the case no longer says desktop width is Manual.
2. A unit test fails when the README's "Start here" or "Project layout" stops linking or listing `docs/ai-usage.md` and `docs/ownership.md`. TC-197-04 cites it.
3. A unit test fails when a case in `docs/testing` has no Test Case ID row or Automated by line (a retired, superseded or moved case keeps a note instead), when a summary row is missing or disagrees with its case's criteria or with whether it is Manual, when the README index leaves out a document or gives a wrong count, or when the README stops showing how each kind of test is titled. TC-236-05 cites it.
4. No test-case document is left stale: the summary rows and the `docs/testing/README.md` index describe these cases as they now are, and the documents the new test finds out of date are fixed.
5. Each new test fails when the thing it checks is broken, and `npm run verify`, `npm run test:coverage` and `e2e/top-bar.spec.ts` pass on a local database.

**Out of scope:** manual cases that need a person, the live app or the shared database (e.g. TC-36-06's screen reader, TC-240-04); one-off checks of a past state, already recorded with their evidence (e.g. TC-189-02, TC-193-02, TC-216-02, TC-234-03); TC-238-03's re-run, which the team keeps manual; TC-207-01, -02 and -09 (still to do in SCRUM-207); TC-132-09's confirmation audit; and checking test titles (TC-236-01, -02, -03), which is SCRUM-273.

**Related:** SCRUM-168, SCRUM-197, SCRUM-236, SCRUM-273.
