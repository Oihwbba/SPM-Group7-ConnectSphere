<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-09-30. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-21 - Hand an event to another coordinator and show who is currently assigned

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

Merged story (29 Sep 2026): absorbs SCRUM-22 (See which coordinator is assigned to my event). Any reference to SCRUM-22 elsewhere now means this story. SCRUM-57 is now part of SCRUM-45.

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

---

Merged from SCRUM-22 — See which coordinator is assigned to my event

As an Event Organiser, I want to see which Coordinator is assigned to my event, so that I know who to expect updates from.

Acceptance Criteria:

* Organiser can view the currently assigned Coordinator's name on their event
* The name shown is always the Coordinator currently responsible — during a pending handover (see SCRUM-21) that is still the original Coordinator, not the proposed one
* The display updates as soon as a handover is accepted

Note (2026-09-13): the second criterion was added after the customer confirmed that reassignment now runs through a handover that the incoming Coordinator must accept. Before that clarification "updates immediately if the event is reassigned" was unambiguous; now it needs to say which of the two Coordinators the Organiser sees while a handover is open.

INVEST: Independent (a read-only display, separable from the assignment logic itself); Negotiable (how much Coordinator contact info to show is open); Valuable (Organiser otherwise has no way to know who to follow up with); Estimable/Small (one field display); Testable (displayed name matches the actual current assignment, including mid-handover).

Functionality Area: Coordinator Assignment, Event Information Management
