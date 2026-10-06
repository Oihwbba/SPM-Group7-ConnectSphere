<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-05. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-155 - Reserve an approved equipment request in one step, pre-filled from the Coordinator's request (follow-up to SCRUM-31)

| | |
|---|---|
| **Type** | Story |
| **Epic** | - |
| **Priority** | Medium |
| **Story points** | 3 |
| **Status in Jira** | In Review |
| **Sprint** | SCRUM Sprint 2 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-155 |

---

**User story:** As a Technical Support Staff member, I want to reserve everything on an equipment request I approved in one step, pre-filled from the Coordinator's request, so that what is reserved matches what was asked for and I don't re-type each item.

**Why:** review feedback on SCRUM-31 (4 Oct): today Technical Support reserves one equipment type at a time on a blank form, re-typing the event, period, type and quantity that are already on the approved request, and the reservation is not linked back to the request.

## Acceptance criteria

1. Given equipment requests I have approved for events that can still take a reservation (Approved or Planning) and have not started, when I open Equipment, then I can choose one of them to reserve. A request that is not Approved, or whose event is Confirmed or later or has already started, is not offered.
2. Given I choose an approved request, then the form is pre-filled with its event, the event's start and end as the reservation period, and one row per line of the request with its equipment type and quantity. It also shows who raised the request, the request's notes, and each line's technical requirements next to its row, with a link back to the request on Equipment requests. I can lengthen the period (for set-up or pack-down) as long as it still covers the whole event, change a row's type or quantity, remove a row, or add one before saving.
3. Given every row fits what is free for the whole period, when I reserve, then every row is reserved together: one Confirmed reservation per row, each linked to the event and to the request, and availability drops by exactly those quantities.
4. Given any row needs more than is free for any part of the period, when I reserve, then nothing is reserved, and each short row shows how many are free and how many it is short.
5. Given two Technical Support staff reserve at the same moment (the same request, or different requests needing the last units of a type), then the total reserved never exceeds the pool, and the same request is never reserved twice.
6. Given equipment is already reserved for the request's event, then the request is no longer offered, and reserving it again is refused.
7. Given a row has no type, a retired type, a quantity of zero or less or more than 1,000, or the same type as another row, or there are more than 20 rows, or the period ends before it starts, starts in the past, or doesn't cover the whole event, when I reserve, then nothing is reserved and the problem is reported where it is.

## Decisions

* **All or nothing (AC 4).** A Coordinator never gets a half-reserved request without being told; Technical Support adjusts the rows and tries again.
* **"Reserved" is judged by the event (AC 6), as the SCRUM-110 readiness checklist does, because reservations made with the one-type form (before SCRUM-156) are not linked to a request.** Once the one-type form stops reserving, SCRUM-156 AC 5 refines this to each line, so the rest of a request can still be reserved.
* **The period must cover the whole event (AC 2),** so the reservation counts towards the SCRUM-110 checklist.
* **What the Coordinator asked for is shown, not just pre-filled (AC 2),** so Technical Support can reserve without going back to the request.
* **The same limits as a request (AC 7):** at most 20 equipment types and 1,000 units a line, as on the Coordinator's request form (SCRUM-27).
* **This card will be the only way to reserve (SCRUM-156, option b).** This story adds the card; making the one-type form availability-only is SCRUM-156.
* Periods touching at an endpoint do not overlap, as in SCRUM-29/31.

**Change log**

* 2026-10-04: written from Felicia's placeholder and the SCRUM-31 review feedback.
* 2026-10-04 (review of PR #130): AC 1 excludes events that have already started; AC 2 requires the period to cover the whole event; AC 6 counts reservations made with the one-type form; AC 7 adds a retired type and an uncovered period.
* 2026-10-05 (PO decision on SCRUM-156): this card will be the only way to reserve, and SCRUM-156 makes the one-type form availability-only. AC 6 no longer mentions the one-type form.
* 2026-10-05 (PR #130): AC 2 also shows who raised the request, its notes and each line's technical requirements, with a link back to the request (team feedback: Technical Support had nothing to refer back to). AC 7 adds the 20-row and 1,000-unit limits (GLM review of #130).

**Related:** SCRUM-31 (reserve equipment), SCRUM-28 (review and approve a request), SCRUM-110 (the readiness checklist counts these reservations), SCRUM-142 (changing lines before confirmation), SCRUM-156 (make the one-type form availability-only).
