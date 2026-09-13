<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-09-13. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-85 - Attendee is notified of registration confirmation, event changes, and cancellation

| | |
|---|---|
| **Epic** | SCRUM-8 - Event Change & Notifications |
| **Priority** | High |
| **Story points** | 3 |
| **Status in Jira** | To Do |
| **Sprint** | Backlog |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-85 |

---

As an Attendee, I want to be notified when I successfully register, when a change to date/time/venue affects an event I'm registered for, or when that event is cancelled, so that I find out from ConnectSphere directly rather than only by checking back myself.

Acceptance Criteria:

* Given a registration is created, when it is saved, then the registering Attendee receives a notification confirming it.
* Given an approved change to an event's date, time, or venue affects an event with active (non-withdrawn) registrations, when the change is saved, then each registered Attendee is notified of the new details.
* Given an event is cancelled, when the cancellation is saved, then each registered (non-withdrawn) Attendee is notified.
* Given a user opens their notification list, when it loads, then these notifications appear alongside every other role's, in the same list (see "User views their notification list").
* Given a registration was withdrawn, when the event later changes or is cancelled, then that Attendee is not notified.

Note: closes the gap found in the 2026-09-06 backlog synthesis — the Notification System's own confirmed-feature description names "registration updates" as a required trigger, but the Notification epic was drafted before Attendee Registration existed, so nothing delivered it. Pairs with "System flags dependent bookings when a major field changes" and "View my registration status," whose own note asked "which story owns telling the Attendee" — this one does.

Functionality Area: Notification System
