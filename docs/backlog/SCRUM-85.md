<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-09-21. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-85 - Attendee is notified of registration confirmation, event changes, and cancellation

| | |
|---|---|
| **Epic** | SCRUM-8 - Event Change & Notifications |
| **Priority** | High |
| **Story points** | 3 |
| **Status in Jira** | To Do|
| **Sprint** | Backlog |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-85 |

---

As an Attendee, I want to be notified when I successfully register, when an approved change to date/time/venue affects an event I'm registered for, or when that event is cancelled, so that I find out from ConnectSphere directly.

**Acceptance Criteria:**

- Given a registration is created, when it is saved, then the registering Attendee receives a notification confirming it.
- Given an approved change to an event's **date, time, or venue** affects an event with active (non-withdrawn) registrations, when the change is applied, then each active registered Attendee receives one notification containing the updated event details.
- Given an event is Cancelled, when the cancellation is saved, then each active registered Attendee receives one cancellation notification.
- Attendee registrations remain active after a date/time/venue change; the notification informs them of the new details rather than silently cancelling their place.
- Given a user opens their notification list, when it loads, then these notifications appear alongside every other role's, in the same list (see SCRUM-48).
- Given a registration was withdrawn, when the event later changes or is cancelled, then that Attendee is not notified.
- Notification creation is idempotent for a single business event and recipient: retries cannot create duplicate notifications for the same trigger.

**Boundary:** this story owns Attendee-facing notifications and does not own the event lifecycle transition or resource-arrangement resolution.

Functionality Area: Notification System
