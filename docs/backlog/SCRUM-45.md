<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-09-21. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-45 - User is notified when event status changes

| | |
|---|---|
| **Type** | Story |
| **Epic** | SCRUM-8 - Event Change & Notifications |
| **Priority** | High |
| **Story points** | 2 |
| **Status in Jira** | To Do |
| **Sprint** | Backlog |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-45 |

---

**As a user**, I want to receive a notification when an event status changes, so that I stay informed without checking manually.

**Acceptance Criteria:**

* Notifications are created for the status transitions explicitly assigned to this story: **Submitted, Approved, Rejected, Confirmed, Completed and Cancelled**.
* The notification identifies the event and the new status.
* The Organiser and relevant assigned Coordinator receive the workflow status notification.
* For Confirmed and Cancelled, Attendee-facing notifications are owned by SCRUM-85 and must not be duplicated here.
* Completion notification is workflow-facing only; it does not replace any Attendee-specific notification owned by SCRUM-85.
* Specialised notification stories own their own triggers: SCRUM-46 assignment, SCRUM-47 change-request outcome, SCRUM-54 booking outcome, SCRUM-56 clarification and SCRUM-57 reassignment.
* Internal clarification sub-state changes do not create a generic status notification.
* Notification creation is idempotent per event, status transition and recipient.

Functionality Area: Notification System
