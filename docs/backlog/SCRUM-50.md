<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-23. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-50 - Submit a venue booking request

| | |
|---|---|
| **Type** | Story |
| **Epic** | SCRUM-7 - Venue Management |
| **Priority** | Highest |
| **Story points** | 2 |
| **Status in Jira** | Done |
| **Sprint** | SCRUM Sprint 2 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-50 |

---

**User story:** As an Event Coordinator, I want to submit a request to book a venue with the event's timing and requirements, so that Venue Staff have what they need to assess it.

**Superseded in part:** AC1's rounding of the period ("start rounded down and end rounded up to the half hour") is superseded by SCRUM-188: choosing the event fills in the period exactly as the event's start and end, so venue search and the request check the same period. The criteria below are kept as accepted in Sprint 2.

**Acceptance criteria**

1. The request captures the venue, the period, expected attendance, required facilities and layout, and notes. Choosing the event pre-fills the period (start rounded down and end rounded up to the half hour) and the expected attendance. These values are not editable; the booking request must cover the event's period and use the event's expected attendance.
2. Given the venue is free for the whole period, when I submit, then the request is created as Pending and I'm shown that it was submitted.
3. Given the venue has an Approved booking or recorded unavailability for any part of the period, when I submit, then no request is created and I'm told what makes the venue unavailable.
4. Given an existing booking or unavailability ends exactly when the period begins, or begins exactly when it ends, then the request is accepted: periods that only touch do not overlap.
5. Given the end is not after the start, or the start has already passed, then no request is created and the period is reported as invalid.
6. Given the attendance is above the venue's capacity, then no request is created and the capacity is shown. Attendance equal to capacity fits.
7. Only the event's assigned Coordinator can request a venue, and only while the event is in Planning. An approved event moves straight to Planning (SCRUM-81).
8. Each event has one venue. Given the event already has a Pending or Approved booking, for any venue, when I submit another, then no request is created and I'm shown the existing one.
9. Given the previous request was Rejected or Cancelled, then a new request creates a new booking record, and the earlier one is kept.
10. A Pending request does not block the venue; only an Approved booking does.

**Related:** fixing the period and attendance to the event is SCRUM-170; refusing periods outside opening hours is SCRUM-34; withdrawing a Pending request is SCRUM-142; competing Pending requests are decided in submission order (SCRUM-134); Venue Staff are notified of new requests (SCRUM-124).

**Customer basis:** "Co-ordinator can submit booking request based on per event that he is assigned. Each event can only has one venue." "Confirmed bookings block availability. Pending conflicts are only resolved outside of system currently; the team can also propose and implement other mechanism."

**Change log**

* 2026-09-07: the "cannot be submitted … (or is flagged)" criterion now specifies blocking; endpoint semantics and the invalid-period case added after the Week 2 assignment feedback.
* 2026-10-01 (mid-sprint correction): requested period stated as the event's period; duplicate rule merged into AC8 (both revised below).
* 2026-10-01 (audit): the booking form now follows the event as its source of truth: period and expected attendance are pre-filled and not editable, while opening-hours validation remains with SCRUM-34 and capacity/past-start validation remains here. AC8 stays because the customer asked for one venue per event. Before acceptance, the duplicate-request constraint (booking_no_duplicate_pending_request) still needs to be keyed on the event rather than the requesting Coordinator; this is tracked as a separate implementation task.
* 2026-10-07: the Related note points the period and attendance pre-fill to SCRUM-170, which took it over when SCRUM-127 was split.
* 2026-10-23 (SCRUM-222): marked AC1's half-hour rounding as superseded by SCRUM-188 (PO approved 2026-10-21), so the story no longer reads as current where the code follows SCRUM-188.

Functionality Area: Venue Booking Request, Booking Conflict Detection
