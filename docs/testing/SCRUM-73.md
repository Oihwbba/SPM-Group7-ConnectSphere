# SCRUM-73 — Register for an event: test cases

Story and acceptance criteria: [docs/backlog/SCRUM-73.md](../backlog/SCRUM-73.md).
Format and conventions: [README.md](README.md). Registering is
`registerForEvent` in
[app/(app)/events/registration-actions.ts](<../../app/(app)/events/registration-actions.ts>),
which locks the event row so the capacity check and the write can't be split
(SCRUM-74).

Written on 2026-10-12 from the acceptance criteria, then mapped to the tests
that already existed (SCRUM-176). The tests predate the `SCRUM-n [ACx] TC-n-xx`
title format, so each case names them by their current titles.

**AC 6:** registration opens at confirmation; a later opening time, and the
close, are set through SCRUM-75 (TC-75-01 to TC-75-14). AC 7's return to
Planning is SCRUM-128's (TC-128-05); the refusal itself is tested here
(TC-73-07).

**Shared pre-conditions for every case:** the database is migrated and seeded
and the app is running. Signed in as `attendee@test.local` (`Password123!`).
The seed has a Confirmed event with registration open and places left.

| ID | Type | Criterion | Automated |
|---|---|---|---|
| [TC-73-01](#tc-73-01) | Positive | AC 1, AC 2, AC 4 | Unit, e2e |
| [TC-73-02](#tc-73-02) | Negative | AC 3 | Unit |
| [TC-73-03](#tc-73-03) | Negative | AC 5 | Unit |
| [TC-73-04](#tc-73-04) | Boundary | AC 5 | Unit |
| [TC-73-05](#tc-73-05) | Positive | AC 6 | Unit |
| [TC-73-06](#tc-73-06) | Positive | AC 3 | Unit |
| [TC-73-07](#tc-73-07) | Negative | AC 7 | Unit |
| [TC-73-08](#tc-73-08) | Negative | Only an Attendee | Unit |

---

### TC-73-01

| Item | Content |
|---|---|
| Test Case ID | TC-73-01 |
| Test Scenario | [Positive] AC 1, AC 2, AC 4: registering takes a place at once, with no approval step |
| Pre-conditions | Signed in as the Attendee, on a Confirmed event with registration open and 40 places left. |
| Test Steps | 1. Click **Register**. |
| Test Data | The seeded open event |
| Expected Result | The Attendee immediately sees themselves as Registered; there is no approval queue. The event now has 39 places left. |

**Automated by:** `tests/unit/registration-actions.test.ts` › "[Positive] AC: registering creates a REGISTERED registration for the caller", "[Positive] AC2: places are first come, first served — the registration is REGISTERED at once, with no approval step", "[Negative] SCRUM-74 AC: registration is accepted with capacity remaining, decreasing it by exactly one"; `e2e/registration.spec.ts` › "AC: registering shows as registered immediately, and capacity decreases by one"

### TC-73-02

| Item | Content |
|---|---|
| Test Case ID | TC-73-02 |
| Test Scenario | [Negative] AC 3: registering again for the same event creates nothing |
| Pre-conditions | The Attendee is already Registered for the event. |
| Test Steps | 1. Send another registration for the event. |
| Test Data | The event's id |
| Expected Result | Refused with "You are already registered for this event." There is still one registration. |

**Automated by:** `tests/unit/registration-actions.test.ts` › "[Negative] AC: the same Attendee cannot hold two active registrations for the same event"

### TC-73-03

| Item | Content |
|---|---|
| Test Case ID | TC-73-03 |
| Test Scenario | [Negative] AC 5: an event that isn't Confirmed, or whose registration isn't open, refuses registration, even sent directly |
| Pre-conditions | A Planning event; a Confirmed event closed by hand; one whose window hasn't opened; one whose window has ended. |
| Test Steps | 1. Send a registration directly for each. |
| Test Data | Their ids |
| Expected Result | The Planning event: "This event is not open for registration." The others: "Registration for this event is not currently open." Nothing is created. |

**Automated by:** `tests/unit/registration-actions.test.ts` › "[Negative] AC: registration is refused for an event that is not Confirmed", "[Negative] AC: registration is refused when registrationEnabled is false", "[Negative] a not-yet-open registration period is refused", "[Negative] an expired registration period is refused"

### TC-73-04

| Item | Content |
|---|---|
| Test Case ID | TC-73-04 |
| Test Scenario | [Boundary] AC 5: registration closes when the event starts, checked on the server |
| Pre-conditions | A Confirmed event with no window, whose start has just passed. |
| Test Steps | 1. Send a registration directly. |
| Test Data | The event's id |
| Expected Result | Refused, and nothing is created. The start is read under the lock, so a page left open can't get round it. |

**Automated by:** `tests/unit/registration-actions.test.ts` › "[Negative] AC5 / SCRUM-75 AC8: registration is refused once the event has started, even with no window set", "[Positive] AC5: the event's start is read inside the lock, so the start cut-off is enforced server-side"

### TC-73-05

| Item | Content |
|---|---|
| Test Case ID | TC-73-05 |
| Test Scenario | [Positive] AC 6: registration opens when the event is Confirmed; a set opening time is honoured |
| Pre-conditions | A Confirmed event with no window; one whose window opens now. |
| Test Steps | 1. Open each event. |
| Test Data | The two events |
| Expected Result | The first is open at once and says "Opens on confirmation". The second is open from its exact opening instant. |

**Automated by:** `tests/unit/registration-state.test.ts` › "[Positive] AC: open, unfilled, no period configured → OPEN", "[Boundary] registrationOpensAt exactly now already counts as open (not NOT_YET_OPEN)", "SCRUM-72 AC5: no window set shows the default — opens on confirmation, closes at the start"

### TC-73-06

| Item | Content |
|---|---|
| Test Case ID | TC-73-06 |
| Test Scenario | [Positive] AC 3: an Attendee who withdrew can register again, on the same registration |
| Pre-conditions | The Attendee withdrew from an open event with places left. |
| Test Steps | 1. Click **Register** again. |
| Test Data | The event |
| Expected Result | The Attendee is Registered again; the same registration is reused, not a second one. |

**Automated by:** `tests/unit/registration-actions.test.ts` › "[Positive] re-registering after a withdrawal flips the SAME row rather than inserting a second one"

### TC-73-07

| Item | Content |
|---|---|
| Test Case ID | TC-73-07 |
| Test Scenario | [Negative] AC 7: an event back in Planning refuses new registrations, and keeps the existing ones |
| Pre-conditions | A Confirmed event with registrations, moved back to Planning. |
| Test Steps | 1. As another Attendee, register. <br> 2. As a registered Attendee, open **My Registrations**. |
| Test Data | The event |
| Expected Result | The new registration is refused. The existing registrations are still Registered. |

**Automated by:** `tests/unit/registration-actions.test.ts` › "[Negative] AC7: an event back in Planning refuses new registrations and leaves existing ones untouched"; `tests/unit/my-registrations.test.ts` › "[Boundary] an event back in Planning keeps the registration's own status"

### TC-73-08

| Item | Content |
|---|---|
| Test Case ID | TC-73-08 |
| Test Scenario | [Negative] Only a signed-in Attendee can register, for an event named |
| Pre-conditions | Signed in as an Organiser; then signed out. |
| Test Steps | 1. As the Organiser, send a registration. <br> 2. Signed out, send one. <br> 3. As the Attendee, send one with no event. |
| Test Data | An open event's id |
| Expected Result | Each is refused, and nothing is created. |

**Automated by:** `tests/unit/registration-actions.test.ts` › "[Security gate] a role without registration:create (e.g. ORGANISER) is refused before the transaction runs", "[Negative] a signed-out caller is refused", "[Negative] AC: registration is refused for validation failure (missing eventId)"
