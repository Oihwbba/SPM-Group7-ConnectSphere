<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-28. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-232 - Chore: Name every e2e test after the story, criteria and test case it proves

| | |
|---|---|
| **Type** | Task |
| **Epic** | - |
| **Priority** | Medium |
| **Story points** | 0 |
| **Status in Jira** | In Review |
| **Sprint** | SCRUM Sprint 4 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-232 |

---

CLAUDE.md asks for every test to be named `SCRUM-n [ACx] TC-n-xx: what must happen`, so a reviewer can tell from the title which criterion a test proves. On 27 Oct, 103 of the 255 e2e titles on `main` don't follow it:

* 39 name no story ("User Story 15 — …", or the key only in the describe block);
* 25 name no criterion;
* 25 name no test case;
* 14 use another form ("SCRUM-29 AC 7:", "AC1:").

This makes e2e coverage hard to audit: an audit of the equipment tests had to read spec bodies to find failure paths that the titles don't mention.

**Acceptance criteria**

1. Every e2e test that automates a documented test case is titled `SCRUM-n [ACx] TC-n-xx: …`, with the story, criteria and test case taken from the test-case doc that cites it. The description after the colon is kept.
2. Every `docs/testing` citation of a renamed test cites its new title; the citation check finds no e2e title it no longer matches.
3. An e2e test that automates no documented test case is listed in the PR, and is either given the story it belongs to or left as it is with the reason.
4. No test's steps or assertions change; only titles, plus the docs that cite them.
