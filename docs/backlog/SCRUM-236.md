<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-28. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-236 - Chore: Name every unit and integration test after the story, criteria and test case it proves, and fix the test-case docs' format

| | |
|---|---|
| **Type** | Task |
| **Epic** | - |
| **Priority** | Medium |
| **Story points** | 0 |
| **Status in Jira** | To Do |
| **Sprint** | SCRUM Sprint 4 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-236 |

---

CLAUDE.md asks for every test to be named `SCRUM-n [ACx] TC-n-xx: what must happen`. SCRUM-232 (#302) did this for e2e. A review on 28 Oct of every test and test-case doc, cross-checked by a second agent, found the rest:

* About 680 unit and integration titles aren't in that form. About 300 of them are cited by a test-case doc, so their story, criteria and case come from it. About 340 are cited by none, including about 120 GLM-reviewer tooling tests.
* About 30 definite errors:

    * story groups joined without ", " or a case under another story's key (e.g. `SCRUM-226 [AC2] TC-155-17`);
    * 11 titles whose criterion disagrees with the case they name (e.g. `SCRUM-48 [AC6] TC-48-15`, a case for AC 2);
    * two titles naming a fully superseded case (TC-20-01, TC-69-05);
    * a title missing its colon;
    * two `it.todo`s for SCRUM-53 that its tests now cover.

* Test-case docs off the template:

    * SCRUM-209.md;
    * SCRUM-108 and SCRUM-117 cases with no Test Case ID row;
    * SCRUM-201's rows;
    * TC-193-02's Automated by line;
    * TC-13-14 missing from its summary table;
    * summary rows whose criterion or "Automated" column disagrees with the case;
    * the README's SCRUM-202 count;
    * a SCRUM-190 citation of an e2e title #302 renamed.


**Acceptance criteria**

1. Every unit and integration test that automates a documented test case is titled `SCRUM-n [ACx] TC-n-xx: …`, with the story, criteria and case taken from the doc that cites it. A test under several cases names each, in groups separated by ", ". The description after the colon is kept.
2. No title names a criterion its case doesn't cover, a case under another story's key, or a fully superseded case.
3. A test that automates no documented case is given its story's or chore's key, and its criterion where one applies. A test that belongs to no story or chore is left as it is. Every such test is listed in the PR with the reason.
4. Every `docs/testing` citation of a renamed test cites its new title, and no citation names a test that doesn't exist.
5. Every case in `docs/testing` follows the README template: a Test Case ID row, an Automated by line, and a summary row that agrees with the case. The README's counts match the files. The README says how a bug task whose cases live in another story's doc names its tests.
6. No test's steps or assertions change. Only titles, the two obsolete `it.todo`s and the docs that cite them change.

**Related:** SCRUM-232 (the e2e titles), SCRUM-196 (the CI check that keeps citations from going stale).
