<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-04. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-142 - Change equipment lines or withdraw a venue request before confirmation

| | |
|---|---|
| **Type** | Story |
| **Epic** | SCRUM-10 - Equipment Management |
| **Priority** | Medium |
| **Story points** | 3 |
| **Status in Jira** | To Do |
| **Sprint** | Backlog |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-142 |

---

**User story:** As an Event Coordinator, I want to change my equipment request or withdraw a pending venue request while the event is still being planned, so that what is requested always matches what the event needs.

**Acceptance criteria**

1. Given my event is in Planning and its equipment request is Pending Review, In Review or Approved, when I add, change or remove a line, then the request returns to Pending Review for Technical Support to re-check, and its history records the change.
2. Given a line I change or remove already has equipment reserved for this event (SCRUM-31), then those reservations are cancelled and their stock returns to the pool exactly once, in the same operation.
3. Given my equipment request was Rejected, then I raise a new request instead (SCRUM-27).
4. Given my venue request is Pending, when I withdraw it, then it becomes Cancelled, it leaves the Venue Staff queue (SCRUM-52), and I can request another venue (SCRUM-50).
5. Given the event is Confirmed, when I try to change an equipment line or withdraw a venue request, then I'm refused; changes go through a change request (SCRUM-41, SCRUM-128).
6. An Approved venue booking isn't withdrawn here. It is cancelled only by resolving a flag (SCRUM-26) or by cancelling or rejecting the event (SCRUM-82, SCRUM-117).
7. Only the event's assigned Coordinator can do this (SCRUM-67). Technical Support or Venue Staff are notified (SCRUM-124).
8. Repeating the same change or withdrawal changes nothing further.

**Customer basis:** "Can Coordinator add/remove equipment line items anytime before confirmation? Yes, changes allowed; Technical Support Staff re-check suitability." "Co-ordinator can submit booking request based on per event that he is assigned. Each event can only has one venue."

**Why this is a new story:** SCRUM-27 (in review in Sprint 2) creates an equipment request but has no way to change it, and SCRUM-50 has no way to withdraw a pending venue request. With one venue per event, a wrong request would block a new one until Venue Staff reject it. Both are added here rather than re-scoping Sprint 2 stories.

**Change log**

* 2026-10-01 (audit): created for two gaps found in the audit: the customer-required line changes before confirmation, and withdrawing a pending venue request.

Functionality Area: Equipment Request Management, Venue Booking Request
