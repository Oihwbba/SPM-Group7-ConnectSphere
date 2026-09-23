<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-09-23. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-43 - Event Coordinator approves or rejects a change request

| | |
|---|---|
| **Type** | Story |
| **Epic** | SCRUM-8 - Event Change & Notifications |
| **Priority** | High |
| **Story points** | 2 |
| **Status in Jira** | To Do |
| **Sprint** | Backlog |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-43 |

---

As an Event Coordinator, I want to approve or reject a change request, so that the Event Organiser knows the outcome and the event remains internally consistent.

Acceptance Criteria:

* Given a change request is Pending Review, when the Coordinator approves it, then the requested event details become the event's actual details and the change request status becomes Approved as one atomic business operation.
* If the change request cannot be fully applied, neither the event details nor the change-request decision is committed.
* Given a change request is Pending Review, when the Coordinator rejects it, then the event's actual details remain unchanged and the change request status becomes Rejected.
* A rejection reason is required and cannot be blank.
* When an approved change affects an impactful field, SCRUM-44 handles dependent venue bookings and equipment reservations.
* For a Confirmed event, approval of an impactful change also moves the event to Planning so that the revised arrangements can be re-established before the event can become Confirmed again.
* For an Approved or Planning event, approving a change request does not otherwise alter lifecycle status.
* The Organiser's outcome notification is owned by SCRUM-47.
* The event's lifecycle transition behaviour follows SCRUM-24; this story owns the specific Confirmed → Planning transition caused by an approved impactful change.
