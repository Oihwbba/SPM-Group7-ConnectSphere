<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-09-21. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-22 - See which coordinator is assigned to my event

| | |
|---|---|
| **Type** | Story |
| **Epic** | SCRUM-6 - Event Request Lifecycle |
| **Priority** | High |
| **Story points** | 3 |
| **Status in Jira** | To Do |
| **Sprint** | Backlog |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-22 |

---

**As an Event Organiser**, I want to see which Coordinator is assigned to my event, so that I know who to expect updates from.

**Acceptance Criteria:**

* Organiser can view the currently assigned Coordinator's name on their event
* The name shown is always the Coordinator currently responsible — during a pending handover (see SCRUM-21) that is still the original Coordinator, not the proposed one
* The display updates as soon as a handover is accepted

**Note (2026-09-13):** the second criterion was added after the customer confirmed that reassignment now runs through a handover that the incoming Coordinator must accept. Before that clarification "updates immediately if the event is reassigned" was unambiguous; now it needs to say which of the two Coordinators the Organiser sees while a handover is open.

**INVEST:** Independent (a read-only display, separable from the assignment logic itself); Negotiable (how much Coordinator contact info to show is open); Valuable (Organiser otherwise has no way to know who to follow up with); Estimable/Small (one field display); Testable (displayed name matches the actual current assignment, including mid-handover).

Functionality Area: Coordinator Assignment, Event Information Management
