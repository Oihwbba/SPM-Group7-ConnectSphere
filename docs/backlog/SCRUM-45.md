<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-09-13. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-45 - User is notified when event status changes

| | |
|---|---|
| **Epic** | SCRUM-8 - Event Change & Notifications |
| **Priority** | High |
| **Story points** | 2 |
| **Status in Jira** | To Do |
| **Sprint** | Backlog |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-45 |

---

As a user, I want to receive a notification when an event's status changes, so that I stay informed without checking manually.

Acceptance Criteria:

* Given an event's status changes to Submitted, Approved, Rejected, Confirmed, or Cancelled, when the change is saved, then a notification is created for the relevant user(s) within the same action.
* Given a notification is created, when the user checks their notification list, then it appears with the correct event name and new status.
* Given an event's status changes, when the notification is created, then it reaches the users involved in that event — the Organiser, the assigned Coordinator, and, for Confirmed and Cancelled, any registered Attendees (delivered by SCRUM-85).
* Given a status change that is not in the list above (e.g. under review → approved is included, but an internal sub-state change is not), when it is saved, then no duplicate or spurious notification is sent.

**Customer clarification (2026-09-13) — confirms the trigger list:** _"Notifications cover event submission, approval, registration updates, confirmation, cancellation. Applies to event and attendance."_

The five triggers this story already carried match the customer's list exactly. "Registration updates" is delivered by SCRUM-85, and "applies to event and attendance" is why the third criterion above now names registered Attendees explicitly.

**⚠ Open, and not resolved by this answer:** the customer separately asked for **proactive reminders for incomplete arrangements, with configurable frequency**. That is not a status-change notification and is not covered by this story — see the comment on SCRUM-48 for why it is being held rather than added.
