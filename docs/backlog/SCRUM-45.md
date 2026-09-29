<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-09-30. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-45 - Workflow notifications for status, assignment, clarification, change-request and reassignment events

| | |
|---|---|
| **Type** | Story |
| **Epic** | SCRUM-8 - Event Change & Notifications |
| **Priority** | High |
| **Story points** | 3 |
| **Status in Jira** | To Do |
| **Sprint** | Backlog |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-45 |

---

Merged story (29 Sep 2026): absorbs SCRUM-46 (coordinator assignment), SCRUM-47 (change request outcome), SCRUM-56 (clarification requested) and SCRUM-57 (coordinator reassigned). Any reference to those keys elsewhere now means this story. SCRUM-54 (booking outcome) is now part of SCRUM-51.

As a user, I want to receive a notification when an event status changes, so that I stay informed without checking manually.

Acceptance Criteria:

* Notifications are created for the status transitions explicitly assigned to this story: Submitted, Approved, Rejected, Confirmed, Completed and Cancelled.
* The notification identifies the event and the new status.
* The Organiser and relevant assigned Coordinator receive the workflow status notification.
* For Confirmed and Cancelled, Attendee-facing notifications are owned by SCRUM-85 and must not be duplicated here.
* Completion notification is workflow-facing only; it does not replace any Attendee-specific notification owned by SCRUM-85.
* Specialised notification stories own their own triggers: SCRUM-46 assignment, SCRUM-47 change-request outcome, SCRUM-54 booking outcome, SCRUM-56 clarification and SCRUM-57 reassignment.
* Internal clarification sub-state changes do not create a generic status notification.
* Notification creation is idempotent per event, status transition and recipient.

Functionality Area: Notification System

---

Merged from SCRUM-46 — User is notified on coordinator assignment

As a user, I want to receive a notification when a coordinator is assigned to an event, so that I stay informed.

Acceptance Criteria:

* Given a Coordinator is assigned to an event, when the assignment is saved, then a notification is sent to the Organiser and the assigned Coordinator.

Note: previously also covered venue booking decisions, duplicating "Notify Coordinator of Booking Outcome" (SCRUM-54) entirely — that bullet removed 2026-09-06 during the full backlog synthesis; SCRUM-54 is the sole owner of that notification.

---

Merged from SCRUM-47 — Organiser is notified of change request outcome

As an Event Organiser, I want to receive a notification about the outcome of my change request, so that I know whether to proceed or adjust.

Acceptance Criteria:

* Given a change request is approved or rejected, when the decision is saved, then a notification is created for the Organiser who submitted the request.
* Given the notification is created, when the Organiser opens it, then it states the outcome (approved/rejected) and, if rejected, the reason given.

---

Merged from SCRUM-56 — User is notified when clarification is requested

As an Event Organiser, I want to be notified when a Coordinator requests clarification on my event request, so that I know to respond.

Acceptance Criteria:

* Given a Coordinator requests clarification on an Under Review request, when the clarification is saved, then a notification is created for the Organiser.
* The notification identifies the event and states what clarification or amendment is being requested.
* The notification is created once for the clarification request; repeated attempts to create the same open clarification do not create duplicates.
* The clarification-response action is owned by SCRUM-109.

---

Merged from SCRUM-57 — User is notified when a coordinator is reassigned

As an Event Coordinator, I want the relevant Coordinators to be notified when a handover is accepted, so that responsibility changes are visible.

Acceptance Criteria:

* Given a pending coordinator handover, when the incoming Coordinator accepts it, then a notification is created for the outgoing and incoming Coordinators.
* The notification states the event and identifies the new current Coordinator.
* A notification is not sent merely when a handover is proposed and not yet accepted.
* The event's current Coordinator remains the outgoing Coordinator until acceptance, consistent with SCRUM-21.
