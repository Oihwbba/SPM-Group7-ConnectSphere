<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-11-04. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-274 - Chore: Sync docs/backlog for SCRUM-271 and SCRUM-273

| | |
|---|---|
| **Type** | Task |
| **Epic** | - |
| **Priority** | Medium |
| **Story points** | - |
| **Status in Jira** | Done |
| **Sprint** | SCRUM Sprint 4 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-274 |

---

## Why

SCRUM-271 and SCRUM-273 were created on 3 Nov and have pull requests, but `main` has no `docs/backlog` file for either. Their tests carry those keys, and `tests/unit/story-keys.test.ts` (SCRUM-146) fails on a key with no `docs/backlog` file, so their pull requests are stacked on this sync.

**Acceptance criteria**

1. `docs/backlog/SCRUM-271.md`, `docs/backlog/SCRUM-273.md` and this task's file are added, generated from the Jira descriptions as they stand.
2. `docs/backlog/README.md` lists the three tasks and counts them. As a partial sync, its last-synced date stays as it is.
3. Only `docs/backlog` files change.

**Related:** SCRUM-271, SCRUM-273, SCRUM-272 (the previous partial sync).
