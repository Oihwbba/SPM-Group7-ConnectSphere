<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-05. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-156 - Make the one-type equipment form availability-only (follow-up to SCRUM-31 and SCRUM-155)

| | |
|---|---|
| **Type** | Story |
| **Epic** | SCRUM-10 - Equipment Management |
| **Priority** | Medium |
| **Story points** | 2 |
| **Status in Jira** | To Do |
| **Sprint** | SCRUM Sprint 2 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-156 |

---

**User story:** As a Technical Support Staff member, I want approved equipment requests to be the only way to reserve equipment, so that no stock is reserved for an event that never asked for it, or whose request was refused.

**Why:** review feedback on SCRUM-31 (4 Oct): "for equipment reservation, approved events should only come from decided event request". Today the one-type reserve form on Equipment can reserve for any Approved or Planning event, whether or not it has an approved equipment request. SCRUM-155 adds reserving from an approved request, but leaves the form able to reserve.

## Acceptance criteria

1. Given I open the one-type form on Equipment, then I can check availability for a period and an equipment type (SCRUM-29) and view an item's commitments (SCRUM-30) without choosing an event, and the form offers no way to reserve.
2. Given someone tries to reserve without going through an approved request, then the attempt is refused and nothing is reserved.
3. Given I want to reserve equipment for an event, then the Equipment page points me to SCRUM-155's "Reserve an approved request" card.
4. Given reservations made with the one-type form before this change, then they stay as they are and still count towards availability and the SCRUM-110 readiness checklist.

## Decisions

* **Option (b), PO, 2026-10-05:** the one-type form only checks availability, and SCRUM-155's approved-request card is the only way to reserve. This covers the original feedback by design and leaves a single way to reserve.

## Impact to plan for

* \*\*Depends on SCRUM-155 (#130) being merged first.\*\* Without the card, nobody could reserve at all.
* The seed needs an approved request on an Approved or Planning event. Today the only one belongs to the Confirmed event.
* About 20 SCRUM-29/30/31 e2e tests reserve through the form for "Approved — Research Symposium". They need rewriting to reserve through the card.

**Change log**

* 2026-10-04: written from the SCRUM-31 review feedback.

* 2026-10-05: PO chose option (b). Title, user story and ACs rewritten for an availability-only form; the decision section replaced.

**Related:** SCRUM-31 (reserve equipment), SCRUM-155 (reserve an approved request in one step), SCRUM-28 (approve a request), SCRUM-29/30 (availability and commitments).
