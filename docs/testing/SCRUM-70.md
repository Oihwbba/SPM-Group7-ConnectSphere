# SCRUM-70 — Organisers and coordinators see an event's registrations: test cases

Story and acceptance criteria: [docs/backlog/SCRUM-70.md](../backlog/SCRUM-70.md).
Format and conventions: [README.md](README.md). The registrations themselves
come from SCRUM-73, 74 and 77.

**Shared pre-conditions for every case:** the database is migrated and seeded
and the app is running. "Confirmed — Charity Gala" (`evt_confirmed`) is owned
by `organiser@test.local`, assigned to `coordinator@test.local`, with 120
places: Aria (`attendee@`) and Amir (`attendee2@`) Registered, Ana
(`attendee3@`) Withdrawn. Every account's password is `Password123!`.

The list is the **Registrations** card in the event's View Details, shown for
Confirmed, Planning, Cancelled and Completed events. Anyone the server
refuses sees no card at all.

| ID | Type | Criterion | Automated |
|---|---|---|---|
| [TC-70-01](#tc-70-01) | Positive | AC 1 | Unit, e2e |
| [TC-70-02](#tc-70-02) | Negative | AC 1 | Unit |
| [TC-70-03](#tc-70-03) | Positive | AC 2 | Unit, e2e |
| [TC-70-04](#tc-70-04) | Negative | AC 2 | Unit |
| [TC-70-05](#tc-70-05) | Positive | AC 3 | Unit, e2e |
| [TC-70-06](#tc-70-06) | Positive | AC 4 | Unit, e2e |
| [TC-70-07](#tc-70-07) | Boundary | AC 3 | Unit |
| [TC-70-08](#tc-70-08) | Negative | AC 5, AC 7 | Unit |
| [TC-70-09](#tc-70-09) | Negative | AC 6 | Unit |
| [TC-70-10](#tc-70-10) | Negative | AC 2, AC 5 | Unit |

### TC-70-01

| Item | Content |
|---|---|
| Test Case ID | TC-70-01 |
| Test Scenario | [Positive] AC 1: the assigned Coordinator sees the registration list for their event |
| Pre-conditions | Signed in as `coordinator@test.local`. |
| Test Steps | 1. Open Charity Gala's **View Details**. |
| Test Data | — |
| Expected Result | A Registrations card: "2 registered · 118 of 120 places remaining", Aria and Amir Registered, Ana under "Withdrawn or cancelled (not counted)". |

**Automated by:** `tests/unit/event-registration-list.test.ts` › "SCRUM-70 [AC1] TC-70-01: …"; `e2e/event-registration-list.spec.ts` › "SCRUM-70 [AC1, AC3, AC4] TC-70-01, TC-70-05, TC-70-06: the assigned Coordinator …"

### TC-70-02

| Item | Content |
|---|---|
| Test Case ID | TC-70-02 |
| Test Scenario | [Negative] AC 1: a Coordinator the event isn't assigned to can't see its list |
| Pre-conditions | The event is assigned to another Coordinator, or to none. |
| Test Steps | 1. Request the event's registration list as `coordinator2@test.local`. |
| Test Data | — |
| Expected Result | "Event not found."; no registrations are read and no card is shown. |

**Automated by:** `tests/unit/event-registration-list.test.ts` › "SCRUM-70 [AC1] TC-70-02: …" (2 tests)

### TC-70-03

| Item | Content |
|---|---|
| Test Case ID | TC-70-03 |
| Test Scenario | [Positive] AC 2: the Organiser sees the list for an event they submitted |
| Pre-conditions | Signed in as `organiser@test.local`. |
| Test Steps | 1. Open Charity Gala's **View Details**. |
| Test Data | — |
| Expected Result | The same Registrations card as TC-70-01. |

**Automated by:** `tests/unit/event-registration-list.test.ts` › "SCRUM-70 [AC2] TC-70-03: …"; `e2e/event-registration-list.spec.ts` › "SCRUM-70 [AC2, AC3, AC4] TC-70-03, TC-70-05, TC-70-06: the Organiser …"

### TC-70-04

| Item | Content |
|---|---|
| Test Case ID | TC-70-04 |
| Test Scenario | [Negative] AC 2: an Organiser can't see another Organiser's event's list |
| Pre-conditions | Signed in as `organiser2@test.local`. |
| Test Steps | 1. Request Charity Gala's registration list directly. |
| Test Data | — |
| Expected Result | "Event not found.", the same as a missing event; no registrations are read. |

**Automated by:** `tests/unit/event-registration-list.test.ts` › "SCRUM-70 [AC2] TC-70-04: …"

### TC-70-05

| Item | Content |
|---|---|
| Test Case ID | TC-70-05 |
| Test Scenario | [Positive] AC 3: the registered count, remaining places and each Attendee's name and status |
| Pre-conditions | As TC-70-01. |
| Test Steps | 1. Read the Registrations card. |
| Test Data | — |
| Expected Result | "2 registered · 118 of 120 places remaining" (the capacity is the expected attendance, SCRUM-74), and each row shows the Attendee's name with Registered, Withdrawn or Cancelled. |

**Automated by:** `tests/unit/event-registration-list.test.ts` › "SCRUM-70 [AC3] TC-70-05: …" (2 tests); `e2e/event-registration-list.spec.ts` › "… TC-70-05 …" (2 tests)

### TC-70-06

| Item | Content |
|---|---|
| Test Case ID | TC-70-06 |
| Test Scenario | [Positive] AC 4: Withdrawn and Cancelled registrations are shown separately and not counted |
| Pre-conditions | As TC-70-01. |
| Test Steps | 1. Read the Registrations card. |
| Test Data | — |
| Expected Result | Ana appears under "Withdrawn or cancelled (not counted)" and isn't in the registered count or the remaining places. |

**Automated by:** `tests/unit/event-registration-list.test.ts` › "SCRUM-70 [AC4] TC-70-06: …"; `e2e/event-registration-list.spec.ts` › "… TC-70-06 …" (2 tests)

### TC-70-07

| Item | Content |
|---|---|
| Test Case ID | TC-70-07 |
| Test Scenario | [Boundary] AC 3: an event with no expected attendance has no places, never a negative number |
| Pre-conditions | An event with no expected attendance and no registrations. |
| Test Steps | 1. Open its Registrations card. |
| Test Data | — |
| Expected Result | "0 registered · 0 of 0 places remaining". |

**Automated by:** `tests/unit/event-registration-list.test.ts` › "SCRUM-70 [AC3] TC-70-07: …"

### TC-70-08

| Item | Content |
|---|---|
| Test Case ID | TC-70-08 |
| Test Scenario | [Negative] AC 5, AC 7: no other role can retrieve an event's registration list |
| Pre-conditions | — |
| Test Steps | 1. Request the list as an Attendee, Venue Staff, Technical Support, the Lead and a Safety Officer. |
| Test Data | — |
| Expected Result | "Event not found." for each, before the event or its registrations are read; an Attendee never sees an attendee list. |

**Automated by:** `tests/unit/event-registration-list.test.ts` › "SCRUM-70 [AC5, AC7] TC-70-08: …" (5 roles)

### TC-70-09

| Item | Content |
|---|---|
| Test Case ID | TC-70-09 |
| Test Scenario | [Negative] AC 6: another Attendee's registration, asked for by its id, looks as if it didn't exist |
| Pre-conditions | Signed in as `attendee4@test.local`. |
| Test Steps | 1. Withdraw Aria's registration by its id. |
| Test Data | — |
| Expected Result | "Registration not found.", the same as a missing id; nothing changes. |

**Automated by:** `tests/unit/registration-actions.test.ts` › "SCRUM-70 [AC6] TC-70-09, SCRUM-77 [AC5] TC-77-07: [Negative] not-found parity: an Attendee cannot withdraw another Attendee's registration"

### TC-70-10

| Item | Content |
|---|---|
| Test Case ID | TC-70-10 |
| Test Scenario | [Negative] AC 2, AC 5: signed out, or a missing event |
| Pre-conditions | — |
| Test Steps | 1. Request a list while signed out. <br> 2. Request one for an id that doesn't exist. |
| Test Data | — |
| Expected Result | Refused before anything is read; a missing event gives "Event not found.", like one that isn't yours. |

**Automated by:** `tests/unit/event-registration-list.test.ts` › "SCRUM-70 … TC-70-10: …" (2 tests)
