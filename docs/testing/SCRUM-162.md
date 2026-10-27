# SCRUM-162 — Book several venues for one event: test cases

Story and acceptance criteria: [docs/backlog/SCRUM-162.md](../backlog/SCRUM-162.md).
Format and conventions: [README.md](README.md). It replaces SCRUM-50 AC1 and
AC8 (see [TC-50-07](SCRUM-50.md#tc-50-07) and [TC-50-15](SCRUM-50.md#tc-50-15)),
and changes the readiness checklist's Venue item (SCRUM-110, ADR 0011).

**Shared pre-conditions for every case:** the database is migrated and seeded
and the app is running. The tester signs in as the event's assigned
Coordinator (`coordinator@test.local` / `Password123!`) unless the case says
otherwise. The event is in Planning, runs 09:10–12:45 on 10 Mar 2035 (its
booking period is exactly that, since SCRUM-188 stopped rounding it to 9:00 am
to 1:00 pm) and expects 120. Times are Singapore
time.

| ID | Type | Criterion | Automated |
|---|---|---|---|
| [TC-162-01](#tc-162-01) | Positive | AC 1, AC 3 | Integration |
| [TC-162-02](#tc-162-02) | Negative | AC 2 | Unit, integration, e2e |
| [TC-162-03](#tc-162-03) | Positive | AC 2 | Integration |
| [TC-162-04](#tc-162-04) | Positive | AC 3, AC 9 | Unit |
| [TC-162-05](#tc-162-05) | Positive, Boundary | AC 4 | Unit, integration, e2e |
| [TC-162-06](#tc-162-06) | Negative, Boundary | AC 4 | Unit, integration, e2e |
| [TC-162-07](#tc-162-07) | Negative, Boundary | AC 4 | Unit, integration, e2e |
| [TC-162-08](#tc-162-08) | Positive | AC 3, AC 5 | Integration |
| [TC-162-09](#tc-162-09) | Positive | AC 5 | Unit, integration |
| [TC-162-10](#tc-162-10) | Concurrency | AC 6 | Integration |
| [TC-162-11](#tc-162-11) | Positive, Negative | AC 7 | Unit |
| [TC-162-12](#tc-162-12) | Positive | AC 8 | Unit |
| [TC-162-13](#tc-162-13) | Negative | AC 8 | Unit |
| [TC-162-14](#tc-162-14) | Positive | AC 9 | Unit, integration |

### TC-162-01

| Item | Content |
|---|---|
| Test Case ID | TC-162-01 |
| Test Scenario | [Positive] AC 1, AC 3: an event that already has a booking at one venue gets a request for another venue, linked to the same event |
| Pre-conditions | The event has a Pending or Approved booking at the Grand Auditorium for its period. |
| Test Steps | 1. Open **Request Venue**. <br> 2. Choose the event and the Exhibition Hall, and submit. |
| Test Data | Exhibition Hall, 9:10 am–12:45 pm, 120 |
| Expected Result | "Request submitted". The event now has two bookings: the Grand Auditorium and the Exhibition Hall. The other venue's approval doesn't make this one unavailable: availability is checked for the requested venue only. |

**Automated by:** `tests/integration/bookings.test.ts` › "SCRUM-162 [AC1] TC-162-01: an event with a pending booking at another venue gets a new request for this one, linked to the same event" (and the approved one)

### TC-162-02

| Item | Content |
|---|---|
| Test Case ID | TC-162-02 |
| Test Scenario | [Negative] AC 2: asking for a venue the event already has a Pending, Held or Approved booking at creates nothing and shows the existing one |
| Pre-conditions | The event has a Pending, Held (unexpired) or Approved booking at the Exhibition Hall. |
| Test Steps | 1. Request the Exhibition Hall for the event again, even with a different attendance or layout. |
| Test Data | Exhibition Hall |
| Expected Result | "This event already has a request for this venue." with the existing booking's venue, times and status. No new row. |

**Automated by:** `tests/integration/bookings.test.ts` › "SCRUM-162 [AC2] TC-162-02: an event with a pending booking at this venue is shown it, and no request is created" (and the held and approved ones); `tests/unit/bookings.test.ts` › "SCRUM-162 [AC2] TC-162-02, SCRUM-163 [AC4] TC-163-08: an event that already has a pending, approved or unexpired held booking at this venue is shown it and nothing is created" and "SCRUM-162 [AC2] TC-162-02: the existing booking at this venue is shown even when the request's other details differ from it"; `e2e/bookings.spec.ts` › "SCRUM-50 [AC2], SCRUM-52 [AC1-AC3], SCRUM-53 [AC1, AC4]: a coordinator requests, staff approve, and the venue becomes unavailable"

### TC-162-03

| Item | Content |
|---|---|
| Test Case ID | TC-162-03 |
| Test Scenario | [Positive] AC 2: a Rejected, Expired or Cancelled booking at a venue doesn't stop a new request for it |
| Pre-conditions | The event's only booking at the Exhibition Hall is Rejected, Cancelled or Expired. |
| Test Steps | 1. Request the Exhibition Hall for the event again. |
| Test Data | Exhibition Hall |
| Expected Result | A new Pending request is created; the old booking is kept as it was. |

**Automated by:** `tests/integration/bookings.test.ts` › "SCRUM-162 [AC2] TC-162-03: a rejected booking at this venue doesn't stop a new request, and is kept" (and the cancelled and expired ones)

### TC-162-04

| Item | Content |
|---|---|
| Test Case ID | TC-162-04 |
| Test Scenario | [Positive] AC 3, AC 9: each request's suitability is judged against the attendance and needs entered for that venue |
| Pre-conditions | A boardroom that holds 14, with a whiteboard and the boardroom layout. |
| Test Steps | 1. Choose the event and the boardroom. <br> 2. Enter attendance 12, the whiteboard and the boardroom layout. |
| Test Data | Attendance 12 (the event expects 40) |
| Expected Result | The suitability panel reads Suitable. With the event's 40 it reads Not suitable: "Capacity 14 < attendance 40". |

**Automated by:** `tests/unit/suitability-panel.test.tsx` › "SCRUM-162 [AC3, AC9] TC-162-04: a breakout room is judged against the attendance and needs entered for that venue, not the event's"

### TC-162-05

| Item | Content |
|---|---|
| Test Case ID | TC-162-05 |
| Test Scenario | [Positive, Boundary] AC 4: the period is pre-filled from the event and may be longer, as long as it covers the event |
| Pre-conditions | — |
| Test Steps | 1. Choose the event. <br> 2. Change the end to 2:00 pm, or the start to 8:30 am, and submit. |
| Test Data | Exhibition Hall |
| Expected Result | Step 1: Start reads 9:10 am and End 12:45 pm on 10 Mar 2035 (SCRUM-188 AC1), both editable. Step 2: the request is created with the longer period. Exactly the event's period is accepted too. |

**Automated by:** `tests/unit/bookings.test.ts` › "SCRUM-162 [AC4] TC-162-05: a longer period that still covers the whole event is accepted"; `tests/integration/bookings.test.ts` › "SCRUM-162 [AC4] TC-162-05: a longer period that still covers the whole event is accepted"; `tests/unit/request-form.test.tsx` › "SCRUM-162 [AC4] TC-162-05: …"; `e2e/bookings.spec.ts` › "SCRUM-188 [AC1] TC-188-01, SCRUM-162 [AC4] TC-162-05, TC-162-06, TC-162-07: …"

### TC-162-06

| Item | Content |
|---|---|
| Test Case ID | TC-162-06 |
| Test Scenario | [Negative, Boundary] AC 4: a period that doesn't cover the event's whole period is refused |
| Pre-conditions | — |
| Test Steps | 1. Change the end to 12:30 pm. <br> 2. Send directly to the server a request starting at 9:30 am, one ending at 12:30 pm, and one on the next day. |
| Test Data | — |
| Expected Result | Step 1: "The requested period must cover the event's whole period: 10 Mar 2035, 9:10 am SGT to 10 Mar 2035, 12:45 pm SGT." and Submit is disabled. Step 2: the same message against the start field, and nothing is written. |

**Automated by:** `tests/unit/bookings.test.ts` › "SCRUM-162 [AC4] TC-162-06: a period that doesn't cover the event's whole period is refused against the start field, and nothing is written"; `tests/integration/bookings.test.ts` › "SCRUM-162 [AC4] TC-162-06: …"; `e2e/bookings.spec.ts` › "… TC-162-06 …"

### TC-162-07

| Item | Content |
|---|---|
| Test Case ID | TC-162-07 |
| Test Scenario | [Negative, Boundary] AC 4: the attendance defaults to the event's and must be a whole number from 1 to it |
| Pre-conditions | — |
| Test Steps | 1. Choose the event. <br> 2. Change the attendance to 121, then 30. <br> 3. Send 0, 1, 40 and 41 directly for an event expecting 40. |
| Test Data | — |
| Expected Result | Step 1: attendance reads 120. Step 2: 121 shows "The expected attendance for this venue must be from 1 to the event's 120." and disables Submit; 30 is accepted. Step 3: 1 and 40 are accepted and recorded; 0 is refused with "Attendance must be greater than zero." and 41 with the message above; nothing is written for either. |

**Automated by:** `tests/unit/bookings.test.ts` › "SCRUM-162 [AC4] TC-162-07: an attendance above the event's is refused …", "SCRUM-162 [AC4, AC9] TC-162-07, TC-162-14: an attendance of %i …" (3 tests) and "SCRUM-162 [AC4] TC-162-07: an attendance of 0 is refused before anything is read"; `tests/integration/bookings.test.ts` › "SCRUM-162 [AC4] TC-162-07: …"; `e2e/bookings.spec.ts` › "… TC-162-07 …"

### TC-162-08

| Item | Content |
|---|---|
| Test Case ID | TC-162-08 |
| Test Scenario | [Positive] AC 3, AC 5: Venue Staff decide each request separately, and rejecting, withdrawing or cancelling one booking leaves the event's others unchanged |
| Pre-conditions | The event has two Pending requests, at the Exhibition Hall and the Grand Auditorium. |
| Test Steps | 1. As `venuestaff@test.local`, reject the Exhibition Hall with a reason. |
| Test Data | Reason "Too small for the breakout." |
| Expected Result | The Exhibition Hall is Rejected; the Grand Auditorium is still Pending and undecided. Withdrawing one request (SCRUM-142) and cancelling one flagged booking (SCRUM-26) also touch that booking only. |

**Automated by:** `tests/integration/bookings.test.ts` › "SCRUM-162 [AC3, AC5] TC-162-08: Venue Staff decide each of an event's requests separately; rejecting one leaves the other unchanged". Withdrawing and cancelling one booking update it by its id only: `withdrawBookingRequest` and `resolveReconsiderationFlag` are covered by SCRUM-142's and SCRUM-26's cases.

### TC-162-09

| Item | Content |
|---|---|
| Test Case ID | TC-162-09 |
| Test Scenario | [Positive] AC 5: cancelling the event (SCRUM-82) or rejecting it (SCRUM-117) releases all its bookings, holds and pending requests in one operation |
| Pre-conditions | The event has several live bookings. |
| Test Steps | 1. Cancel the event, or reject it from Planning. |
| Test Data | — |
| Expected Result | Every Pending, Held and Approved booking of the event is Cancelled in the same transaction. |

**Automated by:** `tests/unit/cancel-event.test.ts` › "SCRUM-82 [AC3] TC-82-04: in the same operation, bookings, holds and requests, …"; `tests/integration/close-event.test.ts` (both of the event's bookings end Cancelled); `tests/unit/reject-planning.test.ts` › "SCRUM-117 [AC3] TC-117-03: in the same operation, venue bookings and requests, …". Each releases by the event, not one booking.

### TC-162-10

| Item | Content |
|---|---|
| Test Case ID | TC-162-10 |
| Test Scenario | [Concurrency] AC 6: two requests for the same venue and event submitted at the same moment create one |
| Pre-conditions | Real PostgreSQL. |
| Test Steps | 1. Fire the same request twice in parallel. |
| Test Data | — |
| Expected Result | Both report the same booking; one row exists. The database's `booking_one_per_venue_per_event` lets one insert in (ADR 0010). |

**Automated by:** `tests/integration/bookings.test.ts` › "SCRUM-50 [AC8] TC-50-08, SCRUM-162 [AC6] TC-162-10: two identical requests submitted at the same instant still leave one"; the database rule itself by `SCRUM-172 [AC9] TC-172-12`

### TC-162-11

| Item | Content |
|---|---|
| Test Case ID | TC-162-11 |
| Test Scenario | [Positive, Negative] AC 7: the event page lists every booking; the Organiser and Attendees see every approved venue |
| Pre-conditions | The event has an Approved booking at the Exhibition Hall, an Approved one at a breakout room and a Rejected one. |
| Test Steps | 1. Open the event's details as its Coordinator, then as its Organiser. <br> 2. Confirm the event, and open it as the Organiser. <br> 3. As `attendee@test.local`, browse and open the event. <br> 4. Ask for its bookings as another Organiser, an unassigned Coordinator, an Attendee and signed out. |
| Test Data | — |
| Expected Result | Step 1: **Venue bookings** lists all three, oldest first, each with its venue, attendance, period and status; an expired hold reads Expired. Step 2: Confirmed arrangements lists both approved venues. Step 3: both approved venues' names and locations show. Step 4: "Event not found." and nothing is read. |

**Automated by:** `tests/unit/event-readiness.test.ts` › "SCRUM-162 [AC7] TC-162-11: lists every booking of the event, …" and "SCRUM-81 [AC6] TC-81-06, SCRUM-162 [AC7] TC-162-11: when two approved bookings cover the event, the Organiser sees both venues, oldest first"; `tests/unit/readiness-actions.test.ts` › "SCRUM-162 [AC7] TC-162-11: $who sees every venue booking of the event" (2 tests) and "… is told the event was not found, and no booking is read" (4 tests); `tests/unit/attendee-events.test.ts` › "SCRUM-162 [AC7] TC-162-11: the detail read brings every approved venue's name and location, in the order requested" and "SCRUM-162 [AC7] TC-162-11, [Positive] AC: fetches every approved booking's venue, …"

### TC-162-12

| Item | Content |
|---|---|
| Test Case ID | TC-162-12 |
| Test Scenario | [Positive] AC 8: the Venue item lists each live booking and is complete when every one is approved for the event's whole period |
| Pre-conditions | Two Approved bookings covering the event, plus a Rejected, a Cancelled and an Expired one. |
| Test Steps | 1. Open the readiness checklist. |
| Test Data | — |
| Expected Result | Venue booking reads "Approved" and is complete; it lists the two approved venues, oldest first, each with its attendance. Ended bookings aren't listed. The Organiser sees the same states but not a flag's reason. |

**Automated by:** `tests/unit/event-readiness.test.ts` › "SCRUM-162 [AC8] TC-162-12: every booking approved for the whole event completes the item, …", "SCRUM-162 [AC8] TC-162-12: a rejected, cancelled or expired booking isn't listed …" and "SCRUM-162 [AC8], SCRUM-110 [AC6] TC-162-12: the Organiser sees each booking's state, but not a flag's internal reason"

### TC-162-13

| Item | Content |
|---|---|
| Test Case ID | TC-162-13 |
| Test Scenario | [Negative] AC 8: the Venue item stays incomplete while any booking is Pending or Held, an Approved one doesn't cover the event, one is flagged, or none is Approved |
| Pre-conditions | One Approved booking covering the event, beside each of: a Pending request; a live Held one; an Approved one ending at 1:00 pm on the day before; a flagged one. Also an event with only Pending and Held requests. |
| Test Steps | 1. Open the readiness checklist for each. |
| Test Data | — |
| Expected Result | Incomplete each time, so the event isn't ready to confirm. The item reads what stands in the way first: a flagged booking's status with the Needs Reconsideration badge and its reason (SCRUM-131 AC3), then "Held until … – confirm to secure", then "Pending", then "Approved for a different time". The hold keeps its Confirm and Release buttons and a pending request its Withdraw button, on its own line. |

**Automated by:** `tests/unit/event-readiness.test.ts` › "SCRUM-162 [AC8] TC-162-13: …" (4 tests); `tests/unit/booking-holds.test.ts` › "SCRUM-163 [AC6] TC-163-11, SCRUM-162 [AC8] TC-162-13: a pending request after an expired hold reads Pending; a live hold beside an approval keeps the venue incomplete"

### TC-162-14

| Item | Content |
|---|---|
| Test Case ID | TC-162-14 |
| Test Scenario | [Positive] AC 9: each request records, for that venue, the attendance, required facilities, accessibility features and layout entered by the Coordinator |
| Pre-conditions | — |
| Test Steps | 1. Request a breakout room for 30 people with a whiteboard, wheelchair access and the boardroom layout. |
| Test Data | — |
| Expected Result | The booking stores attendance 30, facilities [whiteboard], accessibility [wheelchair-access] and layout boardroom; Venue Staff see them on the request. |

**Automated by:** `tests/unit/bookings.test.ts` › "SCRUM-162 [AC4, AC9] TC-162-07, TC-162-14: an attendance of %i, from 1 to the event's, is accepted and recorded for this venue"; `tests/integration/bookings.test.ts` › "SCRUM-50 [AC1, AC2] TC-50-01: a request for a free period is created PENDING with everything the staff need" (the facilities and layout) and "SCRUM-162 [AC4] TC-162-07: …" (attendance 1 recorded); accessibility features by SCRUM-40's TC-40-03
