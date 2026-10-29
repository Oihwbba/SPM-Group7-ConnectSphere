# SCRUM-74 — Be prevented from registering for a full event: test cases

Story and acceptance criteria: [docs/backlog/SCRUM-74.md](../backlog/SCRUM-74.md).
Format and conventions: [README.md](README.md). Capacity is the event's
expected attendance, counted in
[lib/registration-state.ts](../../lib/registration-state.ts).
`registerForEvent` locks the event row before counting, so two Attendees can't
both take the last place (README, "Two rules the database cannot enforce").

Written on 2026-10-12 from the acceptance criteria, then mapped to the tests
that already existed (SCRUM-176). The tests predate the `SCRUM-n [ACx] TC-n-xx`
title format, so each case names them by their current titles.

**Shared pre-conditions for every case:** the database is migrated and seeded
and the app is running. Signed in as `attendee@test.local` (`Password123!`).

| ID | Type | Criterion | Automated |
|---|---|---|---|
| [TC-74-01](#tc-74-01) | Positive | AC 1 | Unit |
| [TC-74-02](#tc-74-02) | Positive | AC 2 | Unit, e2e |
| [TC-74-03](#tc-74-03) | Concurrency | AC 3 | Integration |
| [TC-74-04](#tc-74-04) | Boundary | AC 4 | Unit, e2e |
| [TC-74-05](#tc-74-05) | Negative | AC 5 | Unit, e2e |
| [TC-74-06](#tc-74-06) | Positive | AC 2 | Unit, integration, e2e |

---

### TC-74-01

| Item | Content |
|---|---|
| Test Case ID | TC-74-01 |
| Test Scenario | [Positive] AC 1: an event's capacity is its expected attendance |
| Pre-conditions | A Confirmed event with an expected attendance of 50. |
| Test Steps | 1. Open the event. |
| Test Data | Expected attendance 50 |
| Expected Result | Its capacity is 50; there is no separate capacity value. An event with no attendance has no places, without an error. |

**Automated by:** `tests/unit/registration-state.test.ts` › "SCRUM-74 [AC1] TC-74-01: returns expectedAttendance directly", "SCRUM-74 [AC1] TC-74-01: treats a null expectedAttendance as zero capacity rather than throwing"; `tests/unit/registration-actions.test.ts` › "SCRUM-74 [AC1] TC-74-01: [Positive] registers with the fields SCRUM-73's own text names — no separate capacity value read"

### TC-74-02

| Item | Content |
|---|---|
| Test Case ID | TC-74-02 |
| Test Scenario | [Positive] AC 2: registering with places left takes exactly one |
| Pre-conditions | A Confirmed event with 40 places left. |
| Test Steps | 1. Click **Register**. |
| Test Data | The event |
| Expected Result | The registration is accepted, and the event has 39 places left. |

**Automated by:** `tests/unit/registration-actions.test.ts` › "SCRUM-73 [AC1, AC2, AC4] TC-73-01, SCRUM-74 [AC2] TC-74-02: [Negative] SCRUM-74 AC: registration is accepted with capacity remaining, decreasing it by exactly one"; `tests/unit/registration-state.test.ts` › "SCRUM-72 [AC3] TC-72-02, SCRUM-74 [AC2] TC-74-02: subtracts active registrations from the total"; `e2e/registration.spec.ts` › "SCRUM-73 [AC1, AC2, AC4] TC-73-01, SCRUM-74 [AC2] TC-74-02: registering shows as registered immediately, and capacity decreases by one"

### TC-74-03

| Item | Content |
|---|---|
| Test Case ID | TC-74-03 |
| Test Scenario | [Concurrency] AC 3: two Attendees register for the last place at the same moment |
| Pre-conditions | A Confirmed event with one place left; two Attendees ready. |
| Test Steps | 1. Both click **Register** at the same moment. |
| Test Data | The event |
| Expected Result | Exactly one is Registered. The other is refused with "This event is full." |

**Automated by:** `tests/integration/concurrency.test.ts` › "SCRUM-74 [AC3] TC-74-03: exactly one of two simultaneous registrations for the last place succeeds"

### TC-74-04

| Item | Content |
|---|---|
| Test Case ID | TC-74-04 |
| Test Scenario | [Boundary] AC 4: a full event shows as Full with Register unavailable; one place left is still open |
| Pre-conditions | A full Confirmed event, and one with one place left. |
| Test Steps | 1. Open the full event. <br> 2. Open the other. |
| Test Data | The two events |
| Expected Result | The full event shows "Full" with no way to register. The other is open. Remaining places never show below zero, even if more are registered than the capacity. |

**Automated by:** `tests/unit/registration-state.test.ts` › "SCRUM-72 [AC6] TC-72-05, SCRUM-74 [AC4] TC-74-04: [Negative] remaining capacity zero → FULL", "SCRUM-72 [AC6] TC-72-05, SCRUM-74 [AC4] TC-74-04: [Boundary] one remaining place → OPEN, not FULL", "SCRUM-74 [AC4] TC-74-04: Boundary: exactly at capacity returns zero, not negative", "SCRUM-74 [AC4] TC-74-04: Boundary: over capacity (a pre-existing data anomaly) still floors at zero"; `e2e/attendee-events.spec.ts` › "SCRUM-72 [AC6] TC-72-05, SCRUM-74 [AC4] TC-74-04: opening a full event's detail page shows it as full with the register action disabled"

### TC-74-05

| Item | Content |
|---|---|
| Test Case ID | TC-74-05 |
| Test Scenario | [Negative] AC 5: a registration sent directly for a full event is refused |
| Pre-conditions | A full Confirmed event. |
| Test Steps | 1. Send a registration for it directly. |
| Test Data | The event's id |
| Expected Result | Refused with "This event is full." and no registration is created. |

**Automated by:** `tests/unit/registration-actions.test.ts` › "SCRUM-74 [AC5] TC-74-05: [Negative] SCRUM-74 AC: a full event refuses a direct registration request and creates nothing"; `e2e/registration.spec.ts` › "SCRUM-74 [AC5] TC-74-05: a full event refuses direct registration and shows no register action"

### TC-74-06

| Item | Content |
|---|---|
| Test Case ID | TC-74-06 |
| Test Scenario | [Positive] AC 2: withdrawing from a full event frees the place at once |
| Pre-conditions | A full event, with this Attendee Registered. |
| Test Steps | 1. Withdraw. <br> 2. As another Attendee, register. |
| Test Data | The event |
| Expected Result | The place is free immediately, and the other Attendee's registration is accepted. Withdrawal locks the event too, so it can't interleave with a registration. |

**Automated by:** `tests/unit/registration-actions.test.ts` › "SCRUM-74 [AC2] TC-74-06, SCRUM-77 [AC1, AC7] TC-77-01, TC-77-09: SCRUM-74 AC, SCRUM-77 [AC1, AC7] TC-77-01, TC-77-09: [Positive] withdrawing a REGISTERED registration flips it to WITHDRAWN, keeping the row", "SCRUM-74 [AC2] TC-74-06: [Positive] SCRUM-74 AC: withdrawal locks the Event row before writing, so a concurrent registration for the freed place cannot interleave"; `tests/integration/concurrency.test.ts` › "SCRUM-74 [AC2] TC-74-06: withdrawing the sole registration on a full event lets a new registration succeed"; `e2e/registration.spec.ts` › "SCRUM-74 [AC2] TC-74-06: withdrawing reopens capacity immediately and lets another attendee register"
