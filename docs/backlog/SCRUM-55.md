<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-09-30. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-55 - View Equipment Availability Calendar

| | |
|---|---|
| **Type** | Story |
| **Epic** | SCRUM-10 - Equipment Management |
| **Priority** | Low |
| **Story points** | 2 |
| **Status in Jira** | To Do |
| **Sprint** | Backlog |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-55 |

---

* User Story: As a Technical Support Staff member, I want to view a calendar showing equipment commitments, so that I can visually identify available time slots and plan reservations efficiently.
* Acceptance Criteria:
    * Given I am Technical Support Staff, when I access the equipment calendar, then I can view a timeline/calendar for specific equipment types.
    * Given I view the calendar, when equipment is reserved, then the booked time slots are visually blocked out and labeled with the associated event name.
    * Given two reservations touch at an endpoint - one ends exactly when the next begins - when I view the calendar, then they render as adjacent blocks with no gap and no overlap.
    * Given I view the calendar, when equipment is under maintenance, then those time slots are visually marked as unavailable in a distinct color.
    * Given an equipment type has no commitments in the displayed range, when I view the calendar, then the range renders as fully open rather than as a blank calendar.


‌

Note (2026-09-07): adjacency and empty-range rendering added following the Week 2 assignment feedback, and to keep this view consistent with the overlap rule in SCRUM-29/30/31. This story is a visualisation layer on logic those stories already own; "Event Calendar" is on the Week 4 not-required list, so it stays lowest priority.

Functionality Area: Equipment Availability Checking (beyond core scope)
