# SCRUM-188 — Request a venue for exactly the event's period: test cases

Story and acceptance criteria: [docs/backlog/SCRUM-188.md](../backlog/SCRUM-188.md).
Format and conventions: [README.md](README.md). The rule is `isEventPeriod`
in [lib/schemas/booking.ts](../../lib/schemas/booking.ts), used by
`submitBookingRequest` ([app/(app)/bookings/actions.ts](../../app/(app)/bookings/actions.ts));
`eventBookingPeriod` gives the form the event's own period, which it shows
read-only and sends as the event's own instants.

**What this supersedes:** SCRUM-50 AC 1's rounding to the half hour
([TC-50-15](SCRUM-50.md#tc-50-15), all but step 3) and SCRUM-162 AC 4's
"must cover the event's whole period", which allowed a longer one
([TC-162-05](SCRUM-162.md#tc-162-05), [TC-162-06](SCRUM-162.md#tc-162-06)).
Their tests are replaced by the cases below. The attendance half of
SCRUM-162 AC 4 ([TC-162-07](SCRUM-162.md#tc-162-07)) and the readiness rule
that an Approved booking covers the event (SCRUM-110 AC 1, SCRUM-162 AC 8)
are unchanged.

**No flaky tests:** every period is a fixed instant years ahead, never "now +
N hours", and each suite that writes uses its own venues, location and day.
The two e2e specs whose `beforeAll` removes and recreates their events
(`e2e/bookings.spec.ts`, `e2e/availability.spec.ts`) run their tests in one
worker, so a parallel local run can't pull an event from under another test.

**Shared pre-conditions for every case:** the database is migrated and seeded
and the app is running. Signed in as `coordinator@test.local`
(`Password123!`). The event is in Planning, assigned to that Coordinator,
runs 9:10 am to 1:00 pm on 10 Mar 2035 and expects 120 (E2E Hall — Morning
Lecture). Times are Singapore time.

| ID | Type | Criterion | Automated |
|---|---|---|---|
| [TC-188-01](#tc-188-01) | Positive | AC 1 | Unit, e2e |
| [TC-188-02](#tc-188-02) | Positive, Boundary | AC 1, AC 2 | Unit, integration, e2e |
| [TC-188-03](#tc-188-03) | Negative, Boundary | AC 2 (longer) | Unit, integration |
| [TC-188-04](#tc-188-04) | Negative, Boundary | AC 2 (shorter or moved) | Unit, integration |
| [TC-188-05](#tc-188-05) | Positive | AC 3 | Integration |
| [TC-188-06](#tc-188-06) | Negative | AC 3 (booked in between) | Integration |

---

### TC-188-01

| Item | Content |
|---|---|
| Test Case ID | TC-188-01 |
| Test Scenario | [Positive] AC 1: choosing an event fills in the period exactly as its start and end, not rounded, and the period can't be edited |
| Pre-conditions | — |
| Test Steps | 1. Open **Request Venue**. <br> 2. Choose the event. <br> 3. Try to type into **Start** and **End**. <br> 4. Change **Expected attendance**. |
| Test Data | E2E Hall — Morning Lecture (10 Mar 2035, 9:10 am–1:00 pm, 120) |
| Expected Result | Step 2: Start reads 10 Mar 2035 9:10 am (not 9:00 am) and End 1:00 pm. Step 3: neither changes; both are read-only. Step 4: the attendance can still be changed (SCRUM-162 AC 4). |

**Automated by:** `tests/unit/request-form.test.tsx` › "SCRUM-188 [AC1] TC-188-01: with the event chosen, the period is its exact start and end and can't be edited; the attendance is a whole number from 1" and "SCRUM-188 [AC1] TC-188-01: the period is exactly the event's start and end, not rounded to the half hour"; `e2e/bookings.spec.ts` › "SCRUM-188 [AC1] TC-188-01, SCRUM-162 [AC4] TC-162-07: the period is exactly the event's and can't be edited; the attendance starts as the event's, and a larger one disables Submit"

### TC-188-02

| Item | Content |
|---|---|
| Test Case ID | TC-188-02 |
| Test Scenario | [Positive, Boundary] AC 1, AC 2: a request for exactly the event's period, off the half hour, is accepted and stored as it is |
| Pre-conditions | The Exhibition Hall is free that day. |
| Test Steps | 1. Choose the event, the theatre layout and the Exhibition Hall, and submit. <br> 2. As `venuestaff@test.local`, open **Booking requests**. |
| Test Data | Exhibition Hall |
| Expected Result | Step 1: "Request submitted". The booking row's start and end are the event's, 9:10 am and 1:00 pm. Step 2: the request reads "10 Mar 2035, 9:10 am SGT to 10 Mar 2035, 1:00 pm SGT". |

**Automated by:** `tests/unit/bookings.test.ts` › "SCRUM-188 [AC1, AC2] TC-188-02: exactly the event's period, not rounded to the half hour, is accepted and stored as it is"; `tests/integration/exact-event-period.test.ts` › "SCRUM-188 [AC3] TC-188-05: a venue search lists as free is requested for the same period and accepted, though bookings touch it at both ends" (the stored 10:10–11:50); `e2e/bookings.spec.ts` › "SCRUM-50 [AC2], SCRUM-52 [AC1-AC3], SCRUM-53 [AC1, AC4]: a coordinator requests, staff approve, and the venue becomes unavailable" (step 2)

### TC-188-03

| Item | Content |
|---|---|
| Test Case ID | TC-188-03 |
| Test Scenario | [Negative, Boundary] AC 2: a period longer than the event's is refused, and nothing is saved |
| Pre-conditions | An event from 2:10 pm to 3:50 pm on 1 Jun 2030. |
| Test Steps | Send directly to the server a request for: <br> 1. 2:00 pm to 4:00 pm, the half-hour rounding SCRUM-50 used. <br> 2. 2:09 pm to 3:50 pm. <br> 3. 2:10 pm to 3:51 pm. |
| Test Data | — |
| Expected Result | Each: "The requested period must be the event's: 1 Jun 2030, 2:10 pm SGT to 1 Jun 2030, 3:50 pm SGT." against the start field. No booking is written, and the venue isn't even read. |

**Automated by:** `tests/unit/bookings.test.ts` › "SCRUM-188 [AC2] TC-188-03: a longer period, %s, is refused against the start field, and nothing is written" (3 tests); `tests/integration/bookings.test.ts` › "SCRUM-188 [AC2] TC-188-03, TC-188-04: a period longer, shorter or other than the event's is refused against the start, and nothing is written"

### TC-188-04

| Item | Content |
|---|---|
| Test Case ID | TC-188-04 |
| Test Scenario | [Negative, Boundary] AC 2: a period shorter than the event's, or the same length at another time, is refused, and nothing is saved |
| Pre-conditions | As TC-188-03. |
| Test Steps | Send directly to the server a request for: <br> 1. 2:11 pm to 3:50 pm. <br> 2. 2:10 pm to 3:49 pm. <br> 3. 2:10 pm to 3:50 pm on 2 Jun 2030. |
| Test Data | — |
| Expected Result | As TC-188-03, with the same message. |

**Automated by:** `tests/unit/bookings.test.ts` › "SCRUM-188 [AC2] TC-188-04: a shorter or moved period, %s, is refused against the start field, and nothing is written" (3 tests); `tests/integration/bookings.test.ts` › "SCRUM-188 [AC2] TC-188-03, TC-188-04: a period longer, shorter or other than the event's is refused against the start, and nothing is written"

### TC-188-05

| Item | Content |
|---|---|
| Test Case ID | TC-188-05 |
| Test Scenario | [Positive] AC 3: a venue search lists as free for the event is requested for the same period and isn't refused; one it leaves out is refused the same way |
| Pre-conditions | An event from 10:10 to 11:50 on 19 Sep 2034. A room with no setup or turnaround has Approved bookings for other events from 8:00 to 10:10 and from 11:50 to 1:00 pm. A room with 15 minutes' setup and turnaround has an Approved booking from 11:50 to 1:00 pm. |
| Test Steps | 1. From the event, click **Find a venue**. <br> 2. Request the first room. <br> 3. Request the second room. |
| Test Data | — |
| Expected Result | Step 1: the search is for 10:10 to 11:50 and lists the first room, but not the second, whose booking occupies it from 11:35. The rounded 10:00 to 12:00 would have found the first room taken. Step 2: accepted, Pending, for 10:10 to 11:50. Step 3: "… is unavailable for that period: already booked …", and nothing is written. |

**Automated by:** `tests/integration/exact-event-period.test.ts` › "SCRUM-188 [AC3] TC-188-05: a venue search lists as free is requested for the same period and accepted, though bookings touch it at both ends" and "SCRUM-188 [AC3] TC-188-05: a venue that search leaves out over setup and turnaround is refused by the request the same way"

### TC-188-06

| Item | Content |
|---|---|
| Test Case ID | TC-188-06 |
| Test Scenario | [Negative] AC 3: a venue booked after search listed it as free is refused when requested, and nothing is written |
| Pre-conditions | As TC-188-05, with no bookings at the first room. |
| Test Steps | 1. From the event, click **Find a venue**. <br> 2. Another event's booking at the first room, 11:00 to 11:30, is approved. <br> 3. Request the first room. |
| Test Data | — |
| Expected Result | Step 1: the first room is listed. Step 3: "… is unavailable for that period: already booked …", and the event has no booking. |

**Automated by:** `tests/integration/exact-event-period.test.ts` › "SCRUM-188 [AC3] TC-188-06: a venue booked after the search listed it as free is refused, and nothing is written"
