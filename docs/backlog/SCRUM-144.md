<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-07. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-144 - Enable registration and enforce event cutoff

| | |
|---|---|
| **Type** | Task |
| **Epic** | - |
| **Priority** | High |
| **Story points** | - |
| **Status in Jira** | To Do |
| **Sprint** | SCRUM Sprint 3 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-144 |

---

Close the remaining Release 1 registration flow gap identified by audit findings F05 and F07.

Acceptance criteria:

1. Registration needed = No means the event is not listed to Attendees, as defined by SCRUM-127.
2. Manual closure remains distinct from Registration needed = No; a closed event remains listed but cannot be registered for.
3. Registration is refused at or after the event start time, including direct requests.
4. Existing registration-window rules in SCRUM-75 remain authoritative.
5. Add regression tests for app-created events, manual closure and start-time cutoff.

Related: SCRUM-72, SCRUM-73, SCRUM-75, SCRUM-81, SCRUM-127.

Change log

* 2026-10-03: opening registration on confirmation moved to SCRUM-81 AC5 (PO decision).
