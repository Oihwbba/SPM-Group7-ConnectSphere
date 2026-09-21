<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-09-21. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-50 - Submit Venue Booking Request

| | |
|---|---|
| **Epic** | SCRUM-7 - Venue Management |
| **Priority** | Highest |
| **Story points** | 2 |
| **Status in Jira** | To Do|
| **Sprint** | Backlog |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-50 |

---

**User Story**
As an Event Coordinator, I want to submit a request to book a venue with event timing and requirements, so that Venue Staff have what they need to assess it.

**Acceptance Criteria**

- Request captures venue, date/time, expected attendance, required facilities/layout, and other relevant event details.
- Given the venue is free for the whole requested period, when the Coordinator submits, then the request is created with status "Pending" and the Coordinator is shown confirmation that it was submitted.
- Given the venue is already unavailable for any part of the requested period, when the Coordinator submits, then the request is not created and the Coordinator is told the venue is unavailable for that period.
- Given an existing booking or unavailability ends at exactly the moment the requested period begins, or begins at exactly the moment it ends, when the Coordinator submits, then the request is accepted - periods that touch at an endpoint do not overlap.
- Given the requested end is earlier than or the same as the requested start, when the Coordinator submits, then the request is not created and the period is reported as invalid.
- Given the Coordinator already has a pending request for the same venue and an overlapping period, when they submit again, then no second request is created and they are shown the existing one.

**Note (2026-09-07):** the original third criterion read "cannot be submitted ... (or is flagged as conflicting)" - block or flag was ambiguous, so it was not testable. It now specifies blocking. This story is one of the three that jointly deliver Booking Conflict Detection (with SCRUM-37 and SCRUM-38), so the rule needs to be unambiguous here. Endpoint semantics and the invalid-period case were added following the Week 2 assignment feedback, which asked for exactly this on a venue-blocking story.
