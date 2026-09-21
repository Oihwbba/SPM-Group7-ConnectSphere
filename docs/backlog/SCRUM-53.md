<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-09-21. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-53 - Approve or Reject Booking Request

| | |
|---|---|
| **Epic** | SCRUM-7 - Venue Management |
| **Priority** | Highest |
| **Story points** | 2 |
| **Status in Jira** | To Do|
| **Sprint** | Backlog |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-53 |

---

**User Story**
As Venue Staff, I want to approve or reject a booking request, so that the outcome is recorded and the coordinator can proceed.

**Acceptance Criteria**

- Venue Staff can set request status to Approved or Rejected.
- Given Venue Staff reject a request, when they submit the decision, then a **free-text** reason/comment is required and the decision cannot be saved without one.
- Given a request is approved, when the decision is saved, then the venue's availability calendar shows the period as unavailable.
- Given two pending requests for the same venue cover overlapping periods, when Venue Staff approve both at the same moment, then only one approval succeeds and the other is returned as conflicting - the venue is never double-booked.
- Given two pending requests are for periods that touch at an endpoint but do not overlap, when both are approved, then both succeed.
- Given a request has already been approved or rejected, when a decision is submitted for it again, then the original decision stands and no second outcome is recorded.

**Customer clarification (2026-09-13):** *"Free text reason is reasonable."* The second criterion previously said only that a reason was required, without saying what form it takes; it now states free text, matching the same answer applied to SCRUM-19 and SCRUM-43.

**Note (2026-09-07):** the original third criterion read "cannot be submitted ... (or is flagged as conflicting)" - block or flag was ambiguous, so it was not testable. It now specifies blocking. This story is one of the three that jointly deliver Booking Conflict Detection (with SCRUM-37 and SCRUM-38), so the rule needs to be unambiguous here. Endpoint semantics and the invalid-period case were added following the Week 2 assignment feedback, which asked for exactly this on a venue-blocking story.
