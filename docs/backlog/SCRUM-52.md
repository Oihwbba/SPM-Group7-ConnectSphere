<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-08. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-52 - Review pending booking requests

| | |
|---|---|
| **Type** | Story |
| **Epic** | SCRUM-7 - Venue Management |
| **Priority** | Highest |
| **Story points** | 2 |
| **Status in Jira** | Done |
| **Sprint** | SCRUM Sprint 2 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-52 |

---

**User story:** As Venue Staff, I want to review pending booking requests with their event details, so that I can decide whether to approve or reject them.

**Acceptance criteria**

1. Venue Staff see a list of Pending booking requests, soonest event first. No other role can see it (SCRUM-67).
2. Each request shows the venue, period, expected attendance, facilities and layout needs, and the requesting Coordinator.
3. Given I open a pending request, then I see any Approved bookings or recorded unavailability that overlap its period at that venue, and the venue's capacity next to the expected attendance.
4. Given there are no pending requests, then an empty-state message is shown.

**Related (later stories, not part of this one):** competing Pending requests for the same venue and the first-come, first-served order are SCRUM-134; the Coordinator's suitability judgement shown on the request is SCRUM-40; flagged requests can't be approved (SCRUM-26).

**Change log**

* 2026-10-01 (mid-sprint): no change to acceptance criteria; added the related-stories note.
* 2026-10-01 (audit): AC1 says soonest event first, as built (the queue is sorted by event start; submission order belongs to SCRUM-134). Summary in sentence case.

Functionality Area: Venue Booking Approval
