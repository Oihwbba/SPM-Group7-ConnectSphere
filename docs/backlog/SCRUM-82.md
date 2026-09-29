<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-09-30. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-82 - Close an event: cancel it, or mark it completed once it has passed

| | |
|---|---|
| **Type** | Story |
| **Epic** | SCRUM-6 - Event Request Lifecycle |
| **Priority** | High |
| **Story points** | 3 |
| **Status in Jira** | To Do |
| **Sprint** | Backlog |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-82 |

---

Merged story (29 Sep 2026): absorbs SCRUM-83 (Mark a confirmed event completed once it has passed). Any reference to SCRUM-83 elsewhere now means this story.

As an Event Coordinator or the event's Organiser, I want to cancel an event that will no longer go ahead, so that ConnectSphere, other staff, and any registered Attendees all see it as cancelled rather than continuing to plan or attend it.

Acceptance Criteria:

* Given an event in any status before "completed," when the assigned Coordinator or the event's own Organiser cancels it, then its status changes to "cancelled"
* A cancellation reason can be recorded and is visible to anyone who could already view the event
* Cancelling releases any associated venue booking and equipment reservation back to available (mirrors the release logic already defined for withdrawing a registration)
* A cancelled event cannot be reactivated — starting over means submitting a new request
* Cancelling triggers the existing status-change notification ("User is notified when event status changes" already lists "Cancelled" as a trigger) and the new Attendee-facing notification story added alongside this one

Note: closes the last of the 9 named event statuses with no owning action anywhere in the backlog. Added 2026-09-06 following the full backlog synthesis.

INVEST: Independent (needs only that an event and its assignment exist); Negotiable (whether Venue Staff/Technical Support can also cancel directly, or only via the Coordinator, is open); Valuable (closes the last of the 9 statuses with no owning action, and "cancellation" is named explicitly in the Notification System feature's own gist); Estimable and Small (one status transition plus two release side-effects already modelled elsewhere); Testable (cancel from several starting statuses; assert booking/reservation released; assert cancelled cannot be un-cancelled).

Functionality Area: Event Status Management

---

Merged from SCRUM-83 — Mark a confirmed event completed once it has passed

As ConnectSphere, I want a confirmed event to move to "completed" once its event end instant has passed, so that past events are recorded accurately and are distinguishable from ones still upcoming.

Acceptance Criteria:

* Given a Confirmed event whose end instant has passed, when the system next checks, then its status changes to Completed.
* The event's start/end date and time are interpreted in the event timezone defined by SCRUM-13; persisted comparisons use the corresponding UTC instant.
* Given the current time is exactly the event's end instant, when the system checks, then the event is NOT yet completed — completion occurs only after that instant.
* Given an event that has already been marked Completed, when the system checks again, then its status does not change and no duplicate completion notification is sent.
* An event that was Cancelled before its completion instant is never marked Completed.
* A completed event's other recorded details (venue, equipment, registrations) remain visible unchanged.

Boundary: the stated event end time is the completion boundary; timezone interpretation is centralized in SCRUM-13.

Functionality Area: Event Status Management
