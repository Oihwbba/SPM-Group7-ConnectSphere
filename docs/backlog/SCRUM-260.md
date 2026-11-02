<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-11-01. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-260 - Chore: Sync docs/backlog for the stories open pull requests need

| | |
|---|---|
| **Type** | Task |
| **Epic** | - |
| **Priority** | Medium |
| **Story points** | - |
| **Status in Jira** | In Review |
| **Sprint** | SCRUM Sprint 4 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-260 |

---

## Why

The GLM reviewer reads each story's `docs/backlog` file from the PR's base branch, so a story with no file on `main` is reviewed without its acceptance criteria. Open PRs also carry their own backlog edits, which then conflict with each other.

## Done when

1. Every sprint item an open PR names (branch, title, or a `Closes`, `Part of`, `Fixes` or `Refs` line) has a `docs/backlog` file on `main`.
2. Every sprint item whose backlog file an open PR edits matches Jira on `main`.
3. Only those items are synced, plus those item 5 names. Nothing is deleted, and items in no sprint (SCRUM-71, SCRUM-80, SCRUM-115) and archived items are left out.
4. `docs/backlog/README.md` lists them. As a partial sync, it keeps its last-synced date.
5. SCRUM-23, SCRUM-27 and SCRUM-155 also match Jira on `main`: their only Jira edit was SCRUM-233's, which the PO approved on 1 Nov, and no open PR syncs them.

Related: SCRUM-235, SCRUM-146.

## Change log

* 2026-11-01 (PR #336): item 5 added, and item 3 now allows for it, so that every item the 1 Nov approval changed in Jira is synced.
