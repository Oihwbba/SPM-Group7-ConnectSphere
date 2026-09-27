# SCRUM-50 — Submit Venue Booking Request: test cases

Story and acceptance criteria: [docs/backlog/SCRUM-50.md](../backlog/SCRUM-50.md).
Format and conventions: [README.md](README.md). The overlap rule itself is
[lib/period.ts](../../lib/period.ts); why the database enforces it is
[ADR 0010](../adr/0010-database-prevents-venue-double-booking.md).

**Shared pre-conditions for every case:** the database is migrated and seeded
(`npm run db:deploy && npm run db:seed`), the app is running, and the tester
signs in as an Event Coordinator (`coordinator@test.local` / `Password123!`)
unless the case says otherwise. Cases use the Exhibition Hall in 2035, so
nothing seeded overlaps them. Times are Singapore time.

| ID | Type | Criterion | Automated |
|---|---|---|---|
| [TC-50-01](#tc-50-01) | Positive | AC 1, AC 2 | Unit, integration, e2e |
| [TC-50-02](#tc-50-02) | Negative | AC 3 | Unit, integration, e2e |
| [TC-50-03](#tc-50-03) | Negative | AC 3 (unavailability) | Integration |
| [TC-50-04](#tc-50-04) | Positive | AC 3 (pending blocks nobody) | Unit, integration |
| [TC-50-05](#tc-50-05) | Boundary | AC 4 | Unit, integration, e2e |
| [TC-50-06](#tc-50-06) | Negative, Boundary | AC 5 | Unit, integration, e2e |
| [TC-50-07](#tc-50-07) | Negative | AC 6 | Unit, integration, e2e |
| [TC-50-08](#tc-50-08) | Concurrency | AC 6 | Unit, integration |
| [TC-50-09](#tc-50-09) | Negative | Coordinators only, own events only | Unit, integration, e2e |

---

### TC-50-01

| Item | Content |
|---|---|
| Test Case ID | TC-50-01 |
| Test Scenario | [Positive] AC 1, AC 2: a request for a free period is created Pending, with everything Venue Staff need |
| Pre-conditions | Signed in as a Coordinator. No approved booking or unavailability on the Exhibition Hall overlaps the test period. |
| Test Steps | 1. Open **Request Venue**. <br> 2. Choose the event, the venue, start and end, attendance and notes. <br> 3. Click **Submit request**. |
| Test Data | Event: Approved — Research Symposium <br> Venue: Exhibition Hall <br> Start: 2035-03-10 09:00 <br> End: 2035-03-10 13:00 <br> Attendance: 120 |
| Expected Result | "Request submitted — pending a Venue Staff decision" with the venue and times. One PENDING booking exists holding the venue, times, attendance, facilities, layout, notes and the requesting coordinator. |

**Automated by:** `tests/integration/bookings.test.ts` › "SCRUM-50 AC1 & AC2 — a request for a free period is created PENDING with everything the staff need"; `tests/unit/bookings.test.ts` › "SCRUM-50 AC2 — a request for a free period is created PENDING"; `e2e/bookings.spec.ts` › "SCRUM-50 AC2, SCRUM-52 AC1-3, SCRUM-53 AC1 & AC3 — …"

### TC-50-02

| Item | Content |
|---|---|
| Test Case ID | TC-50-02 |
| Test Scenario | [Negative] AC 3: a request overlapping an approved booking is refused and nothing is created |
| Pre-conditions | TC-50-01's request has been approved by Venue Staff (see TC-53-01). |
| Test Steps | 1. Open **Request Venue**. <br> 2. Request the Exhibition Hall for a period overlapping the approved booking. <br> 3. Click **Submit request**. |
| Test Data | Event: Planning — Freshman Orientation <br> Start: 2035-03-10 11:00 <br> End: 2035-03-10 15:00 |
| Expected Result | "Request not submitted. Exhibition Hall is unavailable for that period: already booked from 10 Mar 2035, 9:00 am to 10 Mar 2035, 1:00 pm." No new booking row exists. The other booking's event is not named. |

**Automated by:** `tests/integration/bookings.test.ts` › "SCRUM-50 AC3 — a request overlapping an approved booking is refused and nothing is written"; `tests/unit/bookings.test.ts` › "SCRUM-50 AC3 — a venue already booked for part of the period refuses the request and names the clash"; `tests/unit/period.test.ts` › every "SCRUM-50 AC3 — …" case (overlapping, contained, identical, shared start, one minute); `e2e/bookings.spec.ts` › journey (screenshot attached to the report)

### TC-50-03

| Item | Content |
|---|---|
| Test Case ID | TC-50-03 |
| Test Scenario | [Negative] AC 3: a request overlapping recorded unavailability (maintenance) is refused |
| Pre-conditions | Seeded maintenance on Seminar Room 2.1 (`vun_seminar_maintenance`). |
| Test Steps | 1. Request Seminar Room 2.1 for a period inside the maintenance window. |
| Test Data | The seeded maintenance period |
| Expected Result | "…is unavailable for that period: unavailable (maintenance) from … to …". Nothing is created. |

**Automated by:** `tests/integration/bookings.test.ts` › "SCRUM-50 AC3 — a request overlapping recorded unavailability (maintenance) is refused"; `tests/unit/venue-availability.test.ts` › "SCRUM-50 AC3 — merges bookings and unavailability, earliest first"

### TC-50-04

| Item | Content |
|---|---|
| Test Case ID | TC-50-04 |
| Test Scenario | [Positive] AC 3: a pending request by another coordinator does not make the venue unavailable |
| Pre-conditions | Another coordinator has a PENDING (not approved) request for the period. |
| Test Steps | 1. As the first coordinator, request the same venue and period. |
| Test Data | `coordinator2@test.local` then `coordinator@test.local`, same venue, same period |
| Expected Result | The second request is also created Pending. Staff choose between them. |

**Automated by:** `tests/integration/bookings.test.ts` › "SCRUM-50 AC3 — a PENDING request by another coordinator does not block a new request"; `tests/unit/venue-availability.test.ts` › "SCRUM-50 AC3 — asks only for APPROVED bookings that overlap the period — a pending request blocks nobody"

### TC-50-05

| Item | Content |
|---|---|
| Test Case ID | TC-50-05 |
| Test Scenario | [Boundary] AC 4: periods touching at an endpoint do not overlap |
| Pre-conditions | An approved booking 09:00–13:00 (TC-50-02). |
| Test Steps | 1. Request 13:00–15:00. <br> 2. Separately, request a period ending at exactly 09:00. |
| Test Data | Start 2035-03-10 13:00, End 2035-03-10 15:00 |
| Expected Result | Both requests are created Pending. |

**Automated by:** `tests/integration/bookings.test.ts` › "SCRUM-50 AC4 — a period beginning exactly as an approved booking ends is accepted" and "…ending exactly as an approved booking begins is accepted"; `tests/unit/period.test.ts` › every "SCRUM-50 AC4 — …" case; `e2e/bookings.spec.ts` › journey (last step)

### TC-50-06

| Item | Content |
|---|---|
| Test Case ID | TC-50-06 |
| Test Scenario | [Negative, Boundary] AC 5: an end earlier than or equal to the start is an invalid period |
| Pre-conditions | — |
| Test Steps | 1. Enter an end before the start and submit. <br> 2. Enter an end equal to the start and submit. |
| Test Data | Start 2035-04-01 15:00, End 2035-04-01 09:00; then Start = End = 15:00 |
| Expected Result | "The requested period is invalid: the end must be after the start." Nothing is created, and no other check runs first. One minute after the start is valid. |

**Automated by:** `tests/integration/bookings.test.ts` › "SCRUM-50 AC5 — an end before the start…" and "…an end equal to the start is refused as an invalid period"; `tests/unit/bookings.test.ts` › "SCRUM-50 AC5 — an end before or equal to the start is reported as an invalid period"; `tests/unit/period.test.ts` › every "SCRUM-50 AC5 — …" case; `e2e/bookings.spec.ts` › "SCRUM-50 AC5 — an end before the start is reported as an invalid period"

### TC-50-07

| Item | Content |
|---|---|
| Test Case ID | TC-50-07 |
| Test Scenario | [Negative] AC 6: a coordinator who already has a pending request for the same venue and an overlapping period is shown it, and nothing is created, whichever event they ask under |
| Pre-conditions | TC-50-01 is still pending. |
| Test Steps | 1. Click **Submit request** again with the same details. <br> 2. Choose a different event and an overlapping period (11:00–15:00) at the same venue, and submit. |
| Test Data | As TC-50-01 |
| Expected Result | "You already have a pending request for this venue and period" with the existing request's details, both times. Still one booking row. The database's `booking_no_duplicate_pending_request` constraint enforces the same rule, keyed on the coordinator. A later, non-overlapping period is a new request. |

**Automated by:** `tests/integration/bookings.test.ts` › "SCRUM-50 AC6 — submitting the same request twice leaves one request and shows the existing one" "…the same coordinator asking again under a different event is shown the existing request", "…the database itself refuses a second overlapping pending request from the same coordinator, whatever the event" and "…a pending request for a different, non-overlapping period is a new request"; `tests/unit/bookings.test.ts` › "SCRUM-50 AC6 — this coordinator's overlapping pending request for the same venue is returned instead of a new one, whatever its event"; `e2e/bookings.spec.ts` › journey

### TC-50-08

| Item | Content |
|---|---|
| Test Case ID | TC-50-08 |
| Test Scenario | [Concurrency] AC 6: two identical requests submitted at the same instant leave one |
| Pre-conditions | Real PostgreSQL. |
| Test Steps | 1. Fire the same request twice in parallel. |
| Test Data | As TC-50-01 |
| Expected Result | Both calls report the same booking id and one row exists. `booking_no_duplicate_pending_request` lets one insert in; a deadlock between the two is retried once (ADR 0010). |

**Automated by:** `tests/integration/bookings.test.ts` › "SCRUM-50 AC6 — two identical requests submitted at the same instant still leave one"; `tests/unit/bookings.test.ts` › "SCRUM-50 AC6 — a duplicate that races past the check…" and "…a deadlock between two identical submissions is retried once and then resolved"

### TC-50-09

| Item | Content |
|---|---|
| Test Case ID | TC-50-09 |
| Test Scenario | [Negative] Only Event Coordinators may request, and only for approved events they can act on |
| Pre-conditions | — |
| Test Steps | 1. Sign in as Venue Staff and open `/bookings/new` by typing it. <br> 2. As a Coordinator, check the event list. |
| Test Data | `venuestaff@test.local`; `coordinator2@test.local` |
| Expected Result | Venue Staff see "Access denied". The event list holds only APPROVED or PLANNING events the coordinator may act on. Another coordinator's event is refused as "Event not found." |

**Automated by:** `e2e/bookings.spec.ts` › "SCRUM-50 — venue staff typing the request form's address are refused by the server"; `tests/unit/auth.test.ts` › the three "SCRUM-50 — …" cases; `tests/unit/bookings.test.ts` › "SCRUM-50 — every role except Event Coordinator is refused…", "…an event that does not exist, or is another coordinator's, reads as not found", "…a venue cannot be requested for an event that has not been approved"; `tests/integration/bookings.test.ts` › "SCRUM-50 — the form offers only approved events the coordinator may act on, exactly as can() allows"
