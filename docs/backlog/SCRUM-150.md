<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-08. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-150 - [DUPLICATE OF SCRUM-108] Implement field-level clarification response

| | |
|---|---|
| **Type** | Task |
| **Epic** | - |
| **Priority** | Medium |
| **Story points** | - |
| **Status in Jira** | Done |
| **Sprint** | Backlog |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-150 |

---

Implement the field-selection behaviour now specified by SCRUM-18 and SCRUM-108 (audit F09).

Acceptance criteria:

1. Coordinator can request clarification and select zero or more request-form fields the Organiser may edit.
2. The Organiser sees the clarification request and can edit only the selected fields plus a response text.
3. Selecting no fields permits a text-only response.
4. Unselected fields remain read-only and require a change request for later changes.
5. Saving the response closes the open clarification and notifies the Coordinator.
6. Add regression coverage for zero-field, one-field and multi-field clarification responses.

Related: SCRUM-18, SCRUM-108, SCRUM-41, SCRUM-45.
