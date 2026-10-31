# SCRUM-233 — Bring the seed in line with the event lifecycle: test cases

SCRUM-233 is a Chore task in Jira. The seed (`prisma/seed.ts`) showed what the
stories rule out: an event resting in Approved, Confirmed events that could
never have been confirmed, a rejection by nobody's Coordinator, an event
cancelled by its Organiser, and history entries the actions never write.

Format and conventions: [README.md](README.md).

**Shared pre-conditions:** a local PostgreSQL migrated with `npm run db:deploy`
and seeded with `npm run db:seed`, as in CI's `build-and-test`. The
integration cases read only rows with the seed's fixed ids (`evt_`, `aud_`,
`eqr_`, …), so suites writing alongside them don't change the result.

| ID | Type | Criterion | Automated |
|---|---|---|---|
| [TC-233-01](#tc-233-01) | Positive, Negative | AC 1 | Integration |
| [TC-233-02](#tc-233-02) | Boundary | AC 2 | Integration |
| [TC-233-03](#tc-233-03) | Positive, Negative | AC 3 | Unit, e2e |
| [TC-233-04](#tc-233-04) | Positive | AC 4 | Integration |
| [TC-233-05](#tc-233-05) | Positive | AC 5 | Integration |
| [TC-233-06](#tc-233-06) | Positive | AC 6 | Integration |
| [TC-233-07](#tc-233-07) | Positive | AC 7 | Integration |
| [TC-233-08](#tc-233-08) | Positive | AC 8 | Integration |
| [TC-233-09](#tc-233-09) | Positive | AC 9 | Manual (a document check) |
| [TC-233-10](#tc-233-10) | Positive | AC 10 | The whole suite, on a freshly reset local database and in CI |
| [TC-233-11](#tc-233-11) | Positive | AC 11 | Manual (the shared database, after the merge) |
| [TC-233-12](#tc-233-12) | Negative | AC 12 | Unit |
| [TC-233-13](#tc-233-13) | Positive, Negative | AC 13 | Integration |
| [TC-233-14](#tc-233-14) | Positive | AC 4, AC 6, AC 7 | Integration |
| [TC-233-15](#tc-233-15) | Positive | AC 14 | Integration |
| [TC-233-16](#tc-233-16) | Positive, Negative | AC 7, AC 14 | Integration |
| [TC-233-17](#tc-233-17) | Boundary | AC 14 | Integration |
| [TC-233-18](#tc-233-18) | Positive | AC 14 | Integration |
| [TC-233-19](#tc-233-19) | Positive | AC 14 | Integration |
| [TC-233-20](#tc-233-20) | Positive | AC 15 | Integration |
| [TC-233-21](#tc-233-21) | Positive | AC 15 | Integration |
| [TC-233-22](#tc-233-22) | Positive | AC 4, AC 15 | Integration |
| [TC-233-23](#tc-233-23) | Positive | AC 11 | Integration |
| [TC-233-24](#tc-233-24) | Negative | AC 11 | Integration |
| [TC-233-25](#tc-233-25) | Positive | AC 11 | Integration |
| [TC-233-26](#tc-233-26) | Positive | AC 14 | Integration |
| [TC-233-27](#tc-233-27) | Positive | AC 14 | Integration |
| [TC-233-28](#tc-233-28) | Boundary | AC 14 | Integration |

---

### TC-233-01

| Item | Content |
|---|---|
| Test Case ID | TC-233-01 |
| Test Scenario | [Positive, Negative] AC 1: no seeded event is Approved; `evt_approved` keeps its id as "Planning: Venue Booked — Research Symposium", with ADR 0012's two history entries |
| Pre-conditions | Freshly seeded. |
| Test Steps | 1. Count seeded events in Approved. <br> 2. Read `evt_approved`. <br> 3. Read its seeded history, oldest first. |
| Test Data | `evt_approved` |
| Expected Result | 1. None. 2. Named "Planning: Venue Booked — Research Symposium", status Planning, approved by `usr_coordinator`. 3. Under Review → Approved by `usr_coordinator`, then Approved → Planning with no actor and the summary "Moved to Planning on approval (SCRUM-81)". |

**Automated by:** `tests/integration/seed-lifecycle.test.ts` › "SCRUM-233 [AC1] TC-233-01: no seeded event is Approved; the Research Symposium is Planning, with its approval and its move to Planning in its history"

### TC-233-02

| Item | Content |
|---|---|
| Test Case ID | TC-233-02 |
| Test Scenario | [Boundary] AC 2: every seeded event with a period starts and ends on the same Singapore day (SCRUM-190) |
| Pre-conditions | Freshly seeded. |
| Test Steps | 1. For every seeded event with a start and an end, apply SCRUM-190's rule (`eventPeriodError`). |
| Test Data | Includes `evt_completed` "Completed: Took Place — Hackathon" |
| Expected Result | No event is refused. `evt_completed` runs 09:00–18:00 Singapore time on one day. |

**Automated by:** `tests/integration/seed-lifecycle.test.ts` › "SCRUM-233 [AC2] TC-233-02: every seeded event with a period starts and ends on the same Singapore day, the Hackathon included"

### TC-233-03

| Item | Content |
|---|---|
| Test Case ID | TC-233-03 |
| Test Scenario | [Positive, Negative] AC 3: neither status filter offers Approved; both still offer Planning |
| Pre-conditions | Freshly seeded. |
| Test Steps | 1. As `organiser@test.local`, open **My Events** and open **Filter by status**. <br> 2. As `coordinator@test.local`, open **All Events** and open **Status**. <br> 3. Open `/all-events?status=APPROVED`. |
| Test Data | `Password123!` |
| Expected Result | 1, 2. Planning is offered; Approved is not. 3. The filter is ignored, as for any malformed value. A history entry still shows "Approved", since the label stays. |

**Automated by:** `tests/unit/all-events.test.ts` › "SCRUM-233 [AC3] TC-233-03: offers every status an event can rest in, and not Approved, which approval never leaves an event in"; `e2e/seed-lifecycle.spec.ts` › "SCRUM-233 [AC3] TC-233-03: My Events and All Events don't offer Approved, and still offer Planning"; `e2e/status-names.spec.ts` › "SCRUM-131 [AC1] TC-131-01: the Organiser's tab of every request that isn't a draft reads Sent, and the status filter offers the agreed names an event can rest in"

### TC-233-04

| Item | Content |
|---|---|
| Test Case ID | TC-233-04 |
| Test Scenario | [Positive] AC 4: every seeded Confirmed event passes the readiness checklist's items, apart from the one reported reservation AC 15 names, with its submission and approval recorded |
| Pre-conditions | Freshly seeded. |
| Test Steps | 1. List the seeded Confirmed events. <br> 2. For each, run `getReadinessChecklist` and read `submittedAt`, `decidedAt`, `decidedById` and `confirmedVenues`. |
| Test Data | `evt_confirmed`, `evt_full`, `evt_last_seat`, `evt_reg_not_open`, `evt_reg_closed`, SCRUM-238's `evt_cancellation_requested` and `evt_no_registration`, and `evt_two_venues`, `evt_reconfirmed`, `evt_change_pending` and `evt_reservation_reported` |
| Expected Result | Exactly those eleven. Each has Venue booking Approved, Equipment Reserved or No equipment needed, and Safety check Approved, except that `evt_reservation_reported`'s Equipment is left incomplete by its flagged reservation (SCRUM-26 AC 12); each was submitted and approved by `usr_coordinator`; each shows Attendees at least one venue. |

**Automated by:** `tests/integration/seed-lifecycle.test.ts` › "SCRUM-233 [AC4] TC-233-04: every seeded Confirmed event has a covering approved venue, its equipment settled, an Approved safety check, and its submission and approval recorded"

### TC-233-05

| Item | Content |
|---|---|
| Test Case ID | TC-233-05 |
| Test Scenario | [Positive] AC 5: a seeded rejection was made by the Coordinator assigned to the request (SCRUM-135 AC 4) |
| Pre-conditions | Freshly seeded. |
| Test Steps | 1. For each seeded Rejected event, compare `coordinatorId` with `decidedById`. |
| Test Data | `evt_rejected`, and SCRUM-238's `evt_rejected_new_request` |
| Expected Result | Each has a Coordinator, and it is the one who rejected it. |

**Automated by:** `tests/integration/seed-lifecycle.test.ts` › "SCRUM-233 [AC5] TC-233-05: a seeded rejection was made by the Coordinator assigned to the request"

### TC-233-06

| Item | Content |
|---|---|
| Test Case ID | TC-233-06 |
| Test Scenario | [Positive] AC 6: the cancelled event could have reached its state: confirmed with registration open, cancelled by its Coordinator, on a weekday, its reservation from an approved request |
| Pre-conditions | Freshly seeded. |
| Test Steps | 1. Read `evt_cancelled`, its registration, booking, reservation and the reservation's request history. <br> 2. Read its seeded history. |
| Test Data | `evt_cancelled` "Cancelled: After Confirmation — Winter Workshop" |
| Expected Result | 1. Cancelled by its Coordinator; approved by `usr_coordinator`; registration enabled and the registration made after it opened; the event and its Seminar Room booking start on a Singapore weekday; the booking was decided by Venue Staff; the reservation's request was Approved (and then cancelled with the event). 2. Confirmed → Cancelled by `usr_coordinator`. |

**Automated by:** `tests/integration/seed-lifecycle.test.ts` › "SCRUM-233 [AC6] TC-233-06: the cancelled event was confirmed with registration open, cancelled by its Coordinator, on a weekday, and its reservation came from an approved request"

### TC-233-07

| Item | Content |
|---|---|
| Test Case ID | TC-233-07 |
| Test Scenario | [Positive] AC 7: the seeded history matches what the actions write (ADR 0012, SCRUM-21) |
| Pre-conditions | Freshly seeded. |
| Test Steps | 1. Read the seeded event history entries (`aud_`). <br> 2. For each event that reached Confirmed, read its status history, booking and safety check. |
| Test Data | — |
| Expected Result | Every Approved → Planning entry has no actor and follows the Coordinator's approval of the same event; every → Confirmed entry names the event's assigned Coordinator; each of `evt_confirmed`, `evt_full`, `evt_last_seat`, `evt_reg_not_open`, `evt_reg_closed` and `evt_cancelled` shows Under Review → Approved → Planning → Confirmed, confirmed after its booking and safety check were approved; `evt_completed` shows Under Review → Approved → Planning → Confirmed → Completed, the last with no actor at its `completedAt`, and TC-233-15 checks its arrangements; every reassignment is by a user holding the Lead role, after the request was submitted. |

**Automated by:** `tests/integration/seed-lifecycle.test.ts` › "SCRUM-233 [AC7] TC-233-07: seeded history matches the actions: the system moves an event to Planning, the assigned Coordinator confirms it, and a Lead reassigns it"

### TC-233-08

| Item | Content |
|---|---|
| Test Case ID | TC-233-08 |
| Test Scenario | [Positive] AC 8: the clarification names the event's layout; submitted events have Venue Requirements; the rejection notice has the reason and next step |
| Pre-conditions | Freshly seeded. |
| Test Steps | 1. Read `clr_career_fair` and its event's preferred layout. <br> 2. List seeded non-draft events without Venue Requirements. <br> 3. Read `ntf_3` and `evt_rejected`'s reason. |
| Test Data | — |
| Expected Result | 1. The layout is Theatre, and the question says "theatre layout", not classroom. 2. None. 3. The notice contains the reason and "What you can do next: Amend and resubmit.", as `transitionEventStatus` words it (SCRUM-45 AC 3). |

**Automated by:** `tests/integration/seed-lifecycle.test.ts` › "SCRUM-233 [AC8] TC-233-08: the clarification names the event's own layout, every submitted event has Venue Requirements, and the rejection notice gives the reason and the next step"

### TC-233-09

| Item | Content |
|---|---|
| Test Case ID | TC-233-09 |
| Test Scenario | [Positive] AC 9: the docs describe the seed as it now is |
| Pre-conditions | — |
| Test Steps | 1. Read the README's seed section and its SCRUM-155 demo note. <br> 2. Read `docs/product-context.md`'s status paragraph, ADR 0012's 2026-10-29 addendum and the reviewer memory's Approved lesson. <br> 3. Read `docs/testing/SCRUM-27.md`, `SCRUM-31.md` and `SCRUM-186.md`. <br> 4. Search `docs/demo.md` and `docs/testing/` for the changed events' old names and details. |
| Test Data | — |
| Expected Result | 1–3. None calls `evt_approved` Approved or says every status has a seeded event; each says why Approved has none. 4. Every seeded event is named as it now is, and each result that lists the seeded venues includes the Black Box Studio. |

**Automated by:** Manual (a document check).

### TC-233-10

| Item | Content |
|---|---|
| Test Case ID | TC-233-10 |
| Test Scenario | [Positive] AC 10: the suites that count or use seeded rows still pass with the new safety checks, bookings and equipment rows |
| Pre-conditions | A local database reset with `npm run db:reset`. |
| Test Steps | 1. Run `npm run test:coverage`. <br> 2. Run `npm run test:e2e`. |
| Test Data | — |
| Expected Result | Both pass, including SCRUM-166's, SCRUM-27's, SCRUM-186's, SCRUM-110's and SCRUM-238's suites. |

**Automated by:** the whole suite, run on a freshly reset local database and by CI's `build-and-test`.

### TC-233-11

| Item | Content |
|---|---|
| Test Case ID | TC-233-11 |
| Test Scenario | [Positive] AC 11: after the merge, the shared database follows the lifecycle |
| Pre-conditions | Merged. |
| Test Steps | 1. Run `npm run db:seed` on the shared database. <br> 2. Run read-only queries for every Approved event, seeded or not, events spanning two Singapore days, and each Confirmed event's readiness. |
| Test Data | — |
| Expected Result | No seeded event is Approved, none spans two days, and every seeded Confirmed event passes readiness, apart from `evt_reservation_reported`'s flagged reservation. The seed no longer has `ntf_reservation_cancelled`, so delete that one row by hand; it removes no other. Rows created through the app are reported, not changed: in particular, any event left Approved from before approval saved Planning (#120) is counted and listed for the PO, since it can no longer take an equipment request or reservation or be found by a status filter; it can still be cancelled (SCRUM-135 AC 9). |

**Automated by:** Manual (the shared database, after the merge).

### TC-233-12

| Item | Content |
|---|---|
| Test Case ID | TC-233-12 |
| Test Scenario | [Negative] AC 12: equipment can't be requested, or offered, for an event left in Approved (SCRUM-27 AC 1) |
| Pre-conditions | Signed in as the event's Coordinator. |
| Test Steps | 1. Read `REQUESTABLE_EVENT_STATUSES`. <br> 2. Submit a request for an event stored as Approved. <br> 3. Open the Equipment section of an Approved event's page. |
| Test Data | An event with status APPROVED |
| Expected Result | 1. Planning only. 2. Refused with "Choose one of your approved events."; nothing is written. 3. Request equipment isn't offered. |

**Automated by:** `tests/unit/equipment-request-queries.test.ts` › "SCRUM-27 [AC1] TC-27-01: treats only planning events as ones equipment can be requested for"; `tests/unit/equipment-request.test.ts` › "SCRUM-27 [AC1] TC-27-02: refuses %s with the same message, and saves nothing" (an event left in Approved); `tests/unit/readiness-actions.test.ts` › "SCRUM-209 [AC2, AC4] TC-209-03: at $status, a new request offered is $offered (SCRUM-27's own rule)" (APPROVED, false)

### TC-233-13

| Item | Content |
|---|---|
| Test Case ID | TC-233-13 |
| Test Scenario | [Positive, Negative] AC 13: every seeded registration was taken while its event's registration was open, and only the state that needs one has a window (SCRUM-73, SCRUM-74, SCRUM-75) |
| Pre-conditions | Freshly seeded. |
| Test Steps | 1. For each seeded registration (`reg_`), compare when it was made with its event's registration: enabled, its confirmation, the opening and closing times, and the start. <br> 2. Count seeded events with a capacity, and list those with a window. |
| Test Data | Includes `reg_completed_1` on `evt_completed` "Completed: Took Place — Hackathon", and `evt_confirmed` "Confirmed: Registration Open — Charity Gala" |
| Expected Result | 1. Every registration was made with registration enabled, at or after the confirmation (SCRUM-75 AC 2) and any opening time, before any closing time and before the start. 2. None has a capacity, since the expected attendance is the capacity (SCRUM-74). Only `evt_reg_not_open`, the one state that needs a later opening, and `evt_reg_closed`, closed by its Coordinator, have a window. `evt_reg_not_open` opens at least 30 days after its confirmation, so it stays not open long after a seed, and before its start. Before the fix the test named `reg_completed_1`, and the opening time fell about 12 days after the confirmation, 7 days after the seed. |

**Automated by:** `tests/integration/seed-lifecycle.test.ts` › "SCRUM-233 [AC13] TC-233-13: every seeded registration was taken while its event's registration was open, and only the state that needs one has a window"

### TC-233-14

| Item | Content |
|---|---|
| Test Case ID | TC-233-14 |
| Test Scenario | [Positive] AC 4, AC 6, AC 7: the seed as users see it: an Attendee sees a venue for every Confirmed event, the cancellation notices give the reason, and the cancelled event's progress stops at Confirmed |
| Pre-conditions | Freshly seeded. |
| Test Steps | 1. As `usr_attendee`, open each seeded Confirmed event through `getBrowsableEvent`, the attendee pages' read. <br> 2. Read the notices about `evt_cancelled`'s cancellation. <br> 3. As `usr_coordinator`, read `evt_cancelled`'s page data, which the progress bar uses. |
| Test Data | `evt_reg_not_open`, `evt_reg_closed`, `ntf_6`, `ntf_cancelled_organiser`, `ntf_cancelled_coordinator`, `evt_cancelled` |
| Expected Result | 1. Every event the Attendee can open, `evt_reg_not_open` and `evt_reg_closed` among them, has an approved booking, so no page says "Venue to be confirmed". An event that takes no registration isn't opened (SCRUM-171 AC 4). 2. The three `cancelInTransaction` sends: "Event cancelled" to `usr_organiser` and to `usr_coordinator`, who cancelled it, and "An event you registered for was cancelled" to `usr_attendee`, each reading `"Cancelled: After Confirmation — Winter Workshop" was cancelled: Speaker withdrew and no replacement was available.` 3. Cancelled from Confirmed. With `bkg_reg_closed` pending, `ntf_6`'s old wording, `ntf_cancelled_organiser` deleted, or `aud_cancelled_status` deleted, the test failed. |

**Automated by:** `tests/integration/seed-lifecycle.test.ts` › "SCRUM-233 [AC4, AC6, AC7] TC-233-14: what users see of the seed: an Attendee sees a venue for every Confirmed event, the cancellation notices give the reason, and the cancelled event's progress stops at Confirmed"

### TC-233-15

| Item | Content |
|---|---|
| Test Case ID | TC-233-15 |
| Test Scenario | [Positive] AC 14: every event that reached Confirmed, whatever became of it after, had its venue, equipment and safety check settled in the order the actions allow (SCRUM-50, SCRUM-81 AC 4, SCRUM-110, SCRUM-166 AC 1) |
| Pre-conditions | Freshly seeded. |
| Test Steps | 1. For each event that reached Confirmed, read its status history, bookings, equipment requests, reservations, "No equipment needed" and decided safety check. |
| Test Data | `evt_confirmed`, `evt_full`, `evt_last_seat`, `evt_reg_not_open`, `evt_reg_closed`, `evt_cancellation_requested`, `evt_no_registration`, `evt_two_venues`, `evt_reconfirmed`, `evt_change_pending`, `evt_cancelled`, `evt_completed`, `evt_replanning` |
| Expected Result | Each shows Under Review → Approved → Planning → Confirmed and has a venue, settled equipment and one decided safety check. Each booking was decided after the move to Planning; the safety check was requested after every booking decision, equipment decision, reservation and "No equipment needed", and decided before the confirmation. `bkg_replanning` and `bkg_reconfirmed`, booked after their events came back, are the exceptions, and a re-confirmed event is judged by its first check. Before the fix the test failed on `evt_confirmed`, requested before its equipment was approved. |

**Automated by:** `tests/integration/seed-lifecycle.test.ts` › "SCRUM-233 [AC14] TC-233-15: every event that reached Confirmed had its venue, equipment and safety check settled in the order the actions allow"

### TC-233-16

| Item | Content |
|---|---|
| Test Case ID | TC-233-16 |
| Test Scenario | [Positive, Negative] AC 7, AC 14: the re-planned event shows how it came back to Planning, and Reject isn't offered, since it was Confirmed (SCRUM-117 AC 4, SCRUM-128, SCRUM-166 AC 13) |
| Pre-conditions | Freshly seeded. |
| Test Steps | 1. Read `evt_replanning`'s status history. <br> 2. Read its change request. <br> 3. As `usr_coordinator`, read its readiness through `getEventReadiness`. |
| Test Data | `evt_replanning` "Planning: Back From Confirmed — Jazz Night" |
| Expected Result | 1. Under Review → Approved → Planning → Confirmed → Planning. 2. An approved change with the start and end as major fields. 3. Reject isn't offered, and Safety check reads Outdated. |

**Automated by:** `tests/integration/seed-lifecycle.test.ts` › "SCRUM-233 [AC7, AC14] TC-233-16: the re-planned event shows how it came back to Planning, and Reject isn't offered, since it was Confirmed"

### TC-233-17

| Item | Content |
|---|---|
| Test Case ID | TC-233-17 |
| Test Scenario | [Boundary] AC 14: no seeded venue request is above its venue's capacity or its event's attendance (SCRUM-50 AC 6, SCRUM-162 AC 4) |
| Pre-conditions | Freshly seeded. |
| Test Steps | 1. For each seeded booking (`bkg_`), compare the requested attendance with its venue's capacity and its event's expected attendance. |
| Test Data | Includes `bkg_rejected` |
| Expected Result | None is above either; equal to a limit fits. Before the fix the test named `bkg_rejected`, 55 in the 14-seat Boardroom. |

**Automated by:** `tests/integration/seed-lifecycle.test.ts` › "SCRUM-233 [AC14] TC-233-17: no seeded venue request is above its venue's capacity or its event's attendance"

### TC-233-18

| Item | Content |
|---|---|
| Test Case ID | TC-233-18 |
| Test Scenario | [Positive] AC 14: every seeded row was created before its own next step, assigned events have their Lead, and confirmed details are kept (SCRUM-165, SCRUM-21, SCRUM-85) |
| Pre-conditions | Freshly seeded. |
| Test Steps | 1. Compare each seeded event, booking, equipment request, reservation, registration and change request's `createdAt` with its next step. <br> 2. List seeded events with a Coordinator and no supervising Lead. <br> 3. Read `evt_completed` and `evt_cancelled`'s confirmed details. |
| Test Data | — |
| Expected Result | 1. None was created after its next step, and an equipment request's history up to its decision is dated before that decision. 2. None. 3. Both keep a confirmed start and at least one venue. |

**Automated by:** `tests/integration/seed-lifecycle.test.ts` › "SCRUM-233 [AC14] TC-233-18: every seeded row was created before its own next step, assigned events have their Lead, and confirmed details are kept"

### TC-233-19

| Item | Content |
|---|---|
| Test Case ID | TC-233-19 |
| Test Scenario | [Positive] AC 14: every submitted event has every compulsory answer, its assignment and every equipment request's submission are recorded, and the reservation Technical Support reported reads as the report writes it (SCRUM-13, SCRUM-171, SCRUM-165, SCRUM-28 AC 6, SCRUM-32) |
| Pre-conditions | Freshly seeded. |
| Test Steps | 1. For each seeded event with a submission, read the fields the request form requires. <br> 2. For each with a Coordinator, look for its Assigned entry. <br> 3. Read the first entry of each equipment request's history. <br> 4. Read `res_flagged_mic`, its history and the event's flag notices. |
| Test Data | — |
| Expected Result | 1. None is blank, Registration needed included. 2. Each has one. 3. Each reads "Request submitted." 4. It is still Confirmed, flagged "Technical Support can no longer provide it: …" before `chg_flagged_approved` was decided, and keeps that reason, while `bkg_flagged` shows the change's. The report is recorded with Technical Support as its actor, at the time it was flagged. The Coordinator has two notices, one for the report and one for the change, and Technical Support has one for the report. |

**Automated by:** `tests/integration/seed-lifecycle.test.ts` › "SCRUM-233 [AC14] TC-233-19: every submitted event has every compulsory answer, and its assignment and every equipment request's submission are recorded" and "SCRUM-233 [AC14] TC-233-19: the reservation Technical Support reported reads as the report writes it, and keeps that reason after the change approved later"

### TC-233-20

| Item | Content |
|---|---|
| Test Case ID | TC-233-20 |
| Test Scenario | [Positive] AC 15: a seeded row shows each state a story can reach, so it can be tried by hand |
| Pre-conditions | Freshly seeded. |
| Test Steps | 1. Read the retired venue and equipment type, the Black Box Studio's booking and the suitability judgement. <br> 2. Read each scenario event. |
| Test Data | `evt_two_venues`, `evt_reconfirmed`, `evt_change_pending`, `evt_safety_rejected`, `evt_every_answer`, `evt_overdue_review`, `evt_overdue_planning`, `evt_rejected_from_planning`, `evt_clarification_answered` |
| Expected Result | 1. One retired of each; the booking keeps its venue's 30 and 45 minutes; one judgement. 2. Two venues shown to Attendees; confirmed again with its Attendee told; a change waiting on a Confirmed event, which raises the attendance without going above Black Box Studio's 100 seats; the latest safety check Rejected with its booking flagged; every optional answer filled in; overdue in Under Review and in Planning; rejected from Planning with its booking released; a clarification answered and waiting. |

**Automated by:** `tests/integration/seed-lifecycle.test.ts` › "SCRUM-233 [AC15] TC-233-20: a seeded row shows each state a story can reach, so it can be tried by hand"

### TC-233-21

| Item | Content |
|---|---|
| Test Case ID | TC-233-21 |
| Test Scenario | [Positive] AC 15: an overdue Planning event has every readiness item complete, which the other overdue Planning event doesn't (SCRUM-82 AC 10, SCRUM-110) |
| Pre-conditions | Freshly seeded. |
| Test Steps | 1. Read `evt_overdue_ready`'s status and start. <br> 2. Run `getReadinessChecklist` on it and on `evt_overdue_planning`. |
| Test Data | `evt_overdue_ready` "Planning: Overdue, Checklist Complete — Library Open Day", `evt_overdue_planning` |
| Expected Result | 1. Planning, with a start in the past. 2. `evt_overdue_ready` has no incomplete item; `evt_overdue_planning` has Venue booking, Equipment and Safety check incomplete. |

**Automated by:** `tests/integration/seed-lifecycle.test.ts` › "SCRUM-233 [AC15] TC-233-21: an overdue Planning event has every readiness item complete, which the other overdue Planning event doesn't"

### TC-233-22

| Item | Content |
|---|---|
| Test Case ID | TC-233-22 |
| Test Scenario | [Positive] AC 4, AC 15: the Confirmed event's reported reservation reads as the report writes it, and leaves the event, its safety check and its registration as they were (SCRUM-32 AC 1, AC 5; SCRUM-26 AC 2, AC 10, AC 13; SCRUM-124 AC 8) |
| Pre-conditions | Freshly seeded. |
| Test Steps | 1. Read `evt_reservation_reported` with its reservation, safety check and registration. <br> 2. Read its status history. <br> 3. Read the Reported entry in the history of `res_reported_projector`. <br> 4. Read the event's Arrangement flagged notices. |
| Test Data | `evt_reservation_reported` "Confirmed: Reservation Reported — Film Screening" |
| Expected Result | 1. The event is Confirmed; the reservation is Confirmed and flagged "Technical Support can no longer provide it: The reserved projector failed its lamp test."; the safety check is Approved; the registration is Registered. 2. Approved, Planning, Confirmed, and no return to Planning. 3. One entry by `usr_techsupport` with the report, at the moment it was flagged, after confirmation. 4. One to the Coordinator and one to Technical Support, each ending with the reason. |

**Automated by:** `tests/integration/seed-lifecycle.test.ts` › "SCRUM-233 [AC4, AC15] TC-233-22: the Confirmed event's reported reservation reads as the report writes it, and leaves the event, its safety check and its registration as they were"

### TC-233-23

| Item | Content |
|---|---|
| Test Case ID | TC-233-23 |
| Test Scenario | [Positive] AC 11: `npm run db:seed` runs over a database seeded days ago, restores what has passed, and leaves rows made through the app |
| Pre-conditions | An empty, migrated throwaway local database. `SEED_TODAY` stands in for today. |
| Test Steps | 1. Seed as of 28, 26 and 21 days ago. <br> 2. Complete the events that had finished 11 days ago. <br> 3. Seed as of 12 days ago. <br> 4. Add a booking and an unavailability period through no seeded id, 200 days out. <br> 5. Seed as of today. |
| Test Data | Gaps of 2, 5, 9 and 12 days, each of which clashed before the fix |
| Expected Result | Every run succeeds. `bkg_confirmed` is Approved 10 days from today, `bkg_pending` is Pending and `bkg_held` is Held. `evt_reg_closed` is Confirmed again, with no completion time. `evt_completed` stays Completed. `res_confirmed_projector` was created after its request's decision, as moved by this run. The five seeded unavailability periods exist once each, at today's dates. The two added rows are unchanged. |

**Automated by:** `tests/integration/seed-reseed.test.ts` › "SCRUM-233 [AC11] TC-233-23: the seed runs over itself after a gap of days, restores what passed, and leaves rows made through the app"

### TC-233-24

| Item | Content |
|---|---|
| Test Case ID | TC-233-24 |
| Test Scenario | [Negative] AC 11: a seed refused part way by a row made through the app writes nothing at all |
| Pre-conditions | TC-233-23's database, seeded as of today, with a booking not made by the seed Approved at Exhibition Hall on the slot `bkg_confirmed` moves to tomorrow. |
| Test Steps | 1. Count the seeded live bookings. <br> 2. Seed as of tomorrow. <br> 3. Read the rows again. |
| Test Data | The added booking at Exhibition Hall, 11 days from today, 09:00–13:00 SGT |
| Expected Result | The run fails, naming `booking_no_double_booking`. The seeded live bookings are the same in number, `evt_confirmed` keeps its date, and all five seeded unavailability periods remain. |

**Automated by:** `tests/integration/seed-reseed.test.ts` › "SCRUM-233 [AC11] TC-233-24: a seed refused part way by a row made through the app writes nothing at all"

### TC-233-25

| Item | Content |
|---|---|
| Test Case ID | TC-233-25 |
| Test Scenario | [Positive] AC 11: `npm run db:seed` puts back every seeded row the app changed, whichever field it wrote |
| Pre-conditions | TC-233-23's database, seeded as of today. |
| Test Steps | 1. Read every column of every seeded row. <br> 2. Write to seeded rows what the actions write: assigning, editing a draft, cancelling, rejecting from Planning, confirming, deciding a venue or change request, approving a hold, resolving a flag, withdrawing, answering a clarification, reviewing equipment, recording a safety check, reading a notification, withdrawing a notice, and retiring a venue and an equipment type. <br> 3. Seed as of today. <br> 4. Read every seeded row again. |
| Test Data | Rows with prefixes `evt_`, `bkg_`, `res_`, `reg_`, `clr_`, `chg_`, `chgf`, `eqr_`, `eql_`, `sfc_`, `ntf_`, `ven_`, `eqp_` and `eun_`, all columns but `updatedAt` |
| Expected Result | The rows differ after step 2, and match step 1 exactly after step 4. Nothing the app wrote stays on a seeded row, such as a cancellation reason on a Confirmed event. |

**Automated by:** `tests/integration/seed-reseed.test.ts` › "SCRUM-233 [AC11] TC-233-25: a re-seed puts back every seeded row the app changed, whichever field it wrote"

### TC-233-26

| Item | Content |
|---|---|
| Test Case ID | TC-233-26 |
| Test Scenario | [Positive] AC 14: every live hold has the notices holding it writes ahead (SCRUM-163 AC4, SCRUM-124 AC5) |
| Pre-conditions | Freshly seeded. |
| Test Steps | 1. Read each seeded Held booking. <br> 2. Read its notices that aren't withdrawn. |
| Test Data | `bkg_held`, `bkg_hold_approved` |
| Expected Result | Each has one held notice, one reminder shown 24 hours before its expiry, and one expiry notice shown at its expiry. |

**Automated by:** `tests/integration/seed-lifecycle.test.ts` › "SCRUM-233 [AC14] TC-233-26: every live hold has the notices holding it writes ahead, its reminder a day before it expires and its expiry notice when it does"

### TC-233-27

| Item | Content |
|---|---|
| Test Case ID | TC-233-27 |
| Test Scenario | [Positive] AC 14: every live booking is at a venue with the facilities its event asks for (SCRUM-40) |
| Pre-conditions | Freshly seeded. |
| Test Steps | 1. Read each seeded Pending, Held or Approved booking, with its event's required facilities and its venue's facilities. |
| Test Data | All `bkg_` rows in those statuses |
| Expected Result | The venue has every facility the event asks for. |

**Automated by:** `tests/integration/seed-lifecycle.test.ts` › "SCRUM-233 [AC14] TC-233-27: every live booking is at a venue with the facilities its event asks for"

### TC-233-28

| Item | Content |
|---|---|
| Test Case ID | TC-233-28 |
| Test Scenario | [Boundary] AC 14: no open equipment request asks for more than the pool owns, and the line short of stock is short only of what's free (SCRUM-28 AC4) |
| Pre-conditions | Freshly seeded. |
| Test Steps | 1. Read each line still on a request that is Pending Review, In Review or Approved. <br> 2. Read `eql_in_review_projector`, `eun_projector_workshop` and the Media Workshop's period. |
| Test Data | Projector: 10 owned, 6 away for the event's period, 5 requested |
| Expected Result | 1. No line asks for more than its type's total. 2. The 6 are away for the whole event, leaving 4 free, so the 5 requested are one short. |

**Automated by:** `tests/integration/seed-lifecycle.test.ts` › "SCRUM-233 [AC14] TC-233-28: no open equipment request asks for more than the pool owns, and the line short of stock is short only of what's free"
