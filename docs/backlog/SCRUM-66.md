<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-11-04. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-66 - See only the functions my role allows

| | |
|---|---|
| **Type** | Story |
| **Epic** | SCRUM-9 - Access Control |
| **Priority** | Highest |
| **Story points** | 3 |
| **Status in Jira** | Done |
| **Sprint** | SCRUM Sprint 1 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-66 |

---

**Superseded in part** (the criteria below are kept as accepted in Sprint 1):

* **"Their role", superseded by SCRUM-121 AC2:** a user with more than one role sees the union of their roles' functions in the navigation.
* **The five-role list, superseded by SCRUM-164 AC1:** the Event Coordinator Lead and the Safety Officer also see only what their role allows, from the same permission table.

**As a signed-in user**, I want to see only the functions my role is allowed to use, so that the interface reflects my responsibilities.

**Acceptance Criteria:**

* Navigation and on-screen actions are derived from the central permission model.
* Role-based visibility is applied consistently across screens rather than hardcoded separately in each feature.
* Organiser, Coordinator, Venue Staff, Technical Support Staff and Attendee each see only the actions assigned to their role.
* UI visibility is not treated as security; SCRUM-67 remains the authoritative enforcement rule.
* Changing a role's permissions should update the derived action set without requiring separate per-screen permission logic.

**Change log**

* 2026-11-04 (SCRUM-260, PO approved 2026-11-04): added the Superseded in part note for SCRUM-121 and SCRUM-164, whose Supersedes lines already name this story. Criteria unchanged.
