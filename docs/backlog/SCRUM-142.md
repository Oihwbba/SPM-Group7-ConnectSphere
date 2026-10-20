<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-20. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-142 - Change equipment lines or withdraw a venue request before confirmation

| | |
|---|---|
| **Type** | Story |
| **Epic** | SCRUM-10 - Equipment Management |
| **Priority** | High |
| **Story points** | 3 |
| **Status in Jira** | In Review |
| **Sprint** | SCRUM Sprint 3 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-142 |

---

**User story:** As an Event Coordinator, I want to change or withdraw my equipment request, or withdraw a pending venue request, while the event is still being planned, so that what is requested always matches what the event needs.

**Acceptance criteria**

1. Given my event is in Planning and its equipment request is Pending Review, In Review or Approved, when I add, change or remove a line, then the request returns to Pending Review for Technical Support to re-check, and its history records the change.
2. Given a line I change or remove already has equipment reserved for this event (SCRUM-31), then those reservations are cancelled and their stock returns to the pool exactly once, in the same operation.
3. Given my event is in Planning and its equipment request is Pending Review, In Review or Approved, when I withdraw the whole request, then it becomes Cancelled and any equipment reserved for it returns to the pool exactly once, in the same operation; I can raise a new request later (SCRUM-27). Given my equipment request was Rejected, then I raise a new request instead (SCRUM-27).
4. Given one of my event's venue requests is Pending, when I withdraw it, then it becomes Cancelled and leaves the Venue Staff queue (SCRUM-52), the event's other bookings don't change (SCRUM-162), and I can request another venue (SCRUM-50). A Held booking is released instead (SCRUM-163).
5. Given the event is Confirmed, when I try to change or withdraw equipment or withdraw a venue request, then I'm refused; changes go through a change request (SCRUM-41, SCRUM-128).
6. An Approved venue booking isn't withdrawn here. It is cancelled only by resolving a flag (SCRUM-26) or by cancelling or rejecting the event (SCRUM-82, SCRUM-117).
7. Only the event's assigned Coordinator can do this (SCRUM-67). Technical Support or Venue Staff are notified (SCRUM-124).
8. Repeating the same change or withdrawal changes nothing further.
9. Given a safety check was approved or is awaiting review, then a change or withdrawal here makes it Outdated (SCRUM-166).
10. Given an equipment request for my event is Pending Review or In Review, for example after a change in AC1, then the readiness checklist (SCRUM-110) shows Equipment as incomplete, so the event can't be Confirmed (SCRUM-81) until Technical Support approves it again. When every requested line is already reserved, Equipment shows "Awaiting Technical Support review".

**Customer basis:** "Can Coordinator add/remove equipment line items anytime before confirmation? Yes, changes allowed; Technical Support Staff re-check suitability." "Co-ordinator can submit booking request based on per event that he is assigned." Week 7 change 3: "Changes or cancellation of one venue arrangement should not automatically remove the other venue bookings unless this is explicitly required."

**Why this is a new story:** SCRUM-27 (Sprint 2, Done) creates an equipment request but has no way to change or withdraw it, and SCRUM-50 (Sprint 2, Done) has no way to withdraw a pending venue request, so a wrong request stays in the Venue Staff queue until it is rejected. Both are added here rather than re-scoping Done stories.

**Change log**

* 2026-10-01 (audit): created for two gaps found in the audit: the customer-required line changes before confirmation, and withdrawing a pending venue request.
* 2026-10-07 (Week 7 changes 3, 4 and 6): AC4 withdraws one of an event's several venue requests and leaves the others alone (SCRUM-162); a Held booking is released through SCRUM-163. AC9 puts a safety check out of date (SCRUM-167). The reason no longer depends on one venue per event, and the customer answer "Each event can only has one venue" is dropped from the customer basis, because Week 7 change 3 replaced it. AC3 adds withdrawing a whole equipment request, an audit edit that didn't save on 1 Oct.
* 2026-10-07 (backlog refinement): AC9 points to SCRUM-166, which SCRUM-167 was merged into.
* 2026-10-12 (PO decision 1, for the PO to confirm): AC10 added. Removing a line leaves the other lines reserved, so the event could be Confirmed before Technical Support's re-check, and Technical Support could then reject a request whose stock a Confirmed event still holds. The customer says Technical Support re-checks suitability after a change, so Confirm waits for it.

Functionality Area: Equipment Request Management, Venue Booking Request
