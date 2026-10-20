<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-20. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-189 - Chore: Stop long e2e journeys failing at the 30-second test limit on CI

| | |
|---|---|
| **Type** | Task |
| **Epic** | - |
| **Priority** | Medium |
| **Story points** | - |
| **Status in Jira** | To Do |
| **Sprint** | Backlog |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-189 |

---

CI's build-and-test on `main` for 4dfb4a1 (the merge of #205) was cancelled at its 20-minute limit during the end-to-end step, at test 179 of 181. Every earlier step passed. Two tests failed their first attempt and passed on retry, each spending 30 seconds before failing:

* `e2e/clarification-and-amend.spec.ts` TC-108-10 (SCRUM-108)
* `e2e/events.spec.ts` "two users viewing the same event simultaneously…" (SCRUM-24)

Across the last 25 CI runs the same pattern repeats: almost every first-attempt e2e failure is a long, multi-step journey hitting Playwright's default 30-second test timeout (30.0–30.1s), not a failed assertion, and passing on retry:

| Test | Story | First-attempt failures |
| --- | --- | --- |
| `e2e/rejection-outcome.spec.ts:64` TC-126-08 | SCRUM-126 | 5 |
| `e2e/clarification-and-amend.spec.ts:159` TC-108-11 | SCRUM-108 | 4 |
| `e2e/clarification-and-amend.spec.ts:51` TC-108-10 | SCRUM-108 | 3 |
| `e2e/events.spec.ts:160` draft lifecycle journey | SCRUM-15 | 3 |
| `e2e/events.spec.ts:277` drafts vs submitted journey | SCRUM-16 | 3 |
| `e2e/events.spec.ts:869` two users, live status | SCRUM-24 | 1 (+2 on a branch) |
| `e2e/events.spec.ts:1073` TC-126-03 | SCRUM-126 | 1 |

Each retry costs the 30 seconds the failure took plus the rerun, which pushes the e2e step towards the 20-minute job limit. SCRUM-182 (#196, open) removes the main cause of the slowdown (pages `signedIn()` leaves open keep the test server busy); this chore makes the long journeys themselves pass first time under CI load, and builds on SCRUM-182 rather than duplicating it.

**Acceptance criteria**

1. Each test above passes on its first attempt in CI, with no retry, in three consecutive CI runs; the runs are linked in the pull request.
2. A journey that legitimately takes longer than 30 seconds says so where it is defined (e.g. `test.slow()`), with the reason, instead of relying on a retry; the global Playwright timeout is unchanged unless the team agrees otherwise.
3. Any test that waits on a fixed time or races the 4-second events-list refresh (SCRUM-24) waits on what the user would see instead.
4. Every browser context a changed test opens itself is closed by that test (as SCRUM-182 AC2 asks).
5. No test loses an assertion, and each changed test keeps its `SCRUM-n [ACx] TC-n-xx` name; the SCRUM-24 test gains its test-case ID.

Raised by Felicia Or on 2026-10-16.
