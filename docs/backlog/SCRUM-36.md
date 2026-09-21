<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-09-21. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-36 - View Venue Availability

| | |
|---|---|
| **Type** | Story |
| **Epic** | SCRUM-7 - Venue Management |
| **Priority** | Highest |
| **Story points** | 2 |
| **Status in Jira** | To Do |
| **Sprint** | Backlog |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-36 |

---

**User Story**
As an Event Coordinator, I want to view a venue's availability across dates and times, so that I know when it can realistically be requested.

**Acceptance Criteria**

* Calendar/list view shows available and unavailable periods for a selected venue.
* The view may be a single calendar across venues or one calendar per venue — the team chooses.
* Given a booking has been approved for a period, when the Coordinator views that venue, then the period appears as unavailable.
* Given other unavailability has been recorded (e.g. maintenance), when the Coordinator views the venue, then it appears as unavailable and is visually distinguishable from a booking.
* Given one unavailable period ends at exactly the moment another begins, when the Coordinator views the venue, then no gap is shown between them and no time is double-counted as both available and unavailable.
* Given a venue has no bookings or unavailability in the selected range, when the Coordinator views it, then the whole range shows as available rather than showing an empty view.
* View can be filtered by date range.

**Decision record (2026-09-13):** Venue Availability Calendar reflects approved bookings and recorded non-booking unavailability. A standalone unavailability-management feature remains outside Release 1.

Functionality Area: Venue Management
