<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-07. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-111 - GLM reviewer context: never drop a file the PR changed, and measure the budget

| | |
|---|---|
| **Type** | Task |
| **Epic** | - |
| **Priority** | Medium |
| **Story points** | - |
| **Status in Jira** | Done |
| **Sprint** | Backlog |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-111 |

---

Follow-up to SCRUM-88, which delivered the reviewer.

The reviewer sends changed files and related files to GLM under character budgets (250,000 and 150,000). When a budget runs out, a file is dropped entirely and the review says "over the size limit", which is misleading: no file in the repo exceeds the 60,000-character per-file cap — the largest is create-event-dialog.tsx at 47,700.

Observed on real PRs:

* #54: tests/unit/events.test.ts (40,816 chars), a file the PR itself changed, was dropped after missing the budget by 1,656 characters. The reviewer then judged test coverage without one of the PR's own test files. prisma/seed.ts was dropped too.
* #52: 10 files omitted. #57: 7 omitted. #53: 3 omitted.

There is room: reviews use 95k-168k tokens and GLM-5.3 accepts 1M.

Scope:

1. Never drop a file the pull request changed; truncate to the remaining budget instead of omitting.
2. Include prisma/seed.ts as context when the diff touches e2e tests — seeded data decides what those tests can assert. A hard-coded coordinator@test.local broke CI on #53 precisely because the seed has two coordinators.
3. Raise the related-files budget moderately (150,000 to 300,000), not to the maximum: a much larger prompt can make a model less precise about specific details, which is where the reviewer's value is.
4. Correct the wording: say a file did not fit the budget, and name it.
5. Measure rather than assume — re-run the replay against PR #37 (7 planted bugs, 1 critical) and confirm the reviewer still finds all of them with the larger context. If the count drops, dial the budgets back.
