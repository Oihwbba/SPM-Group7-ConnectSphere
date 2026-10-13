# SCRUM-172 — Week 7 database migration: test cases

Story and acceptance criteria: [docs/backlog/SCRUM-172.md](../backlog/SCRUM-172.md).
Format and conventions: [README.md](README.md). Why the booking rules live in
the database: [ADR 0010, 2026-10-08 addendum](../adr/0010-database-prevents-venue-double-booking.md).

**Shared pre-conditions for every case:** a local PostgreSQL migrated with
`npm run db:deploy` and seeded with `npm run db:seed`. Most of these columns
and tables have no screen or action yet; the stories that use them build
those. So the cases write rows directly, as those stories will, and check what
the database keeps or refuses. Times are UTC.

| ID | Type | Criterion | Automated |
|---|---|---|---|
| [TC-172-01](#tc-172-01) | Positive | AC 1 | Unit, integration |
| [TC-172-02](#tc-172-02) | Positive, Boundary | AC 2 | Integration |
| [TC-172-03](#tc-172-03) | Positive, Negative, Boundary | AC 3 | Integration |
| [TC-172-04](#tc-172-04) | Positive, Negative | AC 4 | Integration |
| [TC-172-05](#tc-172-05) | Positive, Negative | AC 5 | Unit, integration |
| [TC-172-06](#tc-172-06) | Positive, Negative | AC 6 | Integration |
| [TC-172-07](#tc-172-07) | Positive | AC 7 | Integration |
| [TC-172-08](#tc-172-08) | Positive, Negative | AC 8 | Integration |
| [TC-172-09](#tc-172-09) | Negative, Boundary | AC 9 (booking against booking) | Integration |
| [TC-172-10](#tc-172-10) | Negative, Boundary | AC 9 (booking against unavailability) | Integration |
| [TC-172-11](#tc-172-11) | Positive, Negative | AC 9 (unavailability) | Integration |
| [TC-172-12](#tc-172-12) | Negative, Positive | AC 9 (one per event and venue) | Integration |
| [TC-172-13](#tc-172-13) | Boundary | AC 9 (an expired hold) | Integration |
| [TC-172-14](#tc-172-14) | Concurrency | AC 9 | Integration |
| [TC-172-15](#tc-172-15) | Positive | AC 10 | Integration |
| [TC-172-16](#tc-172-16) | Positive | AC 11 | Whole suite (CI) |
| [TC-172-17](#tc-172-17) | Positive, Negative | AC 12 | Integration |
| [TC-172-18](#tc-172-18) | Positive, Negative, Boundary | AC 13 | Integration |
| [TC-172-19](#tc-172-19) | Positive, Negative | AC 14 | Integration |
| [TC-172-20](#tc-172-20) | Positive | AC 12, AC 13, AC 14 (existing data) | Integration |

---

### TC-172-01

| Item | Content |
|---|---|
| Test Case ID | TC-172-01 |
| Test Scenario | [Positive] AC 1: users can hold the Event Coordinator Lead and Safety Officer roles; until SCRUM-164 gives them work, each may only read its own notifications |
| Pre-conditions | — |
| Test Steps | 1. List the database's `Role` values. <br> 2. Ask `can()` what each new role may do. <br> 3. Read each new role's navigation and label. <br> 4. Call `createDraftEvent` as each new role. |
| Test Data | `COORDINATOR_LEAD`, `SAFETY_OFFICER` |
| Expected Result | Step 1: the five Release 1 roles, then `COORDINATOR_LEAD` and `SAFETY_OFFICER`. Step 2: each reads its own notifications but not someone else's, and can't create, review, confirm or reject an event, decide a booking, record unavailability or reserve equipment. Step 3: "Event Coordinator Lead" and "Safety Officer", each with only Notifications, landing there. Step 4: "You do not have permission to do that." and nothing is written. |

**Automated by:** `tests/integration/week7-rules.test.ts` › "SCRUM-172 [AC1] TC-172-01: users can hold the Event Coordinator Lead and Safety Officer roles"; `tests/unit/auth.test.ts` › "SCRUM-172 [AC1] TC-172-01: %s may read only its own notifications"; `tests/unit/nav.test.ts` › "SCRUM-172 [AC1] TC-172-01: %s is labelled and lands on its notifications"; `tests/integration/permission-guard.test.ts` › "refuses %s directly and leaves the database unchanged"

### TC-172-02

| Item | Content |
|---|---|
| Test Case ID | TC-172-02 |
| Test Scenario | [Positive, Boundary] AC 2: venues have setup and turnaround minutes from 0 to 1,440, starting at 0, and optional known restrictions |
| Pre-conditions | A venue created without the new fields; a venue that existed before the migration. |
| Test Steps | 1. Read the new venue. <br> 2. Save known restrictions. <br> 3. Save 0 and 1,440 minutes. <br> 4. Save −1 and 1,441, for setup and for turnaround. <br> 5. Read the venue that existed before the migration. |
| Test Data | "One emergency exit." |
| Expected Result | Step 1: 0 and 0 minutes, no restrictions. Step 2: kept. Step 3: saved. Step 4: each refused by `venue_setup_turnaround_range`. Step 5: 0, 0 and no restrictions. |

**Automated by:** `tests/integration/week7-rules.test.ts` › "SCRUM-172 [AC2] TC-172-02: a new venue starts at 0 and 0 minutes with no restrictions, and keeps the restrictions it is given" and "SCRUM-172 [AC2] TC-172-02: setup and turnaround accept 0 to 1,440 minutes and refuse one either side"; `tests/integration/week7-migration.test.ts` › "SCRUM-172 [AC2] TC-172-02: existing venues start at 0 setup and 0 turnaround minutes, with no restrictions"

### TC-172-03

| Item | Content |
|---|---|
| Test Case ID | TC-172-03 |
| Test Scenario | [Positive, Negative, Boundary] AC 3: a booking can be Held with an expiry and a note, or Expired, and keeps its own setup and turnaround minutes |
| Pre-conditions | A test venue and event. |
| Test Steps | 1. Save a Pending booking without minutes, then with −1 or 1,441. <br> 2. Save a Held booking with an expiry an hour before its start and a note. <br> 3. Save a Held or Expired booking with no expiry, no note or a blank note. <br> 4. Save a hold expiring at the start, after it, or when it was placed. <br> 5. Save one expiring a minute before the start. |
| Test Data | Note: "Confirm the AV needs." |
| Expected Result | Step 1: 0 and 0; the others refused by `booking_setup_turnaround_range`. Step 2: saved as Held with its expiry and note. Step 3: refused by `booking_hold_complete`, nothing saved. Step 4: refused by `booking_hold_period_valid`. Step 5: saved. (The expiry being later than now is checked when the hold is placed, in SCRUM-163; a CHECK can't read the clock.) |

**Automated by:** `tests/integration/week7-rules.test.ts` › "SCRUM-172 [AC3] TC-172-03: a booking starts with 0 and 0 minutes, and its minutes are refused outside 0 to 1,440", "SCRUM-172 [AC3] TC-172-03: a Held booking is saved with its expiry and note", "SCRUM-172 [AC3] TC-172-03: a Held or Expired booking without an expiry or a note is refused" and "SCRUM-172 [AC3] TC-172-03: a hold must expire after it was placed and before the booking starts"

### TC-172-04

| Item | Content |
|---|---|
| Test Case ID | TC-172-04 |
| Test Scenario | [Positive, Negative] AC 4: a venue booking or equipment reservation can be flagged with its reason and when, and resolved with who and when |
| Pre-conditions | An approved booking; seeded equipment `eqp_lectern`. |
| Test Steps | 1. Flag the booking, and a new reservation, without a reason, without a time, or with a blank reason. <br> 2. Flag the booking with a reason, then resolve it. <br> 3. Save a reservation flagged and resolved. <br> 4. Save a resolution with only who or only when. <br> 5. Migrate a database holding a booking flagged without a reason or time. |
| Test Data | "Grand Hall closed for repairs." |
| Expected Result | Step 1: refused by `booking_flag_has_reason` and `reservation_flag_has_reason`. Step 2: the booking stays Approved, flagged with its reason; resolved, it keeps when it was flagged and records who and when. Step 3: saved. Step 4: refused by `booking_flag_resolution_complete` and `reservation_flag_resolution_complete`. Step 5: the migration completes; the booking stays flagged, with "Reason not recorded (pre-constraint data)." and a time. |

**Automated by:** `tests/integration/week7-rules.test.ts` › "SCRUM-172 [AC4] TC-172-04: a flagged booking or reservation must say why and when", "SCRUM-172 [AC4] TC-172-04: a flag is saved with its reason, and resolved with who and when" and "SCRUM-172 [AC4] TC-172-04: a resolution needs both who and when"; `tests/integration/week7-migration.test.ts` › "SCRUM-172 [AC4] TC-172-04: a booking flagged before the migration is given a reason and a time, and stays flagged"

### TC-172-05

| Item | Content |
|---|---|
| Test Case ID | TC-172-05 |
| Test Scenario | [Positive, Negative] AC 5: venue unavailability uses the five Week 7 reasons, and existing Damaged and Closure rows are moved |
| Pre-conditions | A database migrated to just before this migration, with venue unavailability recorded as Maintenance, Damaged, Closure (with and without a note) and Other. |
| Test Steps | 1. Apply the migration. <br> 2. Read the rows. <br> 3. List the venue and equipment reason types. <br> 4. As Venue Staff, record unavailability with each reason, and with Damaged and Closure. |
| Test Data | Notes "Projector mount." and "Public holiday." |
| Expected Result | Step 2: Damaged is Equipment failure with its note; Closure is Other, with the note "Closure" or "Closure: Public holiday."; Maintenance and Other are unchanged. Step 3: venues have Maintenance, Equipment failure, Renovation, Safety concern and Other; equipment keeps Maintenance, Damaged, Closure and Other, because SCRUM-29/30 still name "Damaged". Step 4: the five are saved; Damaged and Closure are refused with "Choose a reason." |

**Automated by:** `tests/integration/week7-migration.test.ts` › "SCRUM-172 [AC5] TC-172-05: Damaged becomes Equipment failure, and Closure becomes Other with Closure kept in the note" and "SCRUM-172 [AC5] TC-172-05: venue unavailability offers exactly the five Week 7 reasons; equipment keeps its own"; `tests/unit/unavailability.test.ts` › "SCRUM-172 [AC5] TC-172-05: the five venue reasons are accepted, and Damaged and Closure no longer are"

### TC-172-06

| Item | Content |
|---|---|
| Test Case ID | TC-172-06 |
| Test Scenario | [Positive, Negative] AC 6: a safety check records the event, its state, the note, the picked arrangements, and who recorded the outcome and when |
| Pre-conditions | Test events; an approved booking and a reservation. |
| Test Steps | 1. Request a check, then approve it with who and when. <br> 2. Record Changes requested or Rejected without a note or with a blank one, and Approved without one. <br> 3. Record an outcome missing who or when. <br> 4. Mark a check Outdated without and with a time. <br> 5. Request a second check while one awaits review; decide the first and request again; request one for another event. <br> 6. Pick the booking and the reservation for Changes requested; then pick neither, both on one row, or the booking twice. |
| Test Data | Notes "Exit blocked.", "Move the stage." |
| Expected Result | Step 1: Awaiting review, then Approved with who decided. Step 2: refused by `safety_check_note_required`; Approved is saved. Step 3: refused by `safety_check_outcome_recorded`, nothing saved. Step 4: refused by `safety_check_outdated_has_time`, then saved. Step 5: the second is refused (the partial unique index `safety_check_one_awaiting_per_event`); after the decision it is saved, both kept; another event is unaffected. Step 6: two arrangements saved; neither or both refused by `safety_check_arrangement_one_target`; the duplicate refused. |

**Automated by:** `tests/integration/week7-rules.test.ts` › "SCRUM-172 [AC6] TC-172-06: a requested check awaits review, and each outcome is saved with who and when", "SCRUM-172 [AC6] TC-172-06: Changes requested and Rejected need a note; Approved does not", "SCRUM-172 [AC6] TC-172-06: an outcome without who recorded it, or when, is refused", "SCRUM-172 [AC6] TC-172-06: an Outdated check records when it went out of date", "SCRUM-172 [AC6] TC-172-06: an event has at most one check awaiting review, and every check is kept" and "SCRUM-172 [AC6] TC-172-06: a picked arrangement is exactly one booking or one reservation, once per check"

### TC-172-07

| Item | Content |
|---|---|
| Test Case ID | TC-172-07 |
| Test Scenario | [Positive] AC 7: notifications have a show-from time and the Week 7 types |
| Pre-conditions | A held booking; a notification written before the migration. |
| Test Steps | 1. Write a notification without a show-from time. <br> 2. Write a hold reminder shown from a later time, naming the booking. <br> 3. List the notification types. <br> 4. Read the notification written before the migration. |
| Test Data | `BOOKING_HELD`, `HOLD_EXPIRY_REMINDER` |
| Expected Result | Step 1: shown from the time it was written. Step 2: kept with its show-from time and booking, not withdrawn. Step 3: includes the sixteen SCRUM-124 types (booking requested; equipment request submitted, changed and withdrawn; booking request withdrawn; booking held; hold reminder, expired, confirmed and released; change request submitted; arrangement flagged and resolved; request awaiting assignment; safety check requested and outcome), and the Week 9 one for Venue Staff approving a hold (`HOLD_APPROVED`, SCRUM-124 AC4). Step 4: shown from when it was written. |

**Automated by:** `tests/integration/week7-rules.test.ts` › "SCRUM-172 [AC7] TC-172-07: a notification shows at once unless given a later show-from time, and can name its booking" and "SCRUM-172 [AC7] TC-172-07: every Week 7 notification type exists"; `tests/integration/week7-migration.test.ts` › "SCRUM-172 [AC7] TC-172-07: an existing notification shows from when it was written"

### TC-172-08

| Item | Content |
|---|---|
| Test Case ID | TC-172-08 |
| Test Scenario | [Positive, Negative] AC 8 (reworded 2026-10-08): the event records the Coordinator's No equipment needed decision, with who recorded it and when (SCRUM-170 AC4) |
| Pre-conditions | A test event; a database migrated to just before this change, with existing events. |
| Test Steps | 1. Read a new event. <br> 2. Record No equipment needed as the Coordinator. <br> 3. Clear the decision. <br> 4. Record a decision with only the time, or only who. <br> 5. Migrate the database with existing events. |
| Test Data | `usr_coordinator` |
| Expected Result | Step 1: no decision. Step 2: kept with who and when. Step 3: back to no decision (Not decided). Step 4: refused by `event_no_equipment_decision_complete`; nothing changes. Step 5: every existing event has no decision, and the per-type quantities table SCRUM-127 needed (dropped from the backlog on 2026-10-08) is gone. |

**Automated by:** `tests/integration/week7-rules.test.ts` › "SCRUM-172 [AC8] TC-172-08: an event starts with no decision, and keeps who recorded No equipment needed and when", "SCRUM-172 [AC8] TC-172-08: clearing the decision goes back to Not decided" and "SCRUM-172 [AC8] TC-172-08: a decision without who recorded it, or when, is refused"; `tests/integration/week7-migration.test.ts` › "SCRUM-172 [AC8] TC-172-08: existing events have no equipment decision, and the per-type quantities table is gone"

### TC-172-09

| Item | Content |
|---|---|
| Test Case ID | TC-172-09 |
| Test Scenario | [Negative, Boundary] AC 9: no two Approved or Held bookings at a venue have overlapping occupied periods |
| Pre-conditions | SCRUM-159 AC4's example: an approved booking 10:00–12:00 with 30 minutes' setup and 45 minutes' turnaround, occupying 09:30–12:45. |
| Test Steps | 1. Approve, then hold, 13:00–15:00 with 30 minutes' setup (occupied from 12:30). <br> 2. Approve 13:15–15:00 with 30 minutes' setup (occupied from 12:45). <br> 3. With a Held booking 10:00–12:00, approve the same period, then request it. <br> 4. With an approved booking 10:00–12:00 at 0 and 0, raise the venue to 120 and 120, then approve 12:00–14:00 at 0 and 0. |
| Test Data | — |
| Expected Result | Step 1: both refused by `booking_no_double_booking`; one booking remains. Step 2: approved, because touching is not overlapping. Step 3: the approval is refused; the Pending request is saved. Step 4: approved, because each booking keeps the minutes it was approved with (SCRUM-159 AC8). |

**Automated by:** `tests/integration/week7-rules.test.ts` › "SCRUM-172 [AC9] TC-172-09: an Approved or Held booking whose occupied period overlaps another's is refused", "SCRUM-172 [AC9] TC-172-09: occupied periods that only touch don't conflict", "SCRUM-172 [AC9] TC-172-09: a Held booking blocks like an Approved one, and Pending requests block nobody" and "SCRUM-172 [AC9] TC-172-09: a booking keeps the minutes it was approved with when the venue's change"

### TC-172-10

| Item | Content |
|---|---|
| Test Case ID | TC-172-10 |
| Test Scenario | [Negative, Boundary] AC 9: no Approved or Held booking's occupied period overlaps recorded unavailability |
| Pre-conditions | Unavailability 09:00–09:45. |
| Test Steps | 1. Approve, then hold, 10:00–12:00 with 30 minutes' setup (occupied from 09:30). <br> 2. Approve it with 15 minutes' setup (occupied from 09:45). <br> 3. With unavailability 11:00–13:00, save a Pending request 10:00–12:00, then approve it. |
| Test Data | — |
| Expected Result | Step 1: both refused by `booking_overlaps_unavailability`. Step 2: approved; touching. Step 3: the request is saved; the approval is refused. |

**Automated by:** `tests/integration/week7-rules.test.ts` › "SCRUM-172 [AC9] TC-172-10: an Approved or Held booking whose occupied period overlaps recorded unavailability is refused" and "SCRUM-172 [AC9] TC-172-10: a Pending request over unavailability is saved, and can't then be approved"; `tests/integration/unavailability.test.ts` › "SCRUM-37 [AC2] TC-37-04: the database alone refuses approving a booking over recorded maintenance"

### TC-172-11

| Item | Content |
|---|---|
| Test Case ID | TC-172-11 |
| Test Scenario | [Positive, Negative] AC 9: unavailability may overlap bookings but not other unavailability |
| Pre-conditions | An approved booking at one venue and a held booking at another, both 10:00–12:00. |
| Test Steps | 1. Record unavailability 11:00–15:00 over the approved booking, and 10:00–12:00 over the hold, directly in the database. <br> 2. Record 14:00–16:00 at the first venue. <br> 3. Record 15:00–16:00 there. |
| Test Data | — |
| Expected Result | Step 1: both saved, and the booking stays Approved (SCRUM-161 flags it; the refusal SCRUM-37 AC4 describes is now the action's, until SCRUM-161). Step 2: refused by `unavailability_overlaps_unavailability`. Step 3: saved; touching. |

**Automated by:** `tests/integration/week7-rules.test.ts` › "SCRUM-172 [AC9] TC-172-11: unavailability may overlap Approved and Held bookings but not other unavailability"; `tests/integration/unavailability.test.ts` › "SCRUM-172 [AC9] TC-172-11: the database accepts unavailability written over an approved booking"

### TC-172-12

| Item | Content |
|---|---|
| Test Case ID | TC-172-12 |
| Test Scenario | [Negative, Positive] AC 9: an event has at most one Pending, Held or Approved booking per venue |
| Pre-conditions | A test event with a Pending booking at the test venue. |
| Test Steps | 1. Save a Pending, a Held and an Approved booking for the same event and venue. <br> 2. Save one at another venue. <br> 3. With only Rejected, Cancelled and Expired bookings at a venue, request it again. |
| Test Data | — |
| Expected Result | Step 1: each refused by `booking_one_per_venue_per_event`; still one booking. Step 2: saved (SCRUM-162). Step 3: saved. |

**Automated by:** `tests/integration/bookings.test.ts` › "SCRUM-172 [AC9] TC-172-12: the database refuses a second pending, held or approved booking for one event at the same venue, but not at another"; `tests/integration/week7-rules.test.ts` › "SCRUM-172 [AC9] TC-172-12: Rejected, Cancelled and Expired bookings don't stop the event asking for the venue again"

### TC-172-13

| Item | Content |
|---|---|
| Test Case ID | TC-172-13 |
| Test Scenario | [Boundary] AC 9: a Held booking counts only until its expiry, and can't be confirmed after it (SCRUM-163 AC4, AC8) |
| Pre-conditions | For each step, a fresh hold placed two hours ago that expired a minute ago, still marked Held, with nothing written at the venue since; separately, a hold that hasn't expired. |
| Test Steps | 1. Approve another event over the expired hold, then read the hold. <br> 2. As the only write, request the same venue for the held event again, then read the hold. <br> 3. Confirm the expired hold (set it Approved). <br> 4. Approve another event over the hold that hasn't expired. <br> 5. Confirm the hold that hasn't expired. |
| Test Data | — |
| Expected Result | Steps 1 and 2: saved, and the hold is Expired, marked by the database before it checked. Step 3: refused by `booking_hold_expired`; it stays Held. Step 4: refused by `booking_no_double_booking`; the hold stays Held. Step 5: Approved. |

**Automated by:** `tests/integration/week7-rules.test.ts` › "SCRUM-172 [AC9] TC-172-13: a hold whose expiry has passed doesn't stop another event being approved, and is marked Expired", "SCRUM-172 [AC9] TC-172-13: a hold whose expiry has passed doesn't stop its own event requesting the venue again", "SCRUM-172 [AC9] TC-172-13: a hold whose expiry has passed can't be confirmed; one that hasn't can" and "SCRUM-172 [AC9] TC-172-13: a hold whose expiry hasn't passed still blocks"

### TC-172-14

| Item | Content |
|---|---|
| Test Case ID | TC-172-14 |
| Test Scenario | [Concurrency] AC 9: two approvals at the same moment whose booked periods touch but whose occupied periods overlap; exactly one is saved (SCRUM-159 AC5) |
| Pre-conditions | Real PostgreSQL. |
| Test Steps | 1. Approve 10:00–12:00 with 45 minutes' turnaround and 12:00–14:00 with 30 minutes' setup at the same moment. |
| Test Data | — |
| Expected Result | One is saved; the other is refused by `booking_no_double_booking` (or as a deadlock, which the actions retry once). One Approved booking. The SCRUM-53 and SCRUM-37 races still hold under the new rules. |

**Automated by:** `tests/integration/week7-rules.test.ts` › "SCRUM-172 [AC9] TC-172-14: two approvals whose booked periods only touch but whose occupied periods overlap, at the same moment: exactly one is saved"; `tests/integration/concurrency.test.ts` › "SCRUM-37 [AC4] TC-37-06: an approval and a maintenance record for overlapping periods at the same moment: exactly one is saved"

### TC-172-15

| Item | Content |
|---|---|
| Test Case ID | TC-172-15 |
| Test Scenario | [Positive] AC 10: the migration runs on an empty database and on existing data, and existing bookings keep their status |
| Pre-conditions | (a) An empty database. (b) A database migrated to just before this migration, with Pending, Approved, Rejected and Cancelled bookings. (c) The local Docker database with the current seed. |
| Test Steps | 1. Apply every migration to (a). <br> 2. Apply this migration to (b) and read the bookings. <br> 3. Apply it to (c), compare the booking statuses before and after, then run the seed. |
| Test Data | — |
| Expected Result | Step 1: all migrations apply, and `prisma migrate diff` finds no drift from `schema.prisma`. Step 2: every booking keeps its status, with 0 and 0 minutes. Step 3: the counts per status are identical, and the seed runs. |

**Automated by:** `tests/integration/week7-migration.test.ts` › "SCRUM-172 [AC10] TC-172-15: every existing booking keeps its status, with 0 setup and turnaround minutes"; step 1 is CI's migrate step on its empty database (ADR 0005). Step 3 is **Manual**, run on 2026-10-08 (PENDING 1, APPROVED 4, REJECTED 1, CANCELLED 1 before and after).

### TC-172-16

| Item | Content |
|---|---|
| Test Case ID | TC-172-16 |
| Test Scenario | [Positive] AC 11: tests that relied on the old rules are updated, and all others still pass |
| Pre-conditions | — |
| Test Steps | 1. Run every unit, integration and e2e test. |
| Test Data | — |
| Expected Result | All pass. Updated for the new rules: SCRUM-37's database refusal of unavailability over an approved booking (now TC-172-11), its "caught by the database after the check" unit tests (now one test that the venue is locked first), SCRUM-50 AC8's database refusal at another venue (now TC-172-12), and fixtures that used the Damaged and Closure venue reasons. |

**Automated by:** the whole suite (`npm run test:coverage`, `npm run test:e2e`); the changed tests are listed in the pull request.

### TC-172-17

| Item | Content |
|---|---|
| Test Case ID | TC-172-17 |
| Test Scenario | [Positive, Negative] AC 12: an event records its supervising Lead (SCRUM-165 AC11); existing events start with none |
| Pre-conditions | Test events; two Coordinator Lead accounts. |
| Test Steps | 1. Read the event. <br> 2. Set the Lead as its supervising Lead. <br> 3. On another event, set a supervising Lead who isn't a user. <br> 4. On a third event, set the second Lead, then delete that user. |
| Test Data | Two users with the role `COORDINATOR_LEAD`; `usr_nobody` |
| Expected Result | Step 1: no supervising Lead. Step 2: kept, and it is the Lead. Step 3: refused by `Event_supervisingLeadId_fkey`, and that event still has none. Step 4: the user is deleted, and the event remains with no supervising Lead (like its Coordinator, `Event_coordinatorId_fkey`). |

**Automated by:** `tests/integration/w9-rules.test.ts` › "SCRUM-172 [AC12] TC-172-17: an event starts with no supervising Lead, and keeps the Lead it is given", "SCRUM-172 [AC12] TC-172-17: a supervising Lead who isn't a user is refused, and the event is unchanged" and "SCRUM-172 [AC12] TC-172-17: deleting the supervising Lead's user leaves the event unsupervised, and keeps the event"

### TC-172-18

| Item | Content |
|---|---|
| Test Case ID | TC-172-18 |
| Test Scenario | [Positive, Negative, Boundary] AC 13: a venue booking records when, and by whom, Venue Staff approved its hold (SCRUM-163 AC7); new and existing bookings start with none |
| Pre-conditions | A test venue and events. Each hold is placed at 08:00 on 1 May 2037 and expires at 08:00 on 5 May. |
| Test Steps | 1. Read a new hold. <br> 2. Record an approval by `usr_venuestaff` at 09:00 on 2 May, then confirm the hold (Approved). <br> 3. On another hold, record only the time, then only who. <br> 4. Record an approval on a Pending booking that was never held. <br> 5. On a hold, record an approval a minute before it was placed, then at the moment it was placed. <br> 6. Delete a user who approved a hold. |
| Test Data | `usr_venuestaff` |
| Expected Result | Step 1: no approval. Step 2: the approval is kept, and still kept once the booking is Approved. Steps 3 and 4: refused by `booking_hold_approval_complete`, nothing saved. Step 5: a minute before is refused the same way; at the moment it was placed is saved. Step 6: refused by `Booking_holdApprovedById_fkey`, and the approval keeps who made it and when. |

**Automated by:** `tests/integration/w9-rules.test.ts` › "SCRUM-172 [AC13] TC-172-18: a hold starts unapproved, records when and by whom Venue Staff approved it, and keeps that once confirmed", "SCRUM-172 [AC13] TC-172-18: an approval without who or when is refused", "SCRUM-172 [AC13] TC-172-18: only a booking that was held records an approval, at or after the hold was placed" and "SCRUM-172 [AC13] TC-172-18: a user who approved a hold can't be deleted, so the approval never loses who made it"

### TC-172-19

| Item | Content |
|---|---|
| Test Case ID | TC-172-19 |
| Test Scenario | [Positive, Negative] AC 14: each change to a hold's expiry is recorded with the old expiry, the new expiry, who changed it and when |
| Pre-conditions | A hold expiring at 08:00 on 5 May 2037. |
| Test Steps | 1. Record a change from 5 May 08:00 to 6 May 08:00, then from 6 May 08:00 to 4 May 17:00. <br> 2. On another hold, record a change from 5 May 08:00 to 5 May 08:00. |
| Test Data | `usr_venuestaff` |
| Expected Result | Step 1: both changes are kept, in order, each with its old and new expiry, who changed it and when (now). Step 2: refused by `hold_expiry_change_differs`, and that hold has no changes. |

**Automated by:** `tests/integration/w9-rules.test.ts` › "SCRUM-172 [AC14] TC-172-19: each change to a hold's expiry is kept with the old and new expiry, who changed it and when" and "SCRUM-172 [AC14] TC-172-19: recording the same expiry as a change is refused, and nothing is kept"

### TC-172-20

| Item | Content |
|---|---|
| Test Case ID | TC-172-20 |
| Test Scenario | [Positive] AC 12, AC 13, AC 14: the Week 9 migration runs on existing data, and existing events and bookings start with none of the new data |
| Pre-conditions | A database migrated to just before the Week 9 migration, with five events and their bookings: Pending, Approved, Held, Expired, and a hold its Coordinator confirmed before Venue Staff approval existed (Approved). |
| Test Steps | 1. Apply the Week 9 migration. <br> 2. Read the events, the bookings and the expiry history. |
| Test Data | — |
| Expected Result | Step 1: it applies. Step 2: no event has a supervising Lead; every booking keeps its status, the confirmed hold included, with no approval; there are no expiry changes. |

**Automated by:** `tests/integration/w9-migration.test.ts` › "SCRUM-172 [AC12] TC-172-20: existing events start with no supervising Lead", "SCRUM-172 [AC13] TC-172-20: existing bookings start with no hold approval and keep their status, including a hold confirmed before approval existed" and "SCRUM-172 [AC14] TC-172-20: existing holds start with no recorded expiry changes"
