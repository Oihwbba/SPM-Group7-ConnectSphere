<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-09-21. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-66 - See only the functions my role allows

| | |
|---|---|
| **Type** | Story |
| **Epic** | SCRUM-9 - Access Control |
| **Priority** | Highest |
| **Story points** | 3 |
| **Status in Jira** | In Progress |
| **Sprint** | SCRUM Sprint 1 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-66 |

---

**As a signed-in user**, I want to see only the functions my role is allowed to use, so that the interface reflects my responsibilities.

**Acceptance Criteria:**

* Navigation and on-screen actions are derived from the central permission model.
* Role-based visibility is applied consistently across screens rather than hardcoded separately in each feature.
* Organiser, Coordinator, Venue Staff, Technical Support Staff and Attendee each see only the actions assigned to their role.
* UI visibility is not treated as security; SCRUM-67 remains the authoritative enforcement rule.
* Changing a role's permissions should update the derived action set without requiring separate per-screen permission logic.


## Subtasks

| Subtask | Summary | Status |
|---|---|---|
| [SCRUM-95](SCRUM-95.md) | Build single nav map in lib/nav.ts, driven by can() | To Do |
| [SCRUM-96](SCRUM-96.md) | App shell — header, role display, per-role landing redirect | To Do |
| [SCRUM-97](SCRUM-97.md) | Gate on-screen actions by role (Approve/Reject visible to coordinators only) | To Do |
| [SCRUM-98](SCRUM-98.md) | Mobile UI — login sphere, wordmark at 375px, dialogs inset from screen edges | To Do |
| [SCRUM-99](SCRUM-99.md) | Tests — unit (nav map) and e2e (per-role nav links, role-gated actions) | To Do |
