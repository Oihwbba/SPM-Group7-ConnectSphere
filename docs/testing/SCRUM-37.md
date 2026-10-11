# SCRUM-37 — Reflect Bookings and Unavailability in Real Time: test cases

Story and acceptance criteria: [docs/backlog/SCRUM-37.md](../backlog/SCRUM-37.md).
Format and conventions: [README.md](README.md). Why the database, not the
application, stops a venue being booked and unavailable at once:
[ADR 0010, 2026-09-28 addendum](../adr/0010-database-prevents-venue-double-booking.md).

> **Week 7 (SCRUM-158).** AC 1 lists the reasons as it did before the 7 Oct change, and AC 3 refuses an overlap with an Approved booking. The reason list has already changed: since SCRUM-172 (AC 5) the reasons are Maintenance, Equipment failure, Renovation, Safety concern and Other, and Damaged and Closure are refused (`lib/schemas/unavailability.ts`). SCRUM-161 replaces AC 3: unavailability may be recorded over future bookings, which are flagged Needs Reconsideration instead of the record being refused. Until SCRUM-161 lands, the action still refuses it, and the cases below test that behaviour.

**Shared pre-conditions for every case:** the database is migrated and seeded,
the app is running, and the tester signs in as Venue Staff
(`venuestaff@test.local` / `Password123!`) unless the case says otherwise.
Cases use the Grand Auditorium on 10 Jan 2036, clear of anything seeded. Times
are Singapore time.

| ID | Type | Criterion | Automated |
|---|---|---|---|
| [TC-37-01](#tc-37-01) | — | Moved to [TC-36-09](SCRUM-36.md#tc-36-09) | — |
| [TC-37-02](#tc-37-02) | Positive | AC 1, AC 2 (the calendar shows it) | Unit, integration, e2e |
| [TC-37-03](#tc-37-03) | Negative | AC 1, AC 6 (valid period, reason, Venue Staff only) | Unit, integration, e2e |
| [TC-37-04](#tc-37-04) | Negative | AC 2 | Integration, e2e |
| [TC-37-05](#tc-37-05) | Negative | AC 3 | Unit, integration, e2e |
| [TC-37-06](#tc-37-06) | Concurrency | AC 4 | Unit, integration |
| [TC-37-07](#tc-37-07) | Boundary | AC 5 | Integration, e2e |

---

### TC-37-01

Moved to [TC-36-09](SCRUM-36.md#tc-36-09) on 2026-10-09. A newly approved booking showing on the calendar is SCRUM-36 AC2, not a SCRUM-37 criterion. The ID is kept so earlier references still resolve.

### TC-37-02

| Item | Content |
|---|---|
| Test Case ID | TC-37-02 |
| Test Scenario | [Positive] AC 1, AC 2: Venue Staff record non-booking unavailability with a period and a reason, and the calendar shows it |
| Pre-conditions | Nothing recorded or booked on the Grand Auditorium on 10 Jan 2036. |
| Test Steps | 1. Open **Availability**, choose the Grand Auditorium and 10 Jan 2036. <br> 2. Click **Record unavailability**. <br> 3. Enter the period and reason, and save. |
| Test Data | Start 10 Jan 2036 1:00 pm, End 5:00 pm, Reason Maintenance |
| Expected Result | "Recorded: Grand Auditorium is unavailable for that period." The calendar shows "Unavailable (maintenance) 1:00 pm to 5:00 pm", striped. The row stores the period, reason, note and who recorded it. |

**Automated by:** `tests/integration/unavailability.test.ts` › "SCRUM-37 [AC1] TC-37-02: venue staff record a period and a reason, and it is saved"; `tests/unit/unavailability.test.ts` › "SCRUM-37 [AC1, AC2] TC-37-02: venue staff record a period and a reason; the calendar is refreshed" and "SCRUM-37 [AC1] TC-37-02: a blank note is stored as none"; `e2e/availability.spec.ts` › "SCRUM-37 [AC1-AC5], SCRUM-36 [AC2, AC3, AC5]: maintenance is recorded, seen, refused over, sat flush against a booking, and never overwrites one"

### TC-37-03

| Item | Content |
|---|---|
| Test Case ID | TC-37-03 |
| Test Scenario | [Negative] AC 1, AC 6: an invalid period or a missing reason is refused, and only Venue Staff can record |
| Pre-conditions | — |
| Test Steps | 1. Record with the end equal to the start. <br> 2. Record with no reason. <br> 3. As a Coordinator, open **Availability**. <br> 4. As an Organiser or Technical Support, open `/venues/availability`. |
| Test Data | — |
| Expected Result | Step 1: "The requested period is invalid: the end must be after the start." Step 2: "Choose a reason." Nothing is saved. Step 3: no **Record unavailability** button. Step 4: "Access denied". Called directly as any other role, the action refuses. |

**Automated by:** `tests/unit/unavailability.test.ts` › "SCRUM-37 [AC1] TC-37-03: an end at or before the start is refused as an invalid period", "SCRUM-37 [AC1] TC-37-03: a period with no reason is refused with field errors", "SCRUM-37 [AC6] TC-37-03: only venue staff may record unavailability" and "SCRUM-37 [AC1] TC-37-03: an unknown or retired venue is refused"; `tests/integration/unavailability.test.ts` › "SCRUM-37 [AC1] TC-37-03: an end at or before the start is refused as an invalid period"; `tests/unit/auth.test.ts` › both "SCRUM-37 [AC6] TC-37-03: …" cases; `e2e/availability.spec.ts` › "SCRUM-36, SCRUM-37 TC-36-07: who can see the calendar and record unavailability"

### TC-37-04

| Item | Content |
|---|---|
| Test Case ID | TC-37-04 |
| Test Scenario | [Negative] AC 2: recorded unavailability blocks a request, and an approval, on the same terms as a booking |
| Pre-conditions | Maintenance recorded 10 Jan 2036, 1:00 pm to 5:00 pm (TC-37-02). |
| Test Steps | 1. As the Coordinator, request the Grand Auditorium 2:00 pm to 4:00 pm. <br> 2. Separately, approve a pending request made before the maintenance was recorded. |
| Test Data | As above |
| Expected Result | Step 1: "Grand Auditorium is unavailable for that period: unavailable (maintenance) from 10 Jan 2036, 1:00 pm to 10 Jan 2036, 5:00 pm." The same message shape as a booking clash, from the same lookup. Nothing is created. Step 2: "Conflicting: …", and the request stays pending. The database itself refuses the approval too. |

**Automated by:** `tests/integration/unavailability.test.ts` › "SCRUM-37 [AC2] TC-37-04: a request over recorded maintenance is refused, with the same message shape as a booking clash", "SCRUM-37 [AC2] TC-37-04: a pending request over recorded maintenance cannot then be approved" and "SCRUM-37 [AC2] TC-37-04: the database alone refuses approving a booking over recorded maintenance"; `e2e/availability.spec.ts` › journey

### TC-37-05

| Item | Content |
|---|---|
| Test Case ID | TC-37-05 |
| Test Scenario | [Negative] AC 3: recording unavailability over an approved booking surfaces the clash instead of overwriting it |
| Pre-conditions | An approved booking 10 Jan 2036, 9:00 am to 1:00 pm (TC-36-09). |
| Test Steps | 1. Record maintenance 10:00 am to 12:00 pm. <br> 2. Record a period overlapping maintenance that is already recorded. |
| Test Data | As above |
| Expected Result | Step 1: "Not recorded: Grand Auditorium is already booked from 10 Jan 2036, 9:00 am to 10 Jan 2036, 1:00 pm." Nothing is saved and the booking is untouched. Step 2 is refused the same way ("unavailable (maintenance) …"). Written directly with SQL, the database refuses step 2. Since SCRUM-172 it accepts step 1, so that SCRUM-161 can save unavailability over a booking and flag the booking; until SCRUM-161 the refusal in step 1 is the action's. |

**Automated by:** `tests/integration/unavailability.test.ts` › "SCRUM-37 [AC3] TC-37-05: recording over an approved booking surfaces the clash and saves nothing", "SCRUM-37 [AC3] TC-37-05: recording over a period already recorded is refused too" and "SCRUM-172 [AC9] TC-172-11: the database accepts unavailability written over an approved booking"; `tests/unit/unavailability.test.ts` › "SCRUM-37 [AC3] TC-37-05: an overlapping approved booking is surfaced and nothing is saved"; `e2e/availability.spec.ts` › journey (last step)

### TC-37-06

| Item | Content |
|---|---|
| Test Case ID | TC-37-06 |
| Test Scenario | [Concurrency] AC 4: an approval and a maintenance record for overlapping periods at the same moment; exactly one is saved |
| Pre-conditions | Real PostgreSQL. A pending request 10:00 am to 2:00 pm on a test venue. |
| Test Steps | 1. Approve the request and record maintenance 12:00 pm to 4:00 pm at once. The test holds both after the application's own check until both have passed it, so only the database's locks can separate them. |
| Test Data | — |
| Expected Result | One succeeds and the other is refused. Approved bookings plus recorded unavailability for that period total exactly one. With the occupancy triggers disabled, both succeed and the test fails (verified 2026-09-28). Since SCRUM-172 the database accepts unavailability over a booking, so recording runs its check and its write under the venue lock that an approval's trigger also takes: the approval waits for it, then is refused. |

**Automated by:** `tests/integration/concurrency.test.ts` › "SCRUM-37 [AC4] TC-37-06: an approval and a maintenance record for overlapping periods at the same moment: exactly one is saved"; `tests/unit/bookings.test.ts` › "SCRUM-37 [AC4] TC-37-06: maintenance recorded at the same instant as an approval: the database refuses the approval, and it is returned as conflicting"; `tests/unit/unavailability.test.ts` › "SCRUM-37 [AC4] TC-37-06: the venue is locked before the check and the write, so an approval can't land between them"

### TC-37-07

| Item | Content |
|---|---|
| Test Case ID | TC-37-07 |
| Test Scenario | [Boundary] AC 5: unavailability that ends exactly as a requested period begins does not overlap it |
| Pre-conditions | Maintenance 10 Jan 2036, 1:00 pm to 5:00 pm. |
| Test Steps | 1. As the Coordinator, request 9:00 am to 1:00 pm. <br> 2. As Venue Staff, record maintenance starting exactly when an approved booking ends. |
| Test Data | As above |
| Expected Result | Both are accepted. The database accepts touching periods too. |

**Automated by:** `tests/integration/unavailability.test.ts` › "SCRUM-37 [AC5] TC-37-07: maintenance ending exactly as a request begins does not clash", "SCRUM-37 [AC5] TC-37-07: maintenance starting exactly as a booking ends is recorded" and "SCRUM-37 [AC5] TC-37-07: the database accepts periods that only touch at an endpoint"; `e2e/availability.spec.ts` › journey
