<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-07. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-36 - View venue availability

| | |
|---|---|
| **Type** | Story |
| **Epic** | SCRUM-7 - Venue Management |
| **Priority** | Highest |
| **Story points** | 2 |
| **Status in Jira** | Done |
| **Sprint** | SCRUM Sprint 2 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-36 |

---

**User story:** As an Event Coordinator or Venue Staff member, I want to see a venue's availability across dates and times, so that I know when it can realistically be requested.

**Acceptance criteria**

1. Given I select a venue and a date range, then I see one calendar for that venue showing its available and unavailable periods in Singapore time.
2. Given a booking for the venue is Approved, then its period shows as unavailable and names the event.
3. Given unavailability is recorded for the venue (SCRUM-37), then its period shows as unavailable with the reason, styled differently from a booking.
4. Pending booking requests are not shown as unavailable, because they don't block the venue (SCRUM-50).
5. Given one unavailable period ends exactly when another begins, then no gap is shown between them and no time is counted twice.
6. Given the venue has no bookings or unavailability in the selected range, then the whole range shows as available rather than as an empty view.
7. Coordinators and Venue Staff can open this view; other roles cannot (SCRUM-67).

**Customer basis:** "Venue Availability Calendar should reflect bookings and other recorded unavailability (e.g. maintenance)." "Calendar may be single view or per-venue." "Confirmed bookings block availability."

**Change log**

* 2026-10-01: team chose the per-venue view (the customer allowed either). Venue Staff added as viewers. Removed the 2026-09-13 decision record saying unavailability management was outside Release 1, which contradicted SCRUM-37 and the customer's answer above. Stated that Pending requests don't appear as unavailable.
* 2026-10-01 (audit): checked against the merged code, which matches. Summary in sentence case. Status moved to In Review because the code was merged on 29 Sep (PR #99).

Functionality Area: Venue Availability Calendar
