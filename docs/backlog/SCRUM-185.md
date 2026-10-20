<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-20. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-185 - Chore:  Fix SCRUM-25 "Needs Reconsideration" only appears after reopening the modal

| | |
|---|---|
| **Type** | Task |
| **Epic** | - |
| **Priority** | Medium |
| **Story points** | 0 |
| **Status in Jira** | Done |
| **Sprint** | SCRUM Sprint 3 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-185 |

---

* The fix is small and belongs in a SCRUM-25 follow-up. Give `EditDetailsDialog` an `onSaved` callback that bumps the same counter, and key the panel on it, so both the panel and the checklist reload after an edit that flags. Tests should cover it: a unit test, plus an e2e step asserting the flag appears without reopening.  


  Note: Marked as 0 point story as SCRUM-25 is still in sprint.
