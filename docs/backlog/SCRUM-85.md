<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-09. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-85 - Attendees are kept informed when an event they registered for changes or is cancelled

| | |
|---|---|
| **Type** | Story |
| **Epic** | SCRUM-8 - Event Change & Notifications |
| **Priority** | High |
| **Story points** | 5 |
| **Status in Jira** | To Do |
| **Sprint** | SCRUM Sprint 3 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-85 |

---

**User story:** As an Attendee, I want to be told when I register, to see a clear status while an event I registered for is being updated, and to be told when it changes or is cancelled, so that I hear it from ConnectSphere directly and am never confused by an internal status.

**Acceptance criteria**

1. Given I register for an event (SCRUM-73), then I get one notification confirming my registration.
2. Given the date, time or any booked venue of an event I'm Registered for changes, through an approved change request (SCRUM-128) or because a flagged booking was cancelled and another venue booked (SCRUM-26, SCRUM-161), then when the event is Confirmed again every Registered Attendee gets one notification with the updated details, listing every venue (SCRUM-162).
3. A date, time or venue change does not cancel my registration; the notification tells me the new details.
4. Given an event I'm Registered for is cancelled (SCRUM-82), then I get a notification with the reason.
5. Given my registration is Withdrawn, then I'm not notified of later changes or cancellation.
6. Each trigger creates exactly one notification per recipient; retries create no duplicates.
7. These notifications appear in the same list as every other notification (SCRUM-48), and link to the Attendee view of the event (SCRUM-72, or AC9 while it is being re-planned).
8. Given an event I'm registered for returns to Planning (SCRUM-128 or SCRUM-26), when I view my registrations (SCRUM-76), then it shows "Details being updated – registration paused" and never the internal status "Planning".
9. Given the same event, when I open it from my registrations or from a notification (SCRUM-48), then I see the Attendee view: name, description and the last confirmed date, time and venues, with no internal planning information.
10. The event is not listed in the browse list (SCRUM-72) until it is Confirmed again, and my registration stays Registered.
11. Given it becomes Confirmed again, then the normal Attendee view returns, and the notification in AC2 is sent if the date, time or venue changed.
12. Given it is cancelled instead (SCRUM-82), then my registration shows Cancelled and the notification in AC4 is sent.

**Boundary:** this story owns Attendee notifications and what an Attendee sees while their event is re-planned; it doesn't own lifecycle transitions or arrangement flags.

**Customer basis:** "Notifications cover event submission, approval, registration updates, confirmation, cancellation." Requirement 8b: "an Attendee should not be able to view internal planning information."

**Why the re-planning view is part of this story:** SCRUM-23 (Sprint 1, Done) shows the raw event status, and SCRUM-72 lists only Confirmed events. A registered Attendee could therefore see "Planning" or follow a notification link to a page they cannot open.

**Change log**

* 2026-10-01: rewritten as a trigger table; added waiting-list offers and cancellations (SCRUM-79 is now in scope); change source now SCRUM-128.
* 2026-10-01 (verification pass): the change notification now also covers a venue rebooked after a flag (SCRUM-26), and is sent when the event is Confirmed again so Attendees get final details once, matching SCRUM-133 AC4.
* 2026-10-01 (audit): the table is now one numbered criterion per trigger. Waiting-list notifications removed and cancellation goes to Registered Attendees, because SCRUM-79 is beyond Release 1.
* 2026-10-07 (Week 7 changes 2 and 3): AC2 covers any of the event's booked venues and lists them all (SCRUM-162), including a venue replaced after it became unavailable (SCRUM-161).
* 2026-10-07 (backlog refinement): merged SCRUM-133; its AC1–AC5 are AC8–AC12 here. Both stories covered the same Attendee and the same triggers (return to Planning, Confirmed again, cancelled) and pointed at each other. SCRUM-133's own history: on 2026-10-07 (Week 7 change 3) its AC2, now AC9, was changed to show every last confirmed venue. Re-estimated from 3 to 5.
* 2026-10-07 (backlog refinement): group headings removed; the criteria are one numbered list.

Functionality Area: Notification System, Attendee Registration
