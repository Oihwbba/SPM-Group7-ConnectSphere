<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-09-23. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-38 - Search Venues by Core Criteria

| | |
|---|---|
| **Type** | Story |
| **Epic** | SCRUM-7 - Venue Management |
| **Priority** | High |
| **Story points** | 2 |
| **Status in Jira** | To Do |
| **Sprint** | Backlog |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-38 |

---

User Story
As an Event Coordinator, I want to search venues by date, time, and location, so that I can quickly narrow down options for my event.

Acceptance Criteria

* Search accepts date, time range, and location as optional/combinable inputs.
* Given a venue is unavailable for any part of the specified date/time, when the search runs, then it is excluded from the results.
* Given a venue's existing booking ends at exactly the moment the searched period begins, or begins at exactly the moment it ends, when the search runs, then the venue is included - periods that touch at an endpoint do not overlap.
* Given the search end time is earlier than or the same as the start time, when the Coordinator searches, then the search is rejected and the time range is reported as invalid.
* Given no venue matches the criteria, when the search runs, then an explicit "no venues match" message is shown rather than an empty list.
* Results list shows key details (name, location, capacity) at a glance.


Note (2026-09-07): endpoint semantics, the invalid-range case and the no-results case were added following the Week 2 assignment feedback. This story is one of the three that jointly deliver Booking Conflict Detection, so its overlap rule must match SCRUM-50's and SCRUM-37's exactly.
