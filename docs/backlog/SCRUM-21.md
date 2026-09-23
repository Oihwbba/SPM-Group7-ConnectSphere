<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-09-23. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-21 - Hand an event over to a different coordinator

| | |
|---|---|
| **Type** | Story |
| **Epic** | SCRUM-6 - Event Request Lifecycle |
| **Priority** | Medium |
| **Story points** | 3 |
| **Status in Jira** | To Do |
| **Sprint** | Backlog |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-21 |

---

As an Event Coordinator, I want to hand an event over to a colleague who has agreed to take it, so that responsibility can shift when availability or workload changes.

Acceptance Criteria:

* Given an event has an assigned Coordinator, when that Coordinator initiates a handover and names a colleague, then a pending handover is recorded and the named Coordinator is asked to accept it.
* Given a pending handover, when the named Coordinator accepts, then they become the assigned Coordinator and the previous assignment ends.
* Given a pending handover that has not been accepted, then the original Coordinator remains the point of contact and remains responsible — the handover is not effective until accepted.
* Exactly one Coordinator is assigned at any moment; a pending handover never creates a second assignment.
* A record exists of who was previously assigned, who initiated the handover and who accepted it, with timestamps.
* Both the outgoing and incoming Coordinator are notified through SCRUM-57.
* A pending handover is idempotent: repeating the same initiation does not create multiple pending handovers for the same event and incoming Coordinator.
* If the incoming Coordinator declines or does not accept, the original assignment remains in force; the event does not become unassigned.
* The outgoing Coordinator cannot use handover to bypass the automatic single-Coordinator authorization rule.


Customer clarification (2026-09-13): Reassignment is discussed offline. Once there is agreement, the original Coordinator initiates the handover and the new Coordinator accepts it. The system records the agreed process and acceptance; it does not host the negotiation.

Boundary: this story owns the in-system handover and acceptance mechanism. SCRUM-20 owns automatic initial assignment; SCRUM-57 owns notifications.

Functionality Area: Coordinator Assignment
