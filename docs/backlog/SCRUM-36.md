<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-09-13. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-36 - View Venue Availability

| | |
|---|---|
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

**Customer clarification (2026-09-13) — resolves the carried-forward scope question:**

* _"Venue Availability Calendar should reflect bookings and other recorded unavailability (e.g. maintenance)."_ Non-booking unavailability is therefore **in scope for Release 1**. The story previously carried this as an open question (Q7 in the Q&A log) because "venue unavailability management" appears on the Week 4 not-required list. The customer has confirmed that the _calendar reflecting_ unavailability is required; what is out of scope is a standalone unavailability-management feature.
* _"Calendar may be single view or per-venue"_ — the second criterion above records that this is the team's choice.

**Note (2026-09-07):** the touching-periods and empty-range criteria were added following the Week 2 assignment feedback, which asked for boundary behaviour to be stated wherever periods are compared.
