<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-09-13. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-77 - Withdraw my registration

| | |
|---|---|
| **Epic** | SCRUM-11 - Attendee Registration |
| **Priority** | Medium |
| **Story points** | 2 |
| **Status in Jira** | To Do |
| **Sprint** | Backlog |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-77 |

---

**As an Attendee**, I want to withdraw from an event I can no longer attend, so that my place is released and ConnectSphere has an accurate headcount.

**Acceptance Criteria:**

* Given an active registration, when the Attendee withdraws, then its status becomes withdrawn and it stops counting toward the event's registered total.
* Given an active registration, when the Attendee withdraws, then the event's remaining capacity increases by exactly one.
* Given a registration that has already been withdrawn, when the Attendee withdraws again, then nothing changes and no additional place is released.
* The withdrawal is visible to the Attendee immediately and to the Organiser and Coordinator in their registration view.
* An Attendee cannot withdraw another Attendee's registration.
* Whether a withdrawn Attendee may register again for the same event is governed by a stated rule rather than left implicit.

**Note:** the withdrawal record is kept rather than deleted, so the registration history for an event remains complete. This matters for the auditability NFR and for "Record who changed what and when" in the Access Control epic.

**Open question for the customer:** can an Attendee re-register after withdrawing? Is there a withdrawal deadline?

**Note (2026-09-07):** the repeat-withdrawal criterion was added following the Week 2 assignment feedback, which asked what happens when an action that creates or changes a record is performed twice. It matters here specifically because each withdrawal releases a place - repeating it would inflate remaining capacity.

**INVEST:** Independent (needs "Register for an event"; pairs with the capacity story's release path); Negotiable (re-registration rule, and whether a withdrawal deadline exists, are open); Valuable (named directly in core feature #18, and an inaccurate headcount costs ConnectSphere money on catering and seating); Estimable and Small (one status change, one counter); Testable (withdraw, assert status, capacity released, ownership enforced, repeat withdrawal is a no-op).

Functionality Area: Attendee Registration
