<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-20. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-182 - Chore: Close the e2e sign-in pages that slow CI past its time limit

| | |
|---|---|
| **Type** | Task |
| **Epic** | - |
| **Priority** | Medium |
| **Story points** | - |
| **Status in Jira** | Done |
| **Sprint** | SCRUM Sprint 3 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-182 |

---

CI's build-and-test was cancelled at its 20-minute limit on `main` (c95def9, the merge of #188) and on two pull-request runs on 13 October. Every step passed in those runs; the end-to-end step alone took up to 18.3 minutes, against 8.2 minutes for the same 167 tests in other runs.

The slowdown is not in any one test. In a slow run, a stretch of 50 to 80 tests runs three to thirty times slower than usual, and it ends whenever a failed test makes Playwright restart its browser. The cause is `signedIn()` in `e2e/helpers.ts`: each call opens a new browser context and nothing closes it. Most roles land on the events list after signing in, and that page refreshes itself from the server every 4 seconds (SCRUM-24), so every page left open keeps the one test server busy. About 40 sign-ins across the suite each leave a page behind, and each new spec that uses `signedIn` adds more.

**Acceptance criteria**

1. A page that `signedIn()` opened for one test is closed before the next test signs in, so the pages left open never outnumber those of a single test; no spec has to change to get this.
2. Every other browser context an e2e test opens itself is closed by that test.
3. The end-to-end step runs in its usual time on CI again, with no stretch of slow tests, and the result is stated in the pull request.

Asked for by Jin Hong on 2026-10-14.
