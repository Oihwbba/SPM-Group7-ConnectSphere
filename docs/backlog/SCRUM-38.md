<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-07. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-38 - Search and filter venues by criteria and requirements

| | |
|---|---|
| **Type** | Story |
| **Epic** | SCRUM-7 - Venue Management |
| **Priority** | Highest |
| **Story points** | 3 |
| **Status in Jira** | To Do |
| **Sprint** | Backlog |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-38 |

---

**User story:** As an Event Coordinator, I want to search venues by date, time and location and filter them by my event's needs, so that I quickly find venues that are free and fit, and can request one straight away.

**Acceptance criteria**

1. Given I open venue search from one of my events, then the date, time, expected attendance, required facilities, accessibility features and layout are pre-filled from the event (SCRUM-127), and I can change any of them. Given I open it from a flagged booking with Find a replacement venue (SCRUM-161), then it is pre-filled from that booking instead and leaves out the booking's venue.
2. Date, time range and location can be used alone or together.
3. Given a venue has an Approved or Held booking or recorded unavailability (SCRUM-37) that overlaps the occupied period a booking for the searched period would have at that venue (its setup and turnaround times included, SCRUM-159), then it is excluded.
4. Given that occupied period falls partly or wholly outside a venue's opening hours (SCRUM-34), then it is excluded, because the booking request would be refused.
5. Given that occupied period only touches a booking's occupied period or recorded unavailability, then the venue is included: periods that only touch do not overlap.
6. Given the end is not after the start, then the search is rejected and the time range is reported as invalid.
7. Retired venues (SCRUM-34) never appear.
8. Each result shows name, location, capacity and the suitability indicator from SCRUM-40.
9. Given I opened search from an event, then each result offers Request this venue, which opens the booking form (SCRUM-50, SCRUM-162) for that venue and event. A venue where the event already has a Pending, Held or Approved booking is marked as already requested and offers no second request.
10. Given nothing matches, then a "No venues match" message is shown rather than an empty list.
11. Expected attendance, accessibility features, supported layout and required facilities can be applied as filters, alone or together with the search criteria.
12. With the attendance filter on, venues whose capacity is below expected attendance are excluded.
13. Facility and accessibility filters allow several values.
14. Filters stay applied when the search criteria change.

**Related:** Booking Conflict Detection is delivered jointly by this story, SCRUM-37, SCRUM-50, SCRUM-53 and SCRUM-159 (occupied periods); their overlap rule must stay identical.

**Change log**

* 2026-09-07: endpoint, invalid-range and no-results cases added after the Week 2 assignment feedback.
* 2026-09-29: merged SCRUM-39 (filters).
* 2026-10-01: rewritten in one format; added the operating-hours exclusion, retired venues and the suitability indicator.
* 2026-10-01 (audit): search now opens pre-filled from the event and each result can start a booking request, so finding a venue leads straight into requesting it. Opening hours come from SCRUM-34. Group headings removed; the filter criteria are part of the one list. Re-estimate at planning: the pre-fill and the request link add work.
* 2026-10-07 (Week 7 changes 1 to 4): AC3 to AC5 use occupied periods and treat Held bookings as taken (SCRUM-159, SCRUM-163). AC1 opens from a flagged booking to find a replacement venue (SCRUM-161). AC9 marks venues the event has already requested (SCRUM-162).

Functionality Area: Venue Search and Filtering
