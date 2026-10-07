<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-08. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-53 - Approve or reject a booking request

| | |
|---|---|
| **Type** | Story |
| **Epic** | SCRUM-7 - Venue Management |
| **Priority** | Highest |
| **Story points** | 2 |
| **Status in Jira** | Done |
| **Sprint** | SCRUM Sprint 2 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-53 |

---

**User story:** As Venue Staff, I want to approve or reject a booking request, so that the outcome is recorded and the Coordinator can carry on planning.

**Acceptance criteria**

1. Venue Staff can set a Pending request to Approved or Rejected.
2. Given I reject a request, then a free-text reason is required and the decision cannot be saved without it.
3. Optionally, I can suggest an alternative venue or arrangement in the rejection reason.
4. Given I approve a request, then the venue's availability (SCRUM-36) shows the period as unavailable.
5. Given two Pending requests for the same venue have overlapping periods, when both are approved at the same moment, then only one approval succeeds and the other is returned as conflicting; the venue is never double-booked.
6. Given two Pending requests only touch at an endpoint, when both are approved, then both succeed.
7. I can only decide a Pending request. Given a request is already Approved, Rejected or Cancelled, when a decision is submitted again, then the original stands and nothing new is recorded.
8. Given an Approved booking or recorded unavailability now overlaps the period, then approval is refused.
9. Given a booking is rejected, then the event stays in Planning and the Coordinator can submit a new request, which creates a new booking record (SCRUM-50).
10. The Coordinator sees the decision and reason on the event's readiness checklist (SCRUM-110).

**Related:** the Coordinator is notified of the decision (SCRUM-124); first-come, first-served between competing requests is SCRUM-134; flagged requests can't be approved (SCRUM-26).

**Customer basis:** "Venue Staff may provide a reason or suggest an alternative venue/arrangement." "Optional, this is not considered as core requirement. Resubmission counts as new booking for audit." The free-text form follows the customer's answer "Free text reason is reasonable", which was given for Coordinator rejections and is applied here as a team decision.

**Change log**

* 2026-10-01 (mid-sprint correction, no new scope): renumbered; clarified where the "free text" quote came from. SCRUM-51 (track and be notified) was merged into this story and SCRUM-124 and is closed.
* 2026-10-01 (audit): AC3 says the suggestion goes in the free-text reason, as built (there is no separate field). AC10 names the readiness checklist (SCRUM-110), which is where the Coordinator sees the decision. Summary in sentence case.

Functionality Area: Venue Booking Approval, Booking Conflict Detection
