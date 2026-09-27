# SCRUM-37 — Reflect Bookings and Unavailability in Real Time: test cases

Story and acceptance criteria: [docs/backlog/SCRUM-37.md](../backlog/SCRUM-37.md).
Format and conventions: [README.md](README.md). Why the database, not the
application, stops a venue being booked and unavailable at once:
[ADR 0010, 2026-09-28 addendum](../adr/0010-database-prevents-venue-double-booking.md).

**Shared pre-conditions for every case:** the database is migrated and seeded,
the app is running, and the tester signs in as Venue Staff
(`venuestaff@test.local` / `Password123!`) unless the case says otherwise.
Cases use the Grand Auditorium on 10 Jan 2036, clear of anything seeded. Times
are Singapore time.

| ID | Type | Criterion | Automated |
|---|---|---|---|
| [TC-37-01](#tc-37-01) | Positive | AC 1 | Unit, e2e |
| [TC-37-02](#tc-37-02) | Positive | AC 2 | Unit, integration, e2e |
| [TC-37-03](#tc-37-03) | Negative | AC 2 (valid period, reason, Venue Staff only) | Unit, integration, e2e |
| [TC-37-04](#tc-37-04) | Negative | AC 3 | Integration, e2e |
| [TC-37-05](#tc-37-05) | Negative | AC 4 | Unit, integration, e2e |
| [TC-37-06](#tc-37-06) | Concurrency | AC 4 | Unit, integration |
| [TC-37-07](#tc-37-07) | Boundary | AC 5 | Integration, e2e |

---

### TC-37-01

| Item | Content |
|---|---|
| Test Case ID | TC-37-01 |
| Test Scenario | [Positive] AC 1: a newly approved booking appears on the calendar without inconsistency |
| Pre-conditions | A Coordinator has a pending request for the Grand Auditorium, 10 Jan 2036, 9:00 am to 1:00 pm. |
| Test Steps | 1. Approve the request in **Bookings**. <br> 2. As the Coordinator, open **Availability** for the Grand Auditorium on 10 Jan 2036. <br> 3. Leave a calendar open while someone else approves a request; wait 15 seconds. |
| Test Data | As above |
| Expected Result | Step 2 shows "Booked 9:00 am to 1:00 pm" straight away. Approving refreshes the calendar page on the server. Step 3: the open calendar picks the change up within 15 seconds without a reload. |

**Automated by:** `e2e/availability.spec.ts` › "SCRUM-37 AC2-5, SCRUM-36 AC3-5 — …" (approval step); `tests/unit/bookings.test.ts` › "SCRUM-37 AC1 — approving refreshes the availability calendar; rejecting does not need to". The 15-second refresh is **Manual**.

### TC-37-02

| Item | Content |
|---|---|
| Test Case ID | TC-37-02 |
| Test Scenario | [Positive] AC 2: Venue Staff record non-booking unavailability with a period and a reason |
| Pre-conditions | Nothing recorded or booked on the Grand Auditorium on 10 Jan 2036. |
| Test Steps | 1. Open **Availability**, choose the Grand Auditorium and 10 Jan 2036. <br> 2. Click **Record unavailability**. <br> 3. Enter the period and reason, and save. |
| Test Data | Start 10 Jan 2036 1:00 pm, End 5:00 pm, Reason Maintenance |
| Expected Result | "Recorded: Grand Auditorium is unavailable for that period." The calendar shows "Unavailable (maintenance) 1:00 pm to 5:00 pm", striped. The row stores the period, reason, note and who recorded it. |

**Automated by:** `tests/integration/unavailability.test.ts` › "SCRUM-37 AC2 — venue staff record a period and a reason, and it is saved"; `tests/unit/unavailability.test.ts` › "SCRUM-37 AC2 — venue staff record a period and a reason; the calendar is refreshed" and "…a blank note is stored as none"; `e2e/availability.spec.ts` › "SCRUM-37 AC2-5, SCRUM-36 AC3-5 — …"

### TC-37-03

| Item | Content |
|---|---|
| Test Case ID | TC-37-03 |
| Test Scenario | [Negative] AC 2: an invalid period or a missing reason is refused, and only Venue Staff can record |
| Pre-conditions | — |
| Test Steps | 1. Record with the end equal to the start. <br> 2. Record with no reason. <br> 3. As a Coordinator, open **Availability**. <br> 4. As an Organiser or Technical Support, open `/venues/availability`. |
| Test Data | — |
| Expected Result | Step 1: "The requested period is invalid: the end must be after the start." Step 2: "Choose a reason." Nothing is saved. Step 3: no **Record unavailability** button. Step 4: "Access denied". Called directly as any other role, the action refuses. |

**Automated by:** `tests/unit/unavailability.test.ts` › "SCRUM-37 AC2 — an end at or before the start…", "…a period with no reason is refused with field errors", "…only venue staff may record unavailability" and "SCRUM-37 — an unknown or retired venue is refused"; `tests/integration/unavailability.test.ts` › "SCRUM-37 AC2 — an end at or before the start is refused as an invalid period"; `tests/unit/auth.test.ts` › both "SCRUM-37 AC2 — …" cases; `e2e/availability.spec.ts` › "SCRUM-36 / SCRUM-37 — who can see the calendar and record unavailability"

### TC-37-04

| Item | Content |
|---|---|
| Test Case ID | TC-37-04 |
| Test Scenario | [Negative] AC 3: recorded unavailability blocks a request, and an approval, on the same terms as a booking |
| Pre-conditions | Maintenance recorded 10 Jan 2036, 1:00 pm to 5:00 pm (TC-37-02). |
| Test Steps | 1. As the Coordinator, request the Grand Auditorium 2:00 pm to 4:00 pm. <br> 2. Separately, approve a pending request made before the maintenance was recorded. |
| Test Data | As above |
| Expected Result | Step 1: "Grand Auditorium is unavailable for that period: unavailable (maintenance) from 10 Jan 2036, 1:00 pm to 10 Jan 2036, 5:00 pm." The same message shape as a booking clash, from the same lookup. Nothing is created. Step 2: "Conflicting: …", and the request stays pending. The database itself refuses the approval too. |

**Automated by:** `tests/integration/unavailability.test.ts` › "SCRUM-37 AC3 — a request over recorded maintenance is refused, with the same message shape as a booking clash", "…a pending request over recorded maintenance cannot then be approved" and "…the database alone refuses approving a booking over recorded maintenance"; `e2e/availability.spec.ts` › journey

### TC-37-05

| Item | Content |
|---|---|
| Test Case ID | TC-37-05 |
| Test Scenario | [Negative] AC 4: recording unavailability over an approved booking surfaces the clash instead of overwriting it |
| Pre-conditions | An approved booking 10 Jan 2036, 9:00 am to 1:00 pm (TC-37-01). |
| Test Steps | 1. Record maintenance 10:00 am to 12:00 pm. <br> 2. Record a period overlapping maintenance that is already recorded. |
| Test Data | As above |
| Expected Result | Step 1: "Not recorded: Grand Auditorium is already booked from 10 Jan 2036, 9:00 am to 10 Jan 2036, 1:00 pm." Nothing is saved and the booking is untouched. Step 2 is refused the same way ("unavailable (maintenance) …"). Written directly with SQL, the database refuses both. |

**Automated by:** `tests/integration/unavailability.test.ts` › "SCRUM-37 AC4 — recording over an approved booking surfaces the clash and saves nothing", "…recording over a period already recorded is refused too" and "…the database alone refuses maintenance written over an approved booking"; `tests/unit/unavailability.test.ts` › "SCRUM-37 AC4 — an overlapping approved booking is surfaced and nothing is saved"; `e2e/availability.spec.ts` › journey (last step)

### TC-37-06

| Item | Content |
|---|---|
| Test Case ID | TC-37-06 |
| Test Scenario | [Concurrency] AC 4: an approval and a maintenance record for overlapping periods at the same moment; exactly one is saved |
| Pre-conditions | Real PostgreSQL. A pending request 10:00 am to 2:00 pm on a test venue. |
| Test Steps | 1. Approve the request and record maintenance 12:00 pm to 4:00 pm at once. The test holds both after the application's own check until both have passed it, so only the database can separate them. |
| Test Data | — |
| Expected Result | One succeeds and the other is refused. Approved bookings plus recorded unavailability for that period total exactly one. With the occupancy triggers disabled, both succeed and the test fails (verified 2026-09-28). |

**Automated by:** `tests/integration/concurrency.test.ts` › "SCRUM-37 AC4 — an approval and a maintenance record for overlapping periods at the same moment: exactly one is saved"; `tests/unit/bookings.test.ts` › "SCRUM-37 AC4 — maintenance recorded at the same instant as an approval: the database refuses the approval, and it is returned as conflicting"; `tests/unit/unavailability.test.ts` › "SCRUM-37 AC4 — an approval that lands between the check and the write is caught by the database, and the clash is shown" and "…if the colliding row is not yet visible, a plain refusal is given"

### TC-37-07

| Item | Content |
|---|---|
| Test Case ID | TC-37-07 |
| Test Scenario | [Boundary] AC 5: unavailability that ends exactly as a requested period begins does not overlap it |
| Pre-conditions | Maintenance 10 Jan 2036, 1:00 pm to 5:00 pm. |
| Test Steps | 1. As the Coordinator, request 9:00 am to 1:00 pm. <br> 2. As Venue Staff, record maintenance starting exactly when an approved booking ends. |
| Test Data | As above |
| Expected Result | Both are accepted. The database accepts touching periods too. |

**Automated by:** `tests/integration/unavailability.test.ts` › "SCRUM-37 AC5 — maintenance ending exactly as a request begins does not clash", "…maintenance starting exactly as a booking ends is recorded" and "…the database accepts periods that only touch at an endpoint"; `e2e/availability.spec.ts` › journey
