# SCRUM-171 — Record whether an event needs registration

Test cases for [docs/backlog/SCRUM-171.md](../backlog/SCRUM-171.md). Format:
[README](README.md). Seeded accounts share the password `Password123!`.

Registration needed is stored in `Event.registrationRequired`: true (Yes),
false (No), or null for a request made before this story, which keeps working
as it always has (it takes registrations). The note about registration is the
existing `registrationNotes`, now optional. AC5's change-request half needs
SCRUM-128, which isn't on `main` yet (TC-171-09).

| ID | Type | Criterion | Automated |
|---|---|---|---|
| [TC-171-01](#tc-171-01) | Positive | AC 1, AC 2 | Unit, integration, e2e |
| [TC-171-02](#tc-171-02) | Negative | AC 2 | Unit |
| [TC-171-03](#tc-171-03) | Positive | AC 2 | Unit |
| [TC-171-04](#tc-171-04) | Positive | AC 3 | Unit, e2e |
| [TC-171-05](#tc-171-05) | Positive | AC 4 | Unit |
| [TC-171-06](#tc-171-06) | Negative | AC 4 | Unit, integration, e2e |
| [TC-171-07](#tc-171-07) | Negative | AC 4 | Integration |
| [TC-171-08](#tc-171-08) | Negative, Boundary | AC 5 | Unit, integration |
| [TC-171-09](#tc-171-09) | Negative | AC 5 | Manual, waits for SCRUM-128 |
| [TC-171-10](#tc-171-10) | Positive | AC 1 | Unit |

### TC-171-01

| Item | Content |
|---|---|
| Test Case ID | TC-171-01 |
| Test Scenario | [Positive] AC 1, AC 2: the Organiser chooses Registration needed Yes or No, and may add a note |
| Pre-conditions | Signed in as the Organiser. |
| Test Steps | 1. Fill in a new request; on Registration & Additional Details choose **Yes**, leave the note empty, and submit. <br> 2. Do the same choosing **No**. |
| Test Data | `organiser@test.local` |
| Expected Result | Both submit. The event stores Registration needed Yes, then No, with no note. |

**Automated by:** `tests/unit/events.test.ts` › "SCRUM-171 [AC1, AC2] TC-171-01: …" (3 tests); `tests/integration/registration-needed.test.ts` › "SCRUM-171 [AC1, AC2] TC-171-01: …"; `e2e/events.spec.ts` and `e2e/coordinator-assignment.spec.ts` submit through the form choosing Yes.

### TC-171-02

| Item | Content |
|---|---|
| Test Case ID | TC-171-02 |
| Test Scenario | [Negative] AC 2: a request can't be submitted without choosing |
| Pre-conditions | As TC-171-01. |
| Test Steps | 1. Fill in everything else, choose neither Yes nor No, and submit. |
| Test Data | — |
| Expected Result | Refused with "Choose whether the event needs registration." beside the choice; the review shows Registration Needed as "Missing (Required to Submit)". Nothing is created. |

**Automated by:** `tests/unit/events.test.ts` › "SCRUM-171 [AC2] TC-171-02: …" and "SCRUM-13 [AC4 - Business-Rule Negative]: …"

### TC-171-03

| Item | Content |
|---|---|
| Test Case ID | TC-171-03 |
| Test Scenario | [Positive] AC 2: a draft saves without choosing |
| Pre-conditions | As TC-171-01. |
| Test Steps | 1. Start a request, choose nothing, and save it as a draft. <br> 2. Reopen it, choose **No**, and save again. |
| Test Data | — |
| Expected Result | 1: saved, with Registration needed unanswered. 2: saved with No. |

**Automated by:** `tests/unit/events.test.ts` › "SCRUM-171 [AC2] TC-171-03: …"

### TC-171-04

| Item | Content |
|---|---|
| Test Case ID | TC-171-04 |
| Test Scenario | [Positive] AC 3: a request made before this story keeps its registration answer, shown next to the new field |
| Pre-conditions | An event Under Review with its Coordinator, no Registration needed answer and the registration note "Walk-in, no sign-up needed". |
| Test Steps | 1. Open its details as its Organiser. <br> 2. As its Coordinator, open Edit details. |
| Test Data | `organiser@test.local`, `coordinator@test.local` |
| Expected Result | 1: "Registration Needed: Not answered", with "Registration Notes: Walk-in, no sign-up needed" beside it. 2: neither Yes nor No is chosen, and the note is there to keep. |

**Automated by:** `tests/unit/registration-state.test.ts` › "SCRUM-171 [AC3] TC-171-04: …"; `e2e/registration-needed.spec.ts` › "SCRUM-171 [AC3] TC-171-04: …" (both steps).

### TC-171-05

| Item | Content |
|---|---|
| Test Case ID | TC-171-05 |
| Test Scenario | [Positive] AC 4: confirming an event that doesn't need registration doesn't open registration |
| Pre-conditions | Planning events, ready to confirm, with Registration needed Yes, No and unanswered. |
| Test Steps | 1. Confirm each. |
| Test Data | `coordinator@test.local` |
| Expected Result | Yes and unanswered open registration; No doesn't, and the Organiser is told only that it is confirmed. |

**Automated by:** `tests/unit/event-confirm.test.ts` › "SCRUM-81 [AC5] TC-81-13: …" and "SCRUM-45 [AC4, AC11] TC-45-04: …" (built before this story; confirming already read the answer).

### TC-171-06

| Item | Content |
|---|---|
| Test Case ID | TC-171-06 |
| Test Scenario | [Negative] AC 4: Attendees don't see an event that doesn't need registration, in the list or by its URL |
| Pre-conditions | Confirmed events with Registration needed Yes, No and unanswered. |
| Test Steps | 1. As an Attendee, open Browse Events. <br> 2. Open the No event by its URL. |
| Test Data | `attendee@test.local` |
| Expected Result | 1: Yes and unanswered are listed; No isn't. 2: not found, the same as an event that doesn't exist. |

**Automated by:** `tests/unit/attendee-events.test.ts` › "SCRUM-171 [AC4] TC-171-06: …" (4 tests); `tests/unit/organiser-attendee-events-access.test.ts` › "[Positive] AC: queries only Confirmed events, earliest-starting first"; `tests/unit/registration-state.test.ts` › "SCRUM-171 [AC4] TC-171-06: …"; `tests/integration/registration-needed.test.ts` › "SCRUM-171 [AC4] TC-171-06: …"; `e2e/registration-needed.spec.ts` › "SCRUM-171 [AC4] TC-171-06: …"

### TC-171-07

| Item | Content |
|---|---|
| Test Case ID | TC-171-07 |
| Test Scenario | [Negative] AC 4: a registration request for an event that doesn't need registration is refused |
| Pre-conditions | A Confirmed event with Registration needed No, even with registration left enabled. |
| Test Steps | 1. As an Attendee, send a registration for it directly. <br> 2. Register for events with Yes and unanswered. |
| Test Data | `attendee4@test.local` |
| Expected Result | 1: "This event is not open for registration.", and no registration is written. 2: both register. |

**Automated by:** `tests/integration/registration-needed.test.ts` › "SCRUM-171 [AC4] TC-171-07: …" (3 tests)

### TC-171-08

| Item | Content |
|---|---|
| Test Case ID | TC-171-08 |
| Test Scenario | [Negative] [Boundary] AC 5: with active registrations, Registration needed can't be edited to No |
| Pre-conditions | A Planning event (returned from Confirmed) with Registration needed Yes and two active registrations and one withdrawn. |
| Test Steps | 1. As its Coordinator, edit Registration needed to No. <br> 2. With one active registration. <br> 3. With only the withdrawn one. <br> 4. Edit No or unanswered to Yes. |
| Test Data | `coordinator@test.local` |
| Expected Result | 1: "This event has 2 active registrations, so Registration needed can't be changed to No." beside the choice; nothing is saved or audited. 2: "…1 active registration…". 3: saved and audited. 4: saved without counting registrations. |

**Automated by:** `tests/unit/event-edit.test.ts` › "SCRUM-171 [AC5] TC-171-08: …" (5 tests); `tests/integration/registration-needed.test.ts` › "SCRUM-171 [AC5] TC-171-08: …" (2 tests)

### TC-171-09

| Item | Content |
|---|---|
| Test Case ID | TC-171-09 |
| Test Scenario | [Negative] AC 5: an approved change request can't change Registration needed to No while people are registered |
| Pre-conditions | SCRUM-128's change-request decision. |
| Test Steps | 1. Approve a change request setting Registration needed to No on an event with active registrations. |
| Test Data | — |
| Expected Result | Refused with the number of active registrations; nothing changes. |

**Automated by:** Manual. Waits for SCRUM-128 (#181), whose approval should use `registrationStillNeededMessage` from `lib/schemas/event-edit.ts`.

### TC-171-10

| Item | Content |
|---|---|
| Test Case ID | TC-171-10 |
| Test Scenario | [Positive] AC 1: the note about registration is optional in a clarification answer and a change request too, as on the request form |
| Pre-conditions | An event with the registration note "Open to all students": one with an open clarification naming Registration needs, and one that can take a change request. |
| Test Steps | 1. As its Organiser, answer the clarification with the note cleared. <br> 2. Raise a change request clearing the note. |
| Test Data | `organiser@test.local` |
| Expected Result | 1: accepted. 2: raised, recording Registration needs changing from "Open to all students" to no value. A note over 5000 characters is refused. |

**Automated by:** `tests/unit/clarification-and-amend.test.ts` › "SCRUM-171 [AC1] TC-171-10: a clarification answer can clear the registration note, which the form no longer requires"; `tests/unit/change-requests.test.ts` › "SCRUM-171 [AC1] TC-171-10: a change request can clear the registration note, which the form no longer requires"
