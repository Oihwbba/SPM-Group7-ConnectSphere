<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-09-30. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-37 - Reflect Bookings and Unavailability in Real Time

| | |
|---|---|
| **Type** | Story |
| **Epic** | SCRUM-7 - Venue Management |
| **Priority** | Highest |
| **Story points** | 3 |
| **Status in Jira** | To Do |
| **Sprint** | SCRUM Sprint 2 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-37 |

---

User Story
As an authorised internal user, I want the availability calendar to update as bookings are approved or unavailability is recorded, so that I'm not working from stale information.

Acceptance Criteria

* Newly approved bookings appear on the calendar without inconsistency.
* Venue Staff can record non-booking unavailability directly, with a period and a reason (e.g. maintenance, closure).
* Given recorded unavailability overlaps a period a Coordinator is searching or requesting, when the search or request runs, then the venue is treated as unavailable for that period on the same terms as a booking (see SCRUM-38 and SCRUM-50).
* Given unavailability is recorded for a period that already has an approved booking, when Venue Staff save, then the conflict is surfaced rather than silently overwriting the booking.
* Given an unavailability period ends at exactly the moment a requested period begins, then the two do not overlap — the same endpoint convention used everywhere else in this backlog.

Customer clarification (2026-09-13): "Venue Availability Calendar should reflect bookings and other recorded unavailability (e.g. maintenance)." This confirms that recording non-booking unavailability is in scope for Release 1. The last three criteria are new: the story previously said only that Venue Staff "can record" it, without saying what recording it actually does to search and booking — which made it untestable.
