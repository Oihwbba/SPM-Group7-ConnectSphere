<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-11-01. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-262 - Bug: An event that already took place can still be cancelled or sent back to Planning, and All Events shows it as Confirmed

| | |
|---|---|
| **Type** | Task |
| **Epic** | - |
| **Priority** | High |
| **Story points** | - |
| **Status in Jira** | In Progress |
| **Sprint** | SCRUM Sprint 4 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-262 |

---

SCRUM-82 AC7 says a Confirmed event whose end has passed "shows as Completed everywhere from that moment … the status is saved the first time the event is read or changed after its end". ADR 0019 runs that completion only when the Events, event and My Registrations pages load. Found in a lifecycle audit on 1 Nov, and reproduced against a local database with a Confirmed event that ended two days earlier:

* Its Coordinator could still cancel it: the action returned OK and the event that took place is now **Cancelled**, never Completed.
* The Lead's **All Events** list showed it as **Confirmed**, so filtering by Completed misses it. All Events (SCRUM-141) was built after ADR 0019, whose "nothing reads it in between" no longer holds.
* By reading the code, resolving a flagged arrangement (SCRUM-26) and approving an impactful change request (SCRUM-128) can likewise send a finished event back to Planning: neither checks the end time.

**Acceptance criteria**

1. Given a Confirmed event whose end has passed, when its Coordinator cancels it, then the event is saved as Completed (if it wasn't yet) and the cancellation is refused with "The event has already taken place."; nothing else changes.
2. The same holds for every other action that changes a Confirmed event's status: resolving a flagged booking or reservation (SCRUM-26) and deciding a change request (SCRUM-128). A finished event never returns to Planning or becomes Cancelled.
3. The check is made under the event-row lock, so an event that ends while an action waits is still refused.
4. At exactly its end time the event is still Confirmed and can be cancelled (SCRUM-82 AC7's boundary).
5. The Lead's All Events list and its event view show a finished Confirmed event as Completed, and filtering by Completed includes it.
6. Unit and integration tests cover each action and All Events; ADR 0019 says which pages complete events and that actions refuse a finished event.

**Related:** SCRUM-82 (closing an event), SCRUM-141 (All Events), SCRUM-249 (overdue events can't be approved or confirmed), ADR 0019.
