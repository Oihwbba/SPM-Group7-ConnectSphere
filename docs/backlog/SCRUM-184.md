<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-20. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-184 - Chore: SCRUM-50 facility picker inconsistency

| | |
|---|---|
| **Type** | Task |
| **Epic** | - |
| **Priority** | Medium |
| **Story points** | - |
| **Status in Jira** | To Do |
| **Sprint** | Backlog |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-184 |

---

it shows raw tags like `loading-bay` and `sound-system`, while the venue form shows "Loading bay" and "Sound system". The fix is one line, using the existing `tagLabel()` in request-form.tsx:518, but under your rules it belongs on a SCRUM-50 branch or a Chore task.
