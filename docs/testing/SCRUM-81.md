# SCRUM-81 — Move an approved event through planning to confirmed: test cases

Story and acceptance criteria: [docs/backlog/SCRUM-81.md](../backlog/SCRUM-81.md)
(rewritten in Jira on 30 Sep 2026; renumbered with a new AC 2, and AC 5 extended to open registration, on 1 Oct). Format and conventions: [README.md](README.md).
Approval is decided by `transitionEventStatus` and confirmation by
`confirmEvent`, both in
[app/(app)/events/actions.ts](<../../app/(app)/events/actions.ts>); readiness
comes from SCRUM-110's checklist. The decisions behind them are
[ADR 0012](../adr/0012-confirming-an-event.md).

**Shared pre-conditions for every case:** the database is migrated and seeded
and the app is running. Unless the case says otherwise, the event is owned by
`organiser@test.local` and assigned to `coordinator@test.local` (both
`Password123!`), and runs 09:00–17:00 on one day in 2031. "Ready" means its
SCRUM-110 checklist is complete: an approved venue booking covering the event
and, if equipment was requested, every line reserved in full.

| ID                    | Type        | Criterion                                  | Automated              |
| --------------------- | ----------- | ------------------------------------------ | ---------------------- |
| [TC-81-01](#tc-81-01) | Positive    | AC 1, AC 2                                 | Unit, integration, e2e |
| [TC-81-02](#tc-81-02) | Positive    | AC 3                                       | Unit, e2e              |
| [TC-81-03](#tc-81-03) | Negative    | AC 4                                       | e2e                    |
| [TC-81-04](#tc-81-04) | Negative    | AC 4                                       | Unit                   |
| [TC-81-05](#tc-81-05) | Positive    | AC 5                                       | Unit, e2e              |
| [TC-81-06](#tc-81-06) | Positive    | AC 6                                       | Unit, e2e              |
| [TC-81-07](#tc-81-07) | Negative    | AC 7                                       | Unit                   |
| [TC-81-08](#tc-81-08) | Negative    | AC 7                                       | Unit, e2e              |
| [TC-81-09](#tc-81-09) | Boundary    | AC 8                                       | Unit                   |
| [TC-81-10](#tc-81-10) | Concurrency | AC 8                                       | Integration            |
| [TC-81-11](#tc-81-11) | Negative    | AC 5                                       | Unit                   |
| [TC-81-12](#tc-81-12) | Positive    | Arrangements can still be made in Planning | Integration            |
| [TC-81-13](#tc-81-13) | Positive    | AC 5                                       | Unit, e2e              |

---

### TC-81-01

| Item            | Content                                                                                                                                                                                                                                                                    |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Test Case ID    | TC-81-01                                                                                                                                                                                                                                                                   |
| Test Scenario   | [Positive] AC 1, AC 2: approving a request moves the event straight to Planning, and the approval (who, when) is recorded in its history. Approving an unassigned request makes the approver its Coordinator                                                               |
| Pre-conditions  | Signed in as the assigned Coordinator. The event is Under Review.                                                                                                                                                                                                          |
| Test Steps      | 1. On **Events**, click **Approve** on the event's row.                                                                                                                                                                                                                    |
| Test Data       | —                                                                                                                                                                                                                                                                          |
| Expected Result | "Event status updated to planning." The row and the details show **Planning**. The event records the approving Coordinator and time, and its history holds two entries: the Coordinator's approval (Under Review → Approved) and the automatic move (Approved → Planning). |

**Automated by:** `tests/unit/event-status.test.ts` › "SCRUM-81 [AC1] TC-81-01: …" and "SCRUM-19, SCRUM-81 [AC1, AC2] TC-81-01: …"; `tests/integration/concurrency.test.ts` › the decision race now ends in Planning; `e2e/events.spec.ts` › "SCRUM-81 [AC1, AC2] TC-81-01: coordinator approves an under-review event and status moves to PLANNING (SCRUM-24)"

### TC-81-02

| Item            | Content                                                                                                       |
| --------------- | ------------------------------------------------------------------------------------------------------------- |
| Test Case ID    | TC-81-02                                                                                                      |
| Test Scenario   | [Positive] AC 3: on a ready Planning event, the assigned Coordinator sees an enabled **Confirm event** action |
| Pre-conditions  | Signed in as the assigned Coordinator. The event is Planning and ready.                                       |
| Test Steps      | 1. Open the event's details.                                                                                  |
| Test Data       | —                                                                                                             |
| Expected Result | The Readiness checklist says "Ready to confirm", with an enabled **Confirm event** button.                    |

**Automated by:** `tests/unit/readiness-actions.test.ts` › "SCRUM-81 [AC3, AC7] TC-81-02, TC-81-08: …"; `e2e/confirm.spec.ts` › "SCRUM-81 [AC3, AC5, AC6, AC7] …"

### TC-81-03

| Item            | Content                                                                                                             |
| --------------- | ------------------------------------------------------------------------------------------------------------------- |
| Test Case ID    | TC-81-03                                                                                                            |
| Test Scenario   | [Negative] AC 4: on a Planning event that is not ready, Confirm is unavailable and the outstanding items are listed |
| Pre-conditions  | Signed in as the assigned Coordinator. The event is Planning; its only venue booking is pending.                    |
| Test Steps      | 1. Open the event's details.                                                                                        |
| Test Data       | Booking PENDING                                                                                                     |
| Expected Result | "Venue booking — Pending" and "Not ready to confirm yet". The **Confirm event** button is disabled.                 |

**Automated by:** `e2e/confirm.spec.ts` › "SCRUM-81 [AC4] TC-81-03: …"

### TC-81-04

| Item            | Content                                                                                                                                                                                      |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Test Case ID    | TC-81-04                                                                                                                                                                                     |
| Test Scenario   | [Negative] AC 4: a confirm request for an event that is not ready is refused, names what is outstanding, and changes nothing                                                                 |
| Pre-conditions  | As TC-81-03.                                                                                                                                                                                 |
| Test Steps      | 1. Send a confirm request for the event directly (e.g. from a page opened before a booking was cancelled).                                                                                   |
| Test Data       | Booking PENDING; 5 Projectors requested, 3 reserved                                                                                                                                          |
| Expected Result | Refused: "This event isn't ready to confirm yet. Outstanding: Venue booking (Pending), Equipment (Not fully reserved: Projector)." The event stays Planning and no history entry is written. |

**Automated by:** `tests/unit/event-confirm.test.ts` › "SCRUM-81 [AC4] TC-81-04: …"

### TC-81-05

| Item            | Content                                                                                                                                                                                                                               |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Test Case ID    | TC-81-05                                                                                                                                                                                                                              |
| Test Scenario   | [Positive] AC 5: confirming a ready event makes it Confirmed, opens registration, and records the confirming Coordinator and time                                                                                                     |
| Pre-conditions  | As TC-81-02.                                                                                                                                                                                                                          |
| Test Steps      | 1. Click **Confirm event**.                                                                                                                                                                                                           |
| Test Data       | —                                                                                                                                                                                                                                     |
| Expected Result | "Event confirmed." The event shows **Confirmed**, the checklist and button are replaced by the confirmed arrangements, registration is open, and its history holds one entry (Planning → Confirmed) by that Coordinator at that time. |

**Automated by:** `tests/unit/event-confirm.test.ts` › "SCRUM-81 [AC5] TC-81-05: …"; `e2e/confirm.spec.ts` › "SCRUM-81 [AC3, AC5, AC6, AC7] …"

### TC-81-06

| Item            | Content                                                                                                        |
| --------------- | -------------------------------------------------------------------------------------------------------------- |
| Test Case ID    | TC-81-06                                                                                                       |
| Test Scenario   | [Positive] AC 6: the Organiser of a Confirmed event sees its confirmed venue, date/time and reserved equipment |
| Pre-conditions  | TC-81-05 done. The event has an approved booking at Exhibition Hall and 2 Projectors reserved.                 |
| Test Steps      | 1. Sign in as `organiser@test.local`. <br> 2. Open the event's details.                                        |
| Test Data       | —                                                                                                              |
| Expected Result | A "Confirmed arrangements" section: Venue "Exhibition Hall", the event's date and time, and "Projector × 2".   |

**Automated by:** `tests/unit/event-readiness.test.ts` › "SCRUM-81 [AC6] TC-81-06: …"; `tests/unit/readiness-actions.test.ts` › "SCRUM-81 [AC6] TC-81-06: …"; `e2e/confirm.spec.ts` › "SCRUM-81 [AC3, AC5, AC6, AC7] …"

### TC-81-07

| Item            | Content                                                                                                                                                 |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Test Case ID    | TC-81-07                                                                                                                                                |
| Test Scenario   | [Negative] AC 7: anyone but the event's assigned Coordinator is refused, with no status change                                                          |
| Pre-conditions  | The event is Planning and ready.                                                                                                                        |
| Test Steps      | 1. Send a confirm request as each user below.                                                                                                           |
| Test Data       | The Organiser; another Coordinator; any Coordinator when the event has no assigned Coordinator; Venue Staff; Technical Support; an Attendee; signed out |
| Expected Result | Refused every time. The event stays Planning and no history entry is written.                                                                           |

**Automated by:** `tests/unit/event-confirm.test.ts` › "SCRUM-81 [AC7] TC-81-07: …"; `tests/unit/auth.test.ts` › "SCRUM-81 [AC7] TC-81-07: only the event's assigned Coordinator may confirm it"

### TC-81-08

| Item            | Content                                                                      |
| --------------- | ---------------------------------------------------------------------------- |
| Test Case ID    | TC-81-08                                                                     |
| Test Scenario   | [Negative] AC 7: only the assigned Coordinator is offered the Confirm action |
| Pre-conditions  | As TC-81-02.                                                                 |
| Test Steps      | 1. Open the event's details as the Organiser.                                |
| Test Data       | —                                                                            |
| Expected Result | The checklist shows "Ready to confirm" but no **Confirm event** button.      |

**Automated by:** `tests/unit/readiness-actions.test.ts` › "SCRUM-81 [AC3, AC7] TC-81-02, TC-81-08: …"; `e2e/confirm.spec.ts` › "SCRUM-81 [AC3, AC5, AC6, AC7] …"

### TC-81-09

| Item            | Content                                                                                                           |
| --------------- | ----------------------------------------------------------------------------------------------------------------- |
| Test Case ID    | TC-81-09                                                                                                          |
| Test Scenario   | [Boundary] AC 8: confirming an event that is already Confirmed changes nothing and records no second confirmation |
| Pre-conditions  | The event is already Confirmed (e.g. confirmed in another tab).                                                   |
| Test Steps      | 1. Send a confirm request for it again.                                                                           |
| Test Data       | —                                                                                                                 |
| Expected Result | Reported as confirmed. Nothing is written: no status change and no history entry.                                 |

**Automated by:** `tests/unit/event-confirm.test.ts` › "SCRUM-81 [AC8] TC-81-09: …" (both)

### TC-81-10

| Item            | Content                                                                                                          |
| --------------- | ---------------------------------------------------------------------------------------------------------------- |
| Test Case ID    | TC-81-10                                                                                                         |
| Test Scenario   | [Concurrency] AC 8: two confirm requests for the same ready event at the same moment confirm it once             |
| Pre-conditions  | The event is Planning and ready.                                                                                 |
| Test Steps      | 1. Send two confirm requests at the same moment.                                                                 |
| Test Data       | —                                                                                                                |
| Expected Result | Both report the event as confirmed. The event is Confirmed, with exactly one Planning → Confirmed history entry. |

**Automated by:** `tests/integration/concurrency.test.ts` › "SCRUM-81 [AC8] TC-81-10: …"

### TC-81-11

| Item            | Content                                                                    |
| --------------- | -------------------------------------------------------------------------- |
| Test Case ID    | TC-81-11                                                                   |
| Test Scenario   | [Negative] AC 5: only an event in Planning can be confirmed                |
| Pre-conditions  | The event is Under Review (then Cancelled).                                |
| Test Steps      | 1. Send a confirm request.                                                 |
| Test Data       | —                                                                          |
| Expected Result | Refused: "Only an event in Planning can be confirmed." Nothing is written. |

**Automated by:** `tests/unit/event-confirm.test.ts` › "SCRUM-81 [AC5] TC-81-11: …"

### TC-81-12

| Item            | Content                                                                                                                                                                                     |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Test Case ID    | TC-81-12                                                                                                                                                                                    |
| Test Scenario   | [Positive] Because approval now leads straight to Planning, Technical Support can reserve equipment for a Planning event (SCRUM-31), as venue bookings and equipment requests already allow |
| Pre-conditions  | Signed in as `techsupport@test.local`. The event is Planning.                                                                                                                               |
| Test Steps      | 1. On **Equipment**, in **Reserve an approved request**, choose an approved request for the Planning event and reserve it (SCRUM-155).                                                     |
| Test Data       | —                                                                                                                                                                                           |
| Expected Result | The reservation is created.                                                                                                                                                                 |

**Automated by:** `tests/integration/equipment-availability.test.ts` › "SCRUM-31, SCRUM-81 TC-31-10, TC-81-12: reserves for a Planning event, and refuses a Confirmed one without writing"

### TC-81-13

| Item            | Content                                                                                                                      |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Test Case ID    | TC-81-13                                                                                                                     |
| Test Scenario   | [Positive] AC 5: confirming opens registration for Attendees, unless the Organiser chose Registration needed: No (SCRUM-171) |
| Pre-conditions  | As TC-81-02.                                                                                                                 |
| Test Steps      | 1. Click **Confirm event**. <br> 2. Sign in as `attendee@test.local` and open the event.                                     |
| Test Data       | Registration needed (a) Yes <br> (b) not chosen, as for every request made before SCRUM-171 <br> (c) No                      |
| Expected Result | (a), (b) Registration is open: the Attendee can register (SCRUM-73). (c) Registration stays closed.                          |

**Automated by:** `tests/unit/event-confirm.test.ts` › "SCRUM-81 [AC5] TC-81-13: …"; `e2e/confirm.spec.ts` › "SCRUM-81 [AC3, AC5, AC6, AC7] …" (case b)
