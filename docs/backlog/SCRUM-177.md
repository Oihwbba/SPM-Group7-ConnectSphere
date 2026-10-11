<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-12. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-177 - Backlog Sync: full re-sync of docs/backlog from Jira on 12 Oct

| | |
|---|---|
| **Type** | Task |
| **Epic** | - |
| **Priority** | Medium |
| **Story points** | - |
| **Status in Jira** | In Review |
| **Sprint** | SCRUM Sprint 3 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-177 |

---

Since the last full sync (2026-10-09), Jira changed in ways the partial re-syncs (#159, #163, #164) don't all cover: SCRUM-111 was reopened, SCRUM-146 gained a criterion, SCRUM-174 to 176 were created, and SCRUM-87 and SCRUM-148 were deleted. Re-sync every item so `docs/backlog` matches Jira again.

**Acceptance criteria**

1. Every Jira item (story, task and subtask) has a file in `docs/backlog` in the existing generated format, and no file remains for an item Jira no longer has.
2. A file changes only where Jira changed: its text, summary, status, points, priority, sprint or epic. Unchanged files are left as they are, sync date included.
3. `docs/backlog/README.md` shows the current counts, points, sprint commitments and index rows, and "last synced" becomes 2026-10-12.
4. Each changed item is its own commit, so the change links to that item in Jira.
5. The stories #159 and #163 re-sync come out identical to those pull requests, so they can be closed once this merges.

Related: SCRUM-169 (the 9 Oct sync), #159, #163, #164.
