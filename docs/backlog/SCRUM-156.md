<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-20. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-156 - Make the one-type equipment form availability-only (follow-up to SCRUM-31 and SCRUM-155)

| | |
|---|---|
| **Type** | Story |
| **Epic** | SCRUM-10 - Equipment Management |
| **Priority** | Medium |
| **Story points** | 2 |
| **Status in Jira** | Done |
| **Sprint** | SCRUM Sprint 2 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-156 |

---

**User story:** As a Technical Support Staff member, I want approved equipment requests to be the only way to reserve equipment, so that no stock is reserved for an event that never asked for it, or whose request was refused.

**Why:** review feedback on SCRUM-31 (4 Oct): "for equipment reservation, approved events should only come from decided event request". Today the one-type reserve form on Equipment can reserve for any Approved or Planning event, whether or not it has an approved equipment request. SCRUM-155 adds reserving from an approved request, but leaves the form able to reserve.

## Acceptance criteria

1. Given I open the one-type form on Equipment, then I can check availability for a period and an equipment type (SCRUM-29) and view an item's commitments (SCRUM-30) without choosing an event, and the form offers no way to reserve.
2. Given someone tries to reserve without going through an approved request, then the attempt is refused and nothing is reserved.
3. Given I want to reserve equipment for an event, then the Equipment page points me to SCRUM-155's "Reserve an approved request" card, which is at the top, with checking availability below it.
4. Given reservations made with the one-type form before this change, then they stay as they are and still count towards availability and the SCRUM-110 readiness checklist.
5. Given an approved request whose lines are only partly reserved (a line's reservation was cancelled, as changing a line does under SCRUM-142), or a second approved request for an event that already has reservations, then it is offered with only what is still missing, marked as partly reserved, and can be reserved. A line counts as reserved only by confirmed reservations made for that request, or made with the one-type form before this change, that span the whole event; reservations for another request don't count.
6. Given I reserve a request in the card, then the availability check and the item's commitments below it show the new reservation without a reload.

## Decisions

* **Option (b), PO, 2026-10-05:** the one-type form only checks availability, and SCRUM-155's approved-request card is the only way to reserve. This covers the original feedback by design and leaves a single way to reserve.
* **"Reserved" is judged per line (AC 5),** refining SCRUM-155 AC 6. With the one-type form gone, judging by the event would leave a second request, or a changed line, with no way to be reserved.
* **The seed is unchanged.** SCRUM-27's tests rely on "Approved — Research Symposium" having no request; to demo reserving, approve the pending "Planning — Freshman Orientation" request in the queue first.

## Impact to plan for

* **Depends on SCRUM-155 (#130) being merged first.** Without the card, nobody could reserve at all.
* The SCRUM-29/30/31 tests that reserved through the form now reserve through the card or check availability only (PR #135).

**Change log**

* 2026-10-04: written from the SCRUM-31 review feedback.
* 2026-10-05: PO chose option (b). Title, user story and ACs rewritten for an availability-only form; the decision section replaced.
* 2026-10-05 (PR #135): AC 3 places the request card at the top and checking availability below it (team feedback). AC 5 added: reserve the rest of a partly reserved request, or a second request for the same event, which option (b) would otherwise block. AC 6 added: the availability check refreshes after reserving. Seed decision recorded.
* 2026-10-16 (PO decision): AC 5's "second approved request" case is withdrawn by SCRUM-186: an event has one active equipment request, and more equipment is added by changing its lines (SCRUM-142), which didn't exist on 5 Oct. AC 5 still covers a partly reserved request. This story stays Done; the change is built and tested under SCRUM-186.

**Related:** SCRUM-31 (reserve equipment), SCRUM-155 (reserve an approved request in one step), SCRUM-28 (approve a request), SCRUM-29/30 (availability and commitments), SCRUM-142 (changing lines before confirmation), SCRUM-186 (one active equipment request per event).
