<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-20. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-188 - Request a venue for exactly the event's period

| | |
|---|---|
| **Type** | Story |
| **Epic** | - |
| **Priority** | Medium |
| **Story points** | 1 |
| **Status in Jira** | To Do |
| **Sprint** | Backlog |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-188 |

---

**User story:** As an Event Coordinator, I want a venue request to use exactly the event's period, so that the event, its booking and venue search never disagree about the time.

**Acceptance criteria**

1. Given I choose an event on the venue request form (SCRUM-50), then the period is filled in exactly as the event's start and end, not rounded, and can't be edited.
2. Given a request whose period isn't exactly the event's, then it is refused with "The requested period must be the event's: <start> to <end>." and nothing is saved.
3. Given venue search lists a venue as free for my event (SCRUM-38 AC1, AC2), then requesting it is checked for the same period, so it isn't refused unless something was booked there in between.
4. Bookings already made keep the periods they were made with (ADR 0003).

**Supersedes:** SCRUM-50 AC1, "start rounded down and end rounded up to the half hour".

**Related:** SCRUM-38 AC2 fixes the search period to the event's own (change log, 2026-10-10).

**Why this is a new story:** SCRUM-50 is Done and was accepted with the rounding. Search now uses the event's exact period, so search and the request can differ by up to 29 minutes at each end. A venue search shows as free can be refused when requested, bookings hold venues for time nobody needs, and Venue Staff see a different time from the event.

**Customer basis:** team decision, to keep search and requests consistent ("their overlap rule must stay identical", SCRUM-38 Related).

**Change log**

* 2026-10-16: created from SCRUM-38 development; supersedes SCRUM-50 AC1's rounding.

Functionality Area: Venue Booking Request
