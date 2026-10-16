<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-15. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-38 - Search and filter venues by criteria and requirements

| | |
|---|---|
| **Type** | Story |
| **Epic** | SCRUM-7 - Venue Management |
| **Priority** | Highest |
| **Story points** | 3 |
| **Status in Jira** | To Do |
| **Sprint** | SCRUM Sprint 3 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-38 |

---

**User story:** As an Event Coordinator, I want to search venues by date, time and location and filter them by my event's needs, so that I quickly find venues that are free and fit, and can request one straight away.

**Acceptance criteria**

1. Given I open venue search from one of my events, then the date and time are fixed to the event's period, and the expected attendance is pre-filled from the event and can be changed; I set the required facilities, accessibility features and layout, with the Organiser's answers shown as in SCRUM-170 AC6. Given one of my event's bookings is flagged Needs Reconsideration (SCRUM-26), then it offers Find a replacement venue, which opens venue search with the date and time fixed to the event's period and the attendance, facilities and layout taken from that booking request; I can change the attendance, facilities and layout.
2. Given I open venue search on its own, then date, time range and location can be used alone or together. Given I open it from an event, then the date and time are the event's (AC1) and only location can be added.
3. Given a venue has an Approved or Held booking or recorded unavailability (SCRUM-37) that overlaps the occupied period a booking for the searched period would have at that venue (its setup and turnaround times included, SCRUM-159), then it is excluded.
4. Given the booking period a request for the searched period would have (without setup or turnaround) falls partly or wholly outside a venue's opening hours (SCRUM-34 AC7), then that venue is excluded from the results.
5. Given that occupied period only touches a booking's occupied period or recorded unavailability, then the venue is included: periods that only touch do not overlap.
6. Given the end is not after the start, then the search is rejected and the time range is reported as invalid.
7. Retired venues (SCRUM-34) never appear.
8. Each result shows name, location, capacity and the suitability indicator from SCRUM-40.
9. Given I opened search from an event, then each result offers Request this venue, which opens the booking form (SCRUM-50, SCRUM-162) for that venue and event. A venue where the event already has a Pending, Held or Approved booking is marked as already requested and offers no second request.
10. Given nothing matches, then a "No venues match" message is shown rather than an empty list.
11. Expected attendance, accessibility features, supported layout and required facilities can be applied as filters, alone or together with the search criteria.
12. With the attendance filter on, venues whose capacity is below the attendance in the search are excluded. That figure is pre-filled (AC1) and can be lowered when a room only needs to hold part of the audience (SCRUM-162).
13. Facility and accessibility filters allow several values.
14. Filters stay applied when the search criteria change.
15. Given only the setup or turnaround time would fall outside a venue's opening hours, then that venue is included in the results (SCRUM-34 AC7).

**Related:** Booking Conflict Detection is delivered jointly by this story, SCRUM-37, SCRUM-50, SCRUM-53 and SCRUM-159 (occupied periods); their overlap rule must stay identical.

**Customer Basis:** W9 G4 (Week 7 change 1): "The venue staff will decide whether to approve considering the setup and turnaround time."

**Change log**

* 2026-09-07: endpoint, invalid-range and no-results cases added after the Week 2 assignment feedback.
* 2026-09-29: merged SCRUM-39 (filters).
* 2026-10-01: rewritten in one format; added the operating-hours exclusion, retired venues and the suitability indicator.
* 2026-10-01 (audit): search now opens pre-filled from the event and each result can start a booking request, so finding a venue leads straight into requesting it. Opening hours come from SCRUM-34. Group headings removed; the filter criteria are part of the one list. Re-estimate at planning: the pre-fill and the request link add work.
* 2026-10-07 (Week 7 changes 1 to 4): AC3 to AC5 use occupied periods and treat Held bookings as taken (SCRUM-159, SCRUM-163). AC1 opens from a flagged booking to find a replacement venue (SCRUM-161). AC9 marks venues the event has already requested (SCRUM-162).
* 2026-10-07 (backlog refinement): AC12 filters on the attendance entered in the search, which can be lowered for a room that holds part of the audience (SCRUM-162), instead of always on the event's expected attendance.
* 2026-10-08: AC1 no longer pre-fills facilities, accessibility features and layout, because SCRUM-127 was dropped; the Coordinator sets them, with the Organiser's answers shown (SCRUM-170).
* 2026-10-08: AC1 restores opening search from a flagged booking (SCRUM-161), which the earlier rewrite dropped, and says what it pre-fills.
* 2026-10-10: Reword SCRUM-38 AC1 and AC2 such that search period does not differ from event period
* 2026-10-13 (W9 clarification, Week 7 change 1): AC4 excludes a venue only when the booking period itself is outside opening hours. AC15 keeps a venue in the results when only setup or turnaround falls outside, because Venue Staff decide (SCRUM-159 AC9).
* 2026-10-14: AC1 owns the Find a replacement venue action, offered on any flagged booking (formerly SCRUM-161 AC5), and points to SCRUM-170 AC6 for showing the Organiser's answers instead of restating it.

Functionality Area: Venue Search and Filtering
