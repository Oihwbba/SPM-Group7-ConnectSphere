<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-09. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-37 - Record venue unavailability and reflect it everywhere

| | |
|---|---|
| **Type** | Story |
| **Epic** | SCRUM-7 - Venue Management |
| **Priority** | Highest |
| **Story points** | 3 |
| **Status in Jira** | Done |
| **Sprint** | SCRUM Sprint 2 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-37 |

---

**User story:** As Venue Staff, I want to record when a venue is unavailable for reasons other than a booking, so that nobody books it during maintenance or closure.

**Acceptance criteria**

1. Venue Staff can record unavailability for a venue with a start, an end and a reason (Maintenance, Damaged, Closure or Other), plus an optional note. The end must be after the start.
2. Given unavailability is saved, then the venue calendar (SCRUM-36), venue search (SCRUM-38) and booking requests (SCRUM-50) treat the venue as unavailable for that period, exactly like an Approved booking, and approving a booking over it is refused (SCRUM-53).
3. Given the period overlaps an Approved booking or unavailability already recorded, when Venue Staff save, then nothing is recorded and they are shown what it clashes with, so they can agree the next step with the event's Coordinator offline.
4. Given an approval and an unavailability record for overlapping periods are saved at the same moment, then only one of them is saved.
5. Given an unavailability period ends exactly when another period begins, or begins exactly when it ends, then they do not overlap.
6. Only Venue Staff can record unavailability (SCRUM-67).

**Related:** a Pending booking request doesn't stop unavailability being recorded; Venue Staff see the request in their queue (SCRUM-52) and can reject it. Ending or removing a recorded period is beyond Release 1 (Venue Unavailability Management is on the Week 4 not-required list); until then a mistaken record is corrected in the data.

**Customer basis:** "Venue Availability Calendar should reflect bookings and other recorded unavailability (e.g. maintenance)." Briefing: "A venue may also be unavailable because of maintenance, renovation, safety restrictions, or another internal activity."

**Change log**

* 2026-10-01: summary and user story aligned; overlap with Pending requests and flagging added (both revised below).
* 2026-10-01 (audit): restored to the behaviour the merged code and the 30 Sep criteria have: an overlap with an approved booking is refused and shown, not saved and flagged. Ending or removing a period (the earlier AC6) isn't built and is beyond Release 1. AC4 states the simultaneous-save case the database already guarantees. Status moved to In Review because the code was merged on 29 Sep (PR #99).

Functionality Area: Venue Availability Calendar, Booking Conflict Detection
