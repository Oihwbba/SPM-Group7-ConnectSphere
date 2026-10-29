# SCRUM-75 — Control and enforce the registration period

Test cases for [docs/backlog/SCRUM-75.md](../backlog/SCRUM-75.md). Format:
[README](README.md). Seeded accounts share the password `Password123!`.

AC 1, 3 and 5 were removed on 2026-10-08: windows come only from the seed
data. AC 2, 4, 7, 8 and 10 were built with SCRUM-72 and SCRUM-73, whose tests
are cited here by their existing titles.

Closing registration (AC 6) stores the moment as `Event.registrationClosesAt`
instead of turning `registrationEnabled` off. Confirming an event turns
`registrationEnabled` back on (SCRUM-81), so a close stored that way would be
undone when the event returns to Planning and is confirmed again; a closing
time that has passed stays closed until it is reopened (AC 9). Reopening
clears the opening and closing times, so registration is open from then until
the event's start. Either way an Attendee sees "Registration closed".

AC 11 moved to SCRUM-128 AC11 on 17 Oct 2026 (PO approved): a Confirmed
event's Registration needed changes only through a change request, which
SCRUM-128 applies (TC-75-14).

| ID | Type | Criterion | Automated |
|---|---|---|---|
| [TC-75-01](#tc-75-01) | Positive | AC 2, AC 4 | Unit |
| [TC-75-02](#tc-75-02) | Negative | AC 2, AC 9 | Unit, integration |
| [TC-75-03](#tc-75-03) | Negative, Boundary | AC 7 | Unit |
| [TC-75-04](#tc-75-04) | Negative, Boundary | AC 7 | Unit |
| [TC-75-05](#tc-75-05) | Negative, Boundary | AC 8 | Unit |
| [TC-75-06](#tc-75-06) | Positive | AC 6 | Unit, integration, e2e |
| [TC-75-07](#tc-75-07) | Positive | AC 6 | Unit, integration, e2e |
| [TC-75-08](#tc-75-08) | Negative | AC 6 | Unit |
| [TC-75-09](#tc-75-09) | Negative | AC 6 | Unit |
| [TC-75-10](#tc-75-10) | Negative, Boundary | AC 6, AC 8 | Unit |
| [TC-75-11](#tc-75-11) | Concurrency | AC 6 | Unit, integration |
| [TC-75-12](#tc-75-12) | Positive | AC 9 | Integration |
| [TC-75-13](#tc-75-13) | Positive | AC 10 | Unit |
| [TC-75-14](#tc-75-14) | Retired | — (moved to SCRUM-128 AC11) | — |

### TC-75-01

| Item | Content |
|---|---|
| Test Case ID | TC-75-01 |
| Test Scenario | [Positive] AC 2, AC 4: with no window, registration opens when the event is Confirmed and closes at its start |
| Pre-conditions | A Planning event that needs registration, ready to confirm, with no opening or closing time. |
| Test Steps | 1. As its Coordinator, confirm it. <br> 2. As an Attendee, open it before its start. |
| Test Data | `coordinator@test.local`, `attendee4@test.local` |
| Expected Result | 1: Confirmed, with registration enabled. 2: "Open", with "Opens on confirmation · Closes" and the start time. |

**Automated by:** `tests/unit/event-confirm.test.ts` › "SCRUM-81 [AC5] TC-81-13: with Registration needed $needed, confirming opens registration: $opens"; `tests/unit/registration-state.test.ts` › "SCRUM-72 [AC5] TC-72-04, SCRUM-75 [AC2, AC4] TC-75-01: no period set, before the event starts → OPEN" and "SCRUM-72 [AC5] TC-72-04, SCRUM-73 [AC6] TC-73-05, SCRUM-75 [AC2, AC4] TC-75-01: no window set shows the default — opens on confirmation, closes at the start"

### TC-75-02

| Item | Content |
|---|---|
| Test Case ID | TC-75-02 |
| Test Scenario | [Negative] AC 2, AC 9: registration never opens before the event is Confirmed, and pauses when it returns to Planning |
| Pre-conditions | An event in Planning whose seeded window is already open. |
| Test Steps | 1. As an Attendee, send a registration for it. |
| Test Data | `attendee4@test.local` |
| Expected Result | Refused with "This event is not open for registration."; no registration is written, and existing ones are untouched. |

**Automated by:** `tests/unit/registration-actions.test.ts` › "SCRUM-73 [AC5] TC-73-03, SCRUM-75 [AC2, AC9] TC-75-02: [Negative] registration is refused for an event that is not Confirmed" and "SCRUM-73 [AC7] TC-73-07, SCRUM-75 [AC2, AC9] TC-75-02: [Negative] an event back in Planning refuses new registrations and leaves existing ones untouched"; `tests/integration/registration-period.test.ts` › "SCRUM-75 [AC9] TC-75-12: closed registration stays closed when the event returns to Planning and is confirmed again, until it is reopened" (step 2)

### TC-75-03

| Item | Content |
|---|---|
| Test Case ID | TC-75-03 |
| Test Scenario | [Negative] [Boundary] AC 7: before the opening time Attendees can't register and see when it opens; at the opening instant it is open |
| Pre-conditions | The seeded Confirmed event whose registration hasn't opened yet. |
| Test Steps | 1. As an Attendee, open it. <br> 2. Send a registration for it. |
| Test Data | `attendee4@test.local` |
| Expected Result | 1: "Registration not yet open", with "Opens" and the opening time; Register is disabled. 2: refused with "Registration for this event is not currently open." At the opening instant itself, it is open. |

**Automated by:** `tests/unit/registration-state.test.ts` › "SCRUM-72 [AC4] TC-72-03, SCRUM-75 [AC7] TC-75-03: [Negative] registrationOpensAt in the future → NOT_YET_OPEN", "SCRUM-73 [AC6] TC-73-05, SCRUM-75 [AC7] TC-75-03: [Boundary] registrationOpensAt exactly now already counts as open (not NOT_YET_OPEN)" and "SCRUM-72 [AC3] TC-72-02, SCRUM-75 [AC7, AC10] TC-75-03, TC-75-13: a set window shows its opening and closing times"; `tests/unit/registration-actions.test.ts` › "SCRUM-73 [AC5] TC-73-03, SCRUM-75 [AC7] TC-75-03: [Negative] a not-yet-open registration period is refused"

### TC-75-04

| Item | Content |
|---|---|
| Test Case ID | TC-75-04 |
| Test Scenario | [Negative] [Boundary] AC 7: at or after the closing time Attendees see registration as closed, and a direct request is refused |
| Pre-conditions | The seeded Confirmed event whose registration has closed. |
| Test Steps | 1. As an Attendee, open it. <br> 2. Send a registration for it. |
| Test Data | `attendee4@test.local` |
| Expected Result | 1: "Registration closed"; Register is disabled. 2: refused, and nothing is written. At the closing instant itself, it is already closed. |

**Automated by:** `tests/unit/registration-state.test.ts` › "SCRUM-75 [AC7] TC-75-04: [Boundary] SCRUM-75 AC7: registrationClosesAt exactly now counts as already closed (<=, not <)"; `tests/unit/registration-actions.test.ts` › "SCRUM-73 [AC5] TC-73-03, SCRUM-75 [AC7] TC-75-04: [Negative] an expired registration period is refused"

### TC-75-05

| Item | Content |
|---|---|
| Test Case ID | TC-75-05 |
| Test Scenario | [Negative] [Boundary] AC 8: registration is never accepted at or after the event's start, whatever the window says |
| Pre-conditions | A Confirmed event whose closing time is after its start. |
| Test Steps | 1. At the start instant, and after it, send a registration. |
| Test Data | — |
| Expected Result | Refused both times, even with places left; the period shows the start as the close. |

**Automated by:** `tests/unit/registration-state.test.ts` › "SCRUM-72 [AC5] TC-72-04, SCRUM-75 [AC8] TC-75-05: no period set, at the exact start instant → closed", "SCRUM-75 [AC8] TC-75-05: a closing time later than the start is ignored once the event has started", "SCRUM-75 [AC8] TC-75-05: an event that has started is closed even when it is also full" and "SCRUM-75 [AC8] TC-75-05: a closing time after the start shows the start as the close"; `tests/unit/registration-actions.test.ts` › "SCRUM-73 [AC5] TC-73-04, SCRUM-75 [AC8] TC-75-05: [Negative] AC5 / SCRUM-75 AC8: registration is refused once the event has started, even with no window set"

### TC-75-06

| Item | Content |
|---|---|
| Test Case ID | TC-75-06 |
| Test Scenario | [Positive] AC 6: the Organiser closes open registration; it closes at once and the event stays listed to Attendees as closed |
| Pre-conditions | A Confirmed event that needs registration, with registration open (or full). |
| Test Steps | 1. As its Organiser, open the event's details and choose **Close registration**. <br> 2. As an Attendee, open Browse Events, then the event. <br> 3. Send a registration for it. |
| Test Data | `organiser@test.local`, `attendee4@test.local` |
| Expected Result | 1: the Registration panel reads "Registration closed" and offers Reopen; the closing time is now, recorded in the event's history with the Organiser and the time it replaced, and the pending "Registration closed" notice is withdrawn. 2: the event is still listed, as "Registration closed", and Register is disabled. 3: refused with "Registration for this event is not currently open."; nothing is written. |

**Automated by:** `tests/unit/registration-control.test.ts` › "SCRUM-75 [AC6] TC-75-06: …" (5 tests); `tests/integration/registration-period.test.ts` › "SCRUM-75 [AC6] TC-75-06: once the Organiser closes registration, a registration is refused and nothing is written, but the event is still listed"; `e2e/registration-period.spec.ts` › "SCRUM-75 [AC6] TC-75-06, TC-75-07: the Organiser closes registration, the Attendee sees it closed, and after the Coordinator reopens it the Attendee registers"

### TC-75-07

| Item | Content |
|---|---|
| Test Case ID | TC-75-07 |
| Test Scenario | [Positive] AC 6: reopened registration is open until the event's start |
| Pre-conditions | A Confirmed event that needs registration, with registration closed (by hand or by its closing time). |
| Test Steps | 1. As its Organiser or Coordinator, choose **Reopen registration**. <br> 2. As an Attendee, register. |
| Test Data | `coordinator@test.local`, `attendee4@test.local` |
| Expected Result | 1: "Open", with "Opens on confirmation · Closes" and the start time; the opening and closing times are cleared, the change is recorded, and a "Registration closed" notice is scheduled for the start. 2: registered. |

**Automated by:** `tests/unit/registration-control.test.ts` › "SCRUM-75 [AC6] TC-75-07: …" (3 tests); `tests/integration/registration-period.test.ts` › "SCRUM-75 [AC6] TC-75-07: after the Coordinator reopens it, an Attendee registers, and it stays open until the start"; `e2e/registration-period.spec.ts` (as TC-75-06)

### TC-75-08

| Item | Content |
|---|---|
| Test Case ID | TC-75-08 |
| Test Scenario | [Negative] AC 6: only the Organiser, or the assigned Coordinator on their behalf, may close or reopen registration |
| Pre-conditions | A Confirmed event owned by `organiser@test.local` and assigned to `coordinator@test.local`. |
| Test Steps | 1. As its assigned Coordinator, close it. <br> 2. As another Organiser, another Coordinator, an Attendee and Venue Staff, try to close or reopen it, or open its Registration panel. |
| Test Data | `coordinator@test.local`, `organiser2@test.local`, `coordinator2@test.local`, `attendee@test.local`, `venuestaff@test.local` |
| Expected Result | 1: closed, recorded under the Coordinator. 2: another Organiser or Coordinator gets "Event not found.", the same as a missing event; an Attendee and Venue Staff are refused before anything is read. Nothing is written. |

**Automated by:** `tests/unit/auth.test.ts` › "SCRUM-75 [AC6] TC-75-08: the Organiser and the assigned Coordinator may, and no one else"; `tests/unit/registration-control.test.ts` › "SCRUM-75 [AC6] TC-75-08: …" (16 tests)

### TC-75-09

| Item | Content |
|---|---|
| Test Case ID | TC-75-09 |
| Test Scenario | [Negative] AC 6: closing is refused unless registration is open |
| Pre-conditions | Events that are in Planning, don't need registration (SCRUM-171), are already closed, were never opened, have started, or haven't opened yet. |
| Test Steps | 1. As the Organiser, close each. |
| Test Data | `organiser@test.local` |
| Expected Result | Refused, nothing written: "Registration can only be closed or reopened while the event is Confirmed.", "This event doesn't need registration.", "Registration is already closed." (closed, never opened, started) or "Registration hasn't opened yet, so it can't be closed." |

**Automated by:** `tests/unit/registration-control.test.ts` › "SCRUM-75 [AC6] TC-75-09: closing is refused when %s, and nothing is written" (6 cases); `tests/unit/registration-state.test.ts` › "SCRUM-75 [AC6] TC-75-09: registration that is %s can be closed: %s"

### TC-75-10

| Item | Content |
|---|---|
| Test Case ID | TC-75-10 |
| Test Scenario | [Negative] [Boundary] AC 6, AC 8: reopening is refused at or after the start, and when registration isn't closed |
| Pre-conditions | A closed event starting now, one starting a millisecond from now, and events whose registration is open or hasn't opened yet. |
| Test Steps | 1. As the Organiser, reopen each. |
| Test Data | `organiser@test.local` |
| Expected Result | At the start: "The event has started, so registration can't be reopened." A millisecond before: reopened. Open or not yet open: "Registration isn't closed, so it can't be reopened." Nothing written when refused. |

**Automated by:** `tests/unit/registration-control.test.ts` › "SCRUM-75 [AC8] TC-75-10: …" (2 tests) and "SCRUM-75 [AC6] TC-75-10: reopening is refused when %s, and nothing is written" (2 cases); `tests/unit/registration-state.test.ts` › "SCRUM-75 [AC6] TC-75-10: …" and "SCRUM-75 [AC8] TC-75-10: …" (3 tests)

### TC-75-11

| Item | Content |
|---|---|
| Test Case ID | TC-75-11 |
| Test Scenario | [Concurrency] AC 6: a close and a registration at the same moment take turns, so none is accepted after the close |
| Pre-conditions | A Confirmed event with registration open. |
| Test Steps | 1. The Organiser closes registration while an Attendee registers, at once (five rounds). |
| Test Data | `organiser@test.local`, `attendee4@test.local` |
| Expected Result | The close succeeds; the registration either lands (before the close) or is refused with nothing written; a registration afterwards is refused. |

**Automated by:** `tests/unit/registration-control.test.ts` › "SCRUM-75 [AC6] TC-75-11: the event row is locked before registration is read, the lock a registration takes"; `tests/integration/registration-period.test.ts` › "SCRUM-75 [AC6] TC-75-11: a close and a registration at the same moment take turns: the registration lands before the close or not at all"

### TC-75-12

| Item | Content |
|---|---|
| Test Case ID | TC-75-12 |
| Test Scenario | [Positive] AC 9: after a return to Planning and a new confirmation, the same window applies; a closing time that has passed stays closed until reopened |
| Pre-conditions | 1: a Confirmed event whose registration the Organiser closed. 2: a Planning event whose closing time is still ahead. |
| Test Steps | 1. Return event 1 to Planning, register, confirm it again, register, then reopen and register. <br> 2. Confirm event 2 and register. |
| Test Data | `coordinator@test.local`, `organiser@test.local`, `attendee4@test.local` |
| Expected Result | 1: refused in Planning; refused after confirming ("Registration for this event is not currently open."); registered after reopening. 2: registered, with the closing time unchanged. |

**Automated by:** `tests/integration/registration-period.test.ts` › "SCRUM-75 [AC9] TC-75-12: closed registration stays closed when the event returns to Planning and is confirmed again, until it is reopened" and "SCRUM-75 [AC9] TC-75-12: an event confirmed again with its window still open is open again, with the same window"

### TC-75-13

| Item | Content |
|---|---|
| Test Case ID | TC-75-13 |
| Test Scenario | [Positive] AC 10: registration times are shown in Singapore time |
| Pre-conditions | A Confirmed event with an opening and a closing time. |
| Test Steps | 1. As an Attendee, open it. |
| Test Data | `attendee4@test.local` |
| Expected Result | The period reads "Opens … SGT · Closes … SGT", formatted by `formatDateTime`. |

**Automated by:** `tests/unit/registration-state.test.ts` › "SCRUM-72 [AC3] TC-72-02, SCRUM-75 [AC7, AC10] TC-75-03, TC-75-13: a set window shows its opening and closing times"; `tests/unit/datetime.test.ts` › "SCRUM-129 [AC3] TC-129-04, SCRUM-75 [AC10] TC-75-13: [SGT label] every displayed time is labelled SGT"

### TC-75-14

**Retired** on 17 Oct 2026, when AC 11 moved to SCRUM-128 AC11: a Confirmed event whose Registration needed changes from No to Yes through a change request opens registration as in AC 4. SCRUM-128 approves the change, so its tests own this case.
