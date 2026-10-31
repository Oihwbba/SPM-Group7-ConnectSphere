<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-31. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-233 - Chore: Bring the seed in line with the event lifecycle: no event left in Approved, every event within one day

| | |
|---|---|
| **Type** | Task |
| **Epic** | - |
| **Priority** | Medium |
| **Story points** | - |
| **Status in Jira** | In Review |
| **Sprint** | SCRUM Sprint 4 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-233 |

---

## Why

The seed (`prisma/seed.ts`) breaks rules the stories and ADRs set, so a database built from it, which is what the graders rebuild and what `npm run db:seed` writes to the shared database, shows what can't happen. This was checked on a local database freshly seeded from `main` on 27 Oct 2026. **The shared Supabase database itself was not checked:** no working connection to it was available. It may also hold rows created through the app, which a seed fix doesn't change. Every fix below is a fix to `prisma/seed.ts`, and it reaches the shared database through `npm run db:seed`:

* `evt_approved` "Approved — Research Symposium" is stored as APPROVED. SCRUM-81 AC1 and SCRUM-135 AC12 say no event remains Approved, and approval saves Planning directly (ADR 0012). ADR 0012 kept this seeded event on purpose to demonstrate the Approved badge for SCRUM-23. The reviewer memory (`.github/ai-review/memory.md`) already records it as an event that can never be confirmed, resubmitted or reassigned.
* `evt_completed` "Completed — Hackathon" runs from 09:00 one day to 18:00 the next, which SCRUM-190 rules out.
* **"Approved" is still offered as a status filter** on All Events (`LISTED_STATUSES` in `app/(app)/all-events/queries.ts`) and My Events (`events-client.tsx`), although no event can reach it.
* **None of the five seeded Confirmed events could be confirmed** under SCRUM-110, SCRUM-135 AC7 and SCRUM-166. This was checked with `getReadinessChecklist` on a freshly seeded database:

    * There are no safety checks in the seed, so all five lack the Approved safety check that confirming requires.
    * `evt_full` and `evt_last_seat`: equipment is Not decided (no request, and no "No equipment needed").
    * `evt_reg_not_open` and `evt_reg_closed` have **no venue booking at all**, so `confirmedVenues` is empty and Attendees see no venue.
    * Those four also have no `submittedAt`, `decidedAt` or `decidedById`, so they were never approved.

* `evt_rejected` "Rejected — Overcapacity Concert" has no `coordinatorId`, but was rejected by `usr_coordinator`. SCRUM-135 AC4 says a request with no Coordinator can't be rejected.
* `evt_cancelled` "Cancelled — Winter Workshop":

    * It was cancelled by the Organiser (`cancelledById: usr_organiser`). SCRUM-82 AC1 says the assigned Coordinator cancels, and AC2 says the Organiser asks through a change request.
    * It has a registration (`reg_cancelled_1`), yet it was never approved or confirmed and its registration was never enabled. SCRUM-73 AC1 allows registration only on a Confirmed event with registration open.
    * Its laptop reservation (`res_cancelled`) has no equipment request. SCRUM-155 makes an approved request the only way to reserve.
    * Its period and its cancelled Seminar Room booking (`bkg_cancelled`) use `at(25, …)` rather than `weekdayFrom`, so they can fall on a weekend, when Seminar Room 2.1 is closed (SCRUM-34 AC7). Today's seed puts them on Saturday 21 Nov.

* **The seeded audit history contradicts ADR 0012 and the real actions:**

    * `aud_1` (Approved → Planning) names the Coordinator as actor. The system makes that move (actor null), and the Coordinator's own approval entry, which the real action also writes, is missing.
    * `aud_2` (Planning → Confirmed) has no actor, and its summary ("Venue booked and equipment reserved.") describes automatic confirmation, which ADR 0012 rejected. The real action records the confirming Coordinator.
    * `aud_3` shows a Coordinator reassigning an event. SCRUM-21 makes reassignment the Lead's action.

* **Smaller inconsistencies:**

    * The open clarification (`clr_career_fair`) asks about "a classroom layout", but the event's preferred layout is theatre.
    * The seeded non-draft events have no Venue Requirements, which submitting requires (SCRUM-13, SCRUM-14). A blank Registration needed is allowed for older requests (SCRUM-171 AC3).
    * The rejection notification `ntf_3` gives no reason or next step (SCRUM-45 AC3).


**Decision taken here:** the seed follows SCRUM-81 and SCRUM-135. This overrules ADR 0012's choice to keep the seeded Approved event. Approved remains visible in each event's history, which is where SCRUM-23's "approved" now appears.

## Done when

1. `evt_approved` is seeded as **Planning**, renamed (e.g. "Planning — Research Symposium"), with ADR 0012's two history entries (Approved by the Coordinator, then Approved → Planning). **The id is unchanged**: about 40 unit, integration and e2e tests use it. Tests that depend on its name or its APPROVED status are updated, and the equipment and reservation tests still pass now that it is Planning, which RESERVABLE_EVENT_STATUSES already accepts.
2. `evt_completed` falls within one Singapore day.
3. "Approved" is removed from the All Events and My Events status filters. Its label stays, because history entries still show it.
4. Every seeded Confirmed event passes `getReadinessChecklist`'s items, apart from the reservation reported after confirmation on the event item 15 names:

    * an Approved booking covering the event, including for `evt_reg_not_open` and `evt_reg_closed`;
    * equipment that is reserved, or recorded as "No equipment needed";
    * an Approved safety check;
    * its submission and approval recorded.

5. `evt_rejected` has the Coordinator who rejected it assigned.
6. `evt_cancelled`:

    * is cancelled by its assigned Coordinator;
    * was Confirmed with registration open before it was cancelled, so its registration could exist, or else the registration is removed;
    * its reservation comes from an approved equipment request;
    * its period and booking land on a weekday (`weekdayFrom`).

7. The seeded audit entries match what the actions write (ADR 0012), and the reassignment is by the Lead (SCRUM-21).
8. The clarification names the event's actual layout, the non-draft events have Venue Requirements, and `ntf_3` carries the reason and next step.
9. These docs are updated:

    * README: "one in each of the nine statuses", the seed tables, and the SCRUM-155 demo note that names the event
    * `docs/product-context.md`: "exactly nine statuses"
    * an ADR 0012 addendum
    * the reviewer memory lesson
    * `docs/testing/SCRUM-27.md`, `SCRUM-31.md` and `SCRUM-186.md`
    * `docs/demo.md`, if it names any changed event

10. Tests that count seeded rows still pass after the new safety checks, bookings and equipment rows; SCRUM-166, SCRUM-27, SCRUM-186 and SCRUM-110 suites may count them. `npm run test:coverage` and the full e2e suite pass on a freshly reset local database.
11. After merge, `npm run db:seed` is run on the shared database. It is an upsert, so no reset is needed; rows removed from the seed must be removed by hand or in a migration (`ntf_reservation_cancelled` is the one such row). A read-only query then confirms:

    * no APPROVED events;
    * no event spanning two Singapore days;
    * every Confirmed event passing readiness, apart from the reported reservation item 15 names.

12. remove APPROVED from REQUESTABLE_EVENT_STATUSES in lib/equipment/requests.ts once evt_approved is Planning (SCRUM-27 AC1).
13. Every seeded registration follows SCRUM-73, SCRUM-74 and SCRUM-75:

    * `evt_completed` "Completed — Hackathon" holds a registration (`reg_completed_1`) although its registration was never enabled. SCRUM-73 AC5 refuses registration that isn't open, and completing an event doesn't turn registration off, so it is seeded with registration enabled, and the registration falls after its confirmation and before its start.
    * No seeded event stores a registration capacity. SCRUM-74 makes the expected attendance the capacity, and the app neither reads nor writes `registrationCapacity`.
    * Only `evt_reg_not_open` has an opening time, because nothing else can show registration not yet open (SCRUM-75 AC1), and only `evt_reg_closed` has a closing time, which is what closing registration stores (SCRUM-75 AC6). Every other event uses the default: open on confirmation, closed at the start (SCRUM-75 AC4).
    * `evt_reg_not_open`'s opening time falls at least 30 days after its confirmation and before its start, so a database seeded weeks ago still shows registration not yet open.
    * A test checks every seeded registration was made while its event's registration was open, that no event stores a capacity, that only those two events have a window, and when the opening time falls.

14. Every seeded workflow value could have been written through the app:

    * every event that reached Confirmed, whatever became of it after (`evt_completed`, `evt_cancelled` and `evt_replanning` included), had a venue, its equipment settled and an Approved safety check, dated in the order the actions allow, and its history shows it (SCRUM-81 AC4, SCRUM-110, SCRUM-166 AC1);
    * `evt_replanning` shows the approved change that brought it back to Planning, so Reject isn't offered (SCRUM-117 AC4, SCRUM-128);
    * no seeded venue request is above its venue's capacity or its event's attendance (SCRUM-50 AC6, SCRUM-162 AC4);
    * assigned events record their supervising Lead (SCRUM-165, SCRUM-21), completed and cancelled events keep their confirmed details (SCRUM-85), and each row is dated before its own next step;
    * every submitted event has every compulsory answer (SCRUM-13, SCRUM-171), and histories and notifications read as the actions write them. `RESERVATION_CANCELLED` has no seeded row, because no action writes it, and TC-238-01 allows for that.


    Values only the seed can supply stay: the accounts, the equipment list and its unavailability, which nothing in the app creates, and `evt_reg_not_open`'s opening time (SCRUM-75 AC1).


15. The seed has a row for each state testers need to try by hand: a retired venue and equipment type (TC-13-02), a venue with setup and turnaround (SCRUM-159), a suitability judgement (SCRUM-40), an event at two venues (SCRUM-162), an event confirmed again with new details (SCRUM-85), a change waiting on a Confirmed event (SCRUM-128), a latest safety check Rejected (SCRUM-166), every optional answer filled in, overdue events in Under Review and Planning (SCRUM-82 AC10), an overdue event in Planning with its readiness checklist complete (SCRUM-82 AC10, SCRUM-110), a Confirmed event with a registration and a reservation Technical Support reported, flagged and the only incomplete item on its checklist (SCRUM-32, SCRUM-26 AC10, AC12), an event rejected from Planning (SCRUM-117), and a clarification answered on an event Under Review (SCRUM-18). Events are named `Status: Scenario — Event`.

## Depends on

SCRUM-190 (PR #300) must be merged first, for the one-day rule and its TC-190-11 handling of events already stored across two days.

## Change log

* 2026-10-30 (PR #321, PO approval pending): item 13 added after checking the seeded registration windows against SCRUM-73, SCRUM-74 and SCRUM-75.
* 2026-10-30 (PO approval pending): item 14 added after checking every seeded row against what the app's actions accept. The work moved from PR #321 to PR #329 with a cleaner history.
* 2026-10-30 (PR #329, PO approval pending): item 13 narrowed to what the app produces, so the seed stores no capacity and only the two windows it needs; item 15 added for the states testers need; item 11 names the one seeded row to delete by hand.
* 2026-10-31 (PR #329, PO approval pending): item 13 says when `evt_reg_not_open`'s opening time falls. Seeded a week after the seed ran, it stopped showing "Not open yet" on a database not seeded again within seven days.
* 2026-10-31 (PR #329, PO approval pending): item 15 adds an overdue event with its readiness checklist complete and a Confirmed event with a reported reservation; items 4 and 11 allow for that reservation.
