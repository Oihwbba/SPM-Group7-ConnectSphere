<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-11-04. Jira is the source of truth.
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

**Superseded in part** (the criteria below are kept as accepted in Sprint 2):

* **AC1 and AC7, superseded by SCRUM-163 AC1 and AC7:** Venue Staff can also hold a Pending request until an expiry, and can approve or reject a Held booking before it expires. Deciding a hold a second time changes nothing.
* **AC4–AC6 and AC8, superseded by SCRUM-159 AC3–AC5 and AC7:** conflicts compare occupied periods, which add the venue's setup time before a booking and its turnaround time after it. Two requests conflict when their occupied periods overlap and don't when those periods only touch, and the calendar shows the setup and turnaround time around an approved booking.

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

**Customer basis:** "Free text reason is reasonable", which was given for Coordinator rejections and is applied here as a team decision.

**Change log**

* 2026-10-01 (mid-sprint correction, no new scope): renumbered; clarified where the "free text" quote came from. SCRUM-51 (track and be notified) was merged into this story and SCRUM-124 and is closed.
* 2026-10-01 (audit): AC3 says the suggestion goes in the free-text reason, as built (there is no separate field). AC10 names the readiness checklist (SCRUM-110), which is where the Coordinator sees the decision. Summary in sentence case.
* 2026-10-29 (SCRUM-244, logged 2026-11-01): removed "Venue Staff may provide a reason or suggest an alternative venue/arrangement." and "Optional, this is not considered as core requirement. Resubmission counts as new booking for audit." from the Customer basis. Criteria unchanged.
* 2026-11-04 (SCRUM-260, PO approved 2026-11-04): added the Superseded in part note for SCRUM-159 and SCRUM-163, whose Supersedes lines already name this story. Criteria unchanged.

Functionality Area: Venue Booking Approval, Booking Conflict Detection
