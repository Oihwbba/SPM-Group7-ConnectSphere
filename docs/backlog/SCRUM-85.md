<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-04. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-85 - Attendee is notified of registration confirmation, event changes, and cancellation

| | |
|---|---|
| **Type** | Story |
| **Epic** | SCRUM-8 - Event Change & Notifications |
| **Priority** | High |
| **Story points** | 3 |
| **Status in Jira** | To Do |
| **Sprint** | Backlog |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-85 |

---

**User story:** As an Attendee, I want to be told when I register, when an event I'm registered for changes, or when it's cancelled, so that I hear it from ConnectSphere directly.

**Acceptance criteria**

1. Given I register for an event (SCRUM-73), then I get one notification confirming my registration.
2. Given the date, time or booked venue of an event I'm Registered for changes, through an approved change request (SCRUM-128) or because a different venue is booked after a flagged booking was cancelled (SCRUM-26), then when the event is Confirmed again every Registered Attendee gets one notification with the updated details.
3. A date, time or venue change does not cancel my registration; the notification tells me the new details.
4. Given an event I'm Registered for is cancelled (SCRUM-82), then I get a notification with the reason.
5. Given my registration is Withdrawn, then I'm not notified of later changes or cancellation.
6. Each trigger creates exactly one notification per recipient; retries create no duplicates.
7. These notifications appear in the same list as every other notification (SCRUM-48), and link to the Attendee view of the event (SCRUM-72, SCRUM-133).

**Boundary:** this story owns Attendee notifications only; it doesn't own lifecycle transitions or arrangement flags.

**Customer basis:** "Notifications cover event submission, approval, registration updates, confirmation, cancellation."

**Change log**

* 2026-10-01: rewritten as a trigger table; added waiting-list offers and cancellations (SCRUM-79 is now in scope); change source now SCRUM-128.
* 2026-10-01 (verification pass): the change notification now also covers a venue rebooked after a flag (SCRUM-26), and is sent when the event is Confirmed again so Attendees get final details once, matching SCRUM-133 AC4.
* 2026-10-01 (audit): the table is now one numbered criterion per trigger. Waiting-list notifications removed and cancellation goes to Registered Attendees, because SCRUM-79 is beyond Release 1.

Functionality Area: Notification System
