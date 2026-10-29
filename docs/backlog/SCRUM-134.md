<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-29. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-134 - Decide competing venue and equipment requests in the order they were made

| | |
|---|---|
| **Type** | Story |
| **Epic** | SCRUM-7 - Venue Management |
| **Priority** | Medium |
| **Story points** | 3 |
| **Status in Jira** | Done |
| **Sprint** | SCRUM Sprint 3 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-134 |

---

**User story:** As Venue Staff or Technical Support Staff, I want to see which open requests compete for the same venue or stock and settle them in the order they were made, so that conflicts are settled first come, first served.

**Acceptance criteria**

1. Given I open a pending venue request (SCRUM-52), then I see every other Pending request for the same venue whose occupied period (SCRUM-159) overlaps it, with each request's submission time.
2. Given an earlier overlapping Pending request exists for the same venue, when I try to approve or hold a later one, then it is refused until the earlier one has been approved, held, rejected or withdrawn (SCRUM-142). A Held booking blocks later requests like an Approved one until its hold expires (SCRUM-163).
3. Requests whose occupied periods only touch at an endpoint do not compete.
4. Given I open an equipment request (SCRUM-28), then for each line I see the other open requests (Pending Review, In Review or Approved) for the same type whose events overlap it, with each request's submission time and how much is already reserved for it.
5. Given reserving stock (SCRUM-31) for a later request would leave too little of that type for an earlier open request whose event overlaps, when I try to reserve it, then the reservation is refused until the earlier request has been reserved in full, rejected or cancelled.
6. Rejecting a request is never blocked by this rule.

**Why this is a new story:** Pending requests don't block a venue (SCRUM-50), and SCRUM-52 shows only approved overlaps, so staff could approve the later of two competing requests. Approving an equipment request holds no stock; reserving does (SCRUM-31), so a later request could be reserved first. SCRUM-52 and SCRUM-28 (Sprint 2) and SCRUM-31 (Sprint 1) are Done, so this behaviour is added here rather than re-scoping them.

**Change log**

* 2026-10-01 (audit): the equipment criteria follow the built model: requests are reviewed as a whole and stock is held by reservations (SCRUM-31), so the first-come rule applies when reserving. A withdrawn venue request (SCRUM-142) no longer blocks later ones.
* 2026-10-07 (Week 7 changes 1 and 4): AC1 to AC3 compare occupied periods (SCRUM-159). AC2 applies to holds as well as approvals, and a Held booking blocks later requests like an Approved one (SCRUM-163).

Functionality Area: Venue Booking Approval, Equipment Availability Checking
