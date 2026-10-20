<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-20. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-196 - Chore: Check in CI that every test case cites tests and files that exist

| | |
|---|---|
| **Type** | Task |
| **Epic** | - |
| **Priority** | Medium |
| **Story points** | - |
| **Status in Jira** | To Do |
| **Sprint** | Backlog |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-196 |

---

`docs/testing/SCRUM-n.md` traces each acceptance criterion to the tests that automate it, by file and title. When a test is renamed or a spec deleted, the citation goes stale silently: on 2026-10-19 SCRUM-171 cited a deleted spec and a renamed test, and SCRUM-20 cites two deleted files. The GLM review catches it only on the PR's own stories. Found by the rubric audit on 2026-10-19.

**Acceptance criteria**

1. A script reads every "Automated by" line in `docs/testing/` and reports each cited test file that doesn't exist and each cited test title that no test in `tests/` or `e2e/` has. A title shortened with "…", and a title built from a template (`${x}`, `%s`), still matches its test.
2. CI runs it on every pull request and fails with the document, line and citation when one is broken.
3. Every citation it reports on `main` today is fixed, or the test case marked retired, before the check is required.
4. The script has unit tests for a match, a shortened title, a templated title, a missing title and a missing file.

**Change log**

* 2026-10-19: created from the rubric audit (Felicia).
