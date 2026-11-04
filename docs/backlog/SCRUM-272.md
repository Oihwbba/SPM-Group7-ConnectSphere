<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-11-04. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-272 - Chore: Sync docs/backlog for SCRUM-269 and SCRUM-270

| | |
|---|---|
| **Type** | Task |
| **Epic** | - |
| **Priority** | Medium |
| **Story points** | - |
| **Status in Jira** | Done |
| **Sprint** | SCRUM Sprint 4 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-272 |

---

## Why

SCRUM-269 and SCRUM-270 were created in Jira on 3 Nov and their pull requests (#354, #355) are open, but `docs/backlog/` on `main` has no file for either. Reviewers and the GLM reviewer resolve a branch's key to `docs/backlog/<KEY>.md`, so both PRs are checked against nothing on `main`.

## Done when

1. `docs/backlog/SCRUM-269.md` and `docs/backlog/SCRUM-270.md` match Jira, generated from it and not edited by hand.
2. `docs/backlog/README.md` lists SCRUM-269, SCRUM-270 and this task, and its task count follows. As a partial sync, it keeps its last-synced date.
3. Only files in `docs/backlog/` change, so the PR is docs-only.

Related: SCRUM-269, SCRUM-270, SCRUM-260, SCRUM-267.
