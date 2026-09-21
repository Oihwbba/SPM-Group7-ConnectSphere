<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-09-21. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-57 - User is notified when a coordinator is reassigned

| | |
|---|---|
| **Type** | Story |
| **Epic** | SCRUM-8 - Event Change & Notifications |
| **Priority** | Medium |
| **Story points** | 1 |
| **Status in Jira** | To Do |
| **Sprint** | Backlog |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-57 |

---

**As an Event Coordinator**, I want the relevant Coordinators to be notified when a handover is accepted, so that responsibility changes are visible.

**Acceptance Criteria:**

* Given a pending coordinator handover, when the incoming Coordinator accepts it, then a notification is created for the outgoing and incoming Coordinators.
* The notification states the event and identifies the new current Coordinator.
* A notification is not sent merely when a handover is proposed and not yet accepted.
* The event's current Coordinator remains the outgoing Coordinator until acceptance, consistent with SCRUM-21.
