# SCRUM-77 — Withdraw my registration: test cases

Story and acceptance criteria: [docs/backlog/SCRUM-77.md](../backlog/SCRUM-77.md).
Format and conventions: [README.md](README.md). AC1, AC2, AC5 and AC7 were
built with SCRUM-74; this story added AC3, AC4 and AC6. The Organiser's and
Coordinator's registration view is SCRUM-70.

**Shared pre-conditions for every case:** the database is migrated and seeded
and the app is running. The event is Confirmed, owned by
`organiser@test.local`, assigned to `coordinator@test.local`, with 5 places,
and Amir (`attendee2@test.local`) is Registered. Every account's password is
`Password123!`.

**Notes:**

- **AC6, the event's history:** each withdrawal is written to the audit log
  against the event (`REGISTRATION_WITHDRAWN`, who and when). A screen to
  view an event's history is SCRUM-71, beyond Release 1.

| ID | Type | Criterion | Automated |
|---|---|---|---|
| [TC-77-01](#tc-77-01) | Positive | AC 1 | Unit, e2e |
| [TC-77-02](#tc-77-02) | Negative | AC 2 | Unit |
| [TC-77-03](#tc-77-03) | Positive, Boundary | AC 3 | Unit |
| [TC-77-04](#tc-77-04) | Boundary | AC 3 | Unit |
| [TC-77-05](#tc-77-05) | Negative | AC 3 | Unit, e2e |
| [TC-77-06](#tc-77-06) | Positive | AC 4 | e2e |
| [TC-77-07](#tc-77-07) | Negative | AC 5 | Unit |
| [TC-77-08](#tc-77-08) | Positive | AC 6 | Unit |
| [TC-77-09](#tc-77-09) | Positive | AC 7 | Unit, e2e |

### TC-77-01

| Item | Content |
|---|---|
| Test Case ID | TC-77-01 |
| Test Scenario | [Positive] AC 1: withdrawing an active registration frees exactly one place |
| Pre-conditions | Signed in as Amir. |
| Test Steps | 1. Open the event. <br> 2. Click **Withdraw**. |
| Test Data | — |
| Expected Result | "You've withdrawn from this event."; the registration is Withdrawn and the event shows "5 of 5 places remaining". |

**Automated by:** `tests/unit/registration-actions.test.ts` › "SCRUM-74 [AC2] TC-74-06, SCRUM-77 [AC1, AC7] TC-77-01, TC-77-09: SCRUM-74 AC, SCRUM-77 [AC1, AC7] TC-77-01, TC-77-09: …"; `e2e/withdraw-registration.spec.ts` › "SCRUM-77 [AC1, AC4, AC7] TC-77-01, TC-77-06, TC-77-09: …"

### TC-77-02

| Item | Content |
|---|---|
| Test Case ID | TC-77-02 |
| Test Scenario | [Negative] AC 2: withdrawing again changes nothing and frees no second place |
| Pre-conditions | Amir's registration is already Withdrawn. |
| Test Steps | 1. Send the withdrawal again. <br> 2. Send two withdrawals at once. |
| Test Data | — |
| Expected Result | Nothing is written and no history entry is added; of two at once, only one records anything. |

**Automated by:** `tests/unit/registration-actions.test.ts` › "SCRUM-77 [AC2] TC-77-02: …" (3 tests)

### TC-77-03

| Item | Content |
|---|---|
| Test Case ID | TC-77-03 |
| Test Scenario | [Positive, Boundary] AC 3: withdrawing before the event starts is allowed |
| Pre-conditions | The event starts tomorrow, or has no start set. |
| Test Steps | 1. Withdraw. |
| Test Data | — |
| Expected Result | The withdrawal is accepted. |

**Automated by:** `tests/unit/registration-state.test.ts` › "SCRUM-77 [AC3] TC-77-03: …" (2 tests); `tests/unit/registration-actions.test.ts` › "SCRUM-77 [AC3] TC-77-03: …"

### TC-77-04

| Item | Content |
|---|---|
| Test Case ID | TC-77-04 |
| Test Scenario | [Boundary] AC 3: at the exact start instant, withdrawal is refused |
| Pre-conditions | The current time is exactly the event's start. |
| Test Steps | 1. Withdraw. |
| Test Data | — |
| Expected Result | Refused, since withdrawal is allowed up to but not including the start. |

**Automated by:** `tests/unit/registration-state.test.ts` › "SCRUM-77 [AC3] TC-77-04: …"

### TC-77-05

| Item | Content |
|---|---|
| Test Case ID | TC-77-05 |
| Test Scenario | [Negative] AC 3: once the event has started, withdrawal is refused and not offered |
| Pre-conditions | The event started an hour ago. |
| Test Steps | 1. Open the event as Amir. <br> 2. Send the withdrawal directly. |
| Test Data | — |
| Expected Result | 1. "The event has started, so you can no longer withdraw." instead of the Withdraw button. 2. "You can't withdraw once the event has started."; nothing changes. |

**Automated by:** `tests/unit/registration-actions.test.ts`, `tests/unit/registration-state.test.ts` › "SCRUM-77 [AC3] TC-77-05: …"; `e2e/withdraw-registration.spec.ts` › "SCRUM-77 [AC3] TC-77-05: once the event has started, Withdraw isn't offered"

### TC-77-06

| Item | Content |
|---|---|
| Test Case ID | TC-77-06 |
| Test Scenario | [Positive] AC 4: the withdrawal shows at once to the Attendee, the Organiser and the Coordinator |
| Pre-conditions | As TC-77-01. |
| Test Steps | 1. Withdraw as Amir. <br> 2. As the Organiser, open the event's View Details. <br> 3. Repeat as the Coordinator. |
| Test Data | — |
| Expected Result | Amir sees the withdrawal; the Organiser's and the Coordinator's Registrations card (SCRUM-70) shows "0 registered · 5 of 5 places remaining" and Amir under Withdrawn. |

**Automated by:** `e2e/withdraw-registration.spec.ts` › "SCRUM-77 [AC1, AC4, AC7] TC-77-01, TC-77-06, TC-77-09: …"

### TC-77-07

| Item | Content |
|---|---|
| Test Case ID | TC-77-07 |
| Test Scenario | [Negative] AC 5: another Attendee's registration can't be withdrawn, and looks as if it didn't exist |
| Pre-conditions | Signed in as another Attendee. |
| Test Steps | 1. Withdraw Amir's registration by its id. <br> 2. Withdraw an id that doesn't exist. |
| Test Data | — |
| Expected Result | "Registration not found." for both; nothing changes. |

**Automated by:** `tests/unit/registration-actions.test.ts` › "SCRUM-70 [AC6] TC-70-09, SCRUM-77 [AC5] TC-77-07: …" and "SCRUM-77 [AC5] TC-77-07: …"

### TC-77-08

| Item | Content |
|---|---|
| Test Case ID | TC-77-08 |
| Test Scenario | [Positive] AC 6: re-registering reactivates the same registration and keeps the withdrawal in the event's history |
| Pre-conditions | Amir withdrew; registration is open and places are free. |
| Test Steps | 1. Register again as Amir. |
| Test Data | — |
| Expected Result | The same registration is Registered again; the event's history still has the `REGISTRATION_WITHDRAWN` entry (who and when). |

**Automated by:** `tests/unit/registration-actions.test.ts` › "SCRUM-77 [AC6] TC-77-08: …" (2 tests)

### TC-77-09

| Item | Content |
|---|---|
| Test Case ID | TC-77-09 |
| Test Scenario | [Positive] AC 7: a withdrawn registration is kept, not deleted |
| Pre-conditions | As TC-77-01. |
| Test Steps | 1. Withdraw. <br> 2. Open the Organiser's Registrations card. |
| Test Data | — |
| Expected Result | Only the status changes to Withdrawn; Amir is still listed, under Withdrawn. |

**Automated by:** `tests/unit/registration-actions.test.ts` › "SCRUM-74 [AC2] TC-74-06, SCRUM-77 [AC1, AC7] TC-77-01, TC-77-09: SCRUM-74 AC, SCRUM-77 [AC1, AC7] TC-77-01, TC-77-09: …"; `e2e/withdraw-registration.spec.ts` › "… TC-77-09 …"
