<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-15. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-178 - Chore: Send related files to the GLM reviewer in part instead of dropping them

| | |
|---|---|
| **Type** | Task |
| **Epic** | - |
| **Priority** | Medium |
| **Story points** | - |
| **Status in Jira** | Done |
| **Sprint** | SCRUM Sprint 3 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-178 |

---

On large pull requests the GLM reviewer left related files out of its context entirely: #153 to #156 each lost `prisma/schema.prisma` or `prisma/seed.ts`, and #154 lost 30 files. Unchanged tests that only import a changed file were sent first and used up the budget, and a related file that didn't fit whole was dropped. SCRUM-111 (Done) fixed the same problem for the PR's own changed files; this does it for the related ones. It was first raised as SCRUM-111's item 6, and moved to its own task because that story is Done (PO decision, 12 Oct).

**Acceptance criteria**

1. Related files are sent in priority order: files the changed files import; the seed, when an e2e spec changed; source files that import a changed file; source files that name the PR's stories; and last, tests that import a changed file or name a story.
2. A related file that doesn't fit whole is sent as an excerpt instead of being dropped. A test file is sent as its imports and its `describe`, `it` and `test` lines; a source file as its imports and exports (models and enums in the schema), plus the lines around every mention of the PR's stories. Each line keeps its own line number, so the review's "Where" links stay right. The prompt tells the reviewer which files are excerpts, and that "…" marks lines left out.
3. Each related file reserves room for its excerpt, so a file sent whole can't leave the files after it with nothing. A reserve that can't all be met yields to the priority order.
4. A related file with nothing to excerpt is sent as its head, capped in size. It is listed as omitted only when not even that fits.
5. The character budgets, and the checks' pass and fail rules, don't change.
6. Replayed on the recent large PRs (#153 to #156), the new selection leaves out no related file.
