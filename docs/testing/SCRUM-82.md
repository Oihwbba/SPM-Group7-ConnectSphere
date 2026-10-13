# SCRUM-82 — Close an event: cancel it, or mark it completed once it has passed: test cases

Story and acceptance criteria: [docs/backlog/SCRUM-82.md](../backlog/SCRUM-82.md).
Format and conventions: [README.md](README.md). Why it works this way:
[ADR 0019](../adr/0019-closing-an-event.md).

**Shared pre-conditions for every case:** the database is migrated and seeded
and the app is running. The event is assigned to `coordinator@test.local` and
organised by `organiser@test.local`. Every account's password is
`Password123!`.

**What this story doesn't cover yet:**

- **AC2:** the Organiser asks for cancellation through a change request
  (SCRUM-41), and approving it applies this story through the same
  cancellation (`cancelInTransaction`). That is proven by SCRUM-128's
  TC-128-07.
- **AC6:** notification rows are written for the Organiser, the Coordinator
  and each Attendee whose registration was cancelled. Listing them is
  SCRUM-48; SCRUM-45 and SCRUM-85 own how they behave.
- **AC10, the Lead's queue:** overdue unassigned requests are shown there by
  SCRUM-165 (not built). The Coordinator's list already marks them.

| ID | Type | Criterion | Automated |
|---|---|---|---|
| [TC-82-01](#tc-82-01) | Positive | AC 1 | Unit |
| [TC-82-02](#tc-82-02) | Negative | AC 1 | Unit, e2e |
| [TC-82-03](#tc-82-03) | Negative | AC 1 | Unit |
| [TC-82-04](#tc-82-04) | Positive | AC 3, AC 6 | Unit, integration |
| [TC-82-05](#tc-82-05) | Negative | AC 4 | Unit, e2e |
| [TC-82-06](#tc-82-06) | Positive | AC 6 | Unit, integration |
| [TC-82-07](#tc-82-07) | Concurrency | AC 4 | Integration |
| [TC-82-08](#tc-82-08) | Negative | AC 5 | Unit |
| [TC-82-09](#tc-82-09) | Positive, Boundary | AC 7 | Unit, integration |
| [TC-82-10](#tc-82-10) | Negative, Concurrency | AC 7, AC 8, AC 9 | Unit, integration |
| [TC-82-11](#tc-82-11) | Positive, Boundary | AC 10 | Unit, e2e |
| [TC-82-12](#tc-82-12) | Positive | AC 1, AC 3, AC 4 | e2e |
| [TC-82-13](#tc-82-13) | Positive | AC 7, AC 10 | e2e |

### TC-82-01

| Item | Content |
|---|---|
| Test Case ID | TC-82-01 |
| Test Scenario | [Positive] AC 1: the assigned Coordinator cancels an event Under Review, in Planning or Confirmed |
| Pre-conditions | The event is Under Review, in Planning or Confirmed. |
| Test Steps | 1. Open the event's details. <br> 2. Click **Cancel event**, enter a reason, confirm. |
| Test Data | Reason "The keynote speaker withdrew." |
| Expected Result | "Event cancelled. Its arrangements and registrations were released." The event is Cancelled with the reason, who and when, and a history entry. |

**Automated by:** `tests/unit/cancel-event.test.ts` › "SCRUM-82 [AC1] TC-82-01: …" (3 tests); `tests/unit/event-closing.test.ts` › "SCRUM-82 [AC1] TC-82-01: …"

### TC-82-02

| Item | Content |
|---|---|
| Test Case ID | TC-82-02 |
| Test Scenario | [Negative] AC 1: a reason is required, and only those statuses can be cancelled |
| Pre-conditions | One at a time: no reason; the event is Draft, Submitted, Completed or Rejected. |
| Test Steps | Try to cancel. |
| Test Data | Reasons: none, empty, spaces. |
| Expected Result | The dialog's **Cancel event** stays disabled; a direct request says "A cancellation reason is required." or names the status, e.g. "This event is Draft, so it can't be cancelled." (SCRUM-135 AC11). Nothing is written. |

**Automated by:** `tests/unit/cancel-event.test.ts` › "SCRUM-82 [AC1] TC-82-02: …" (5 tests); `e2e/close-event.spec.ts` (TC-82-12)

### TC-82-03

| Item | Content |
|---|---|
| Test Case ID | TC-82-03 |
| Test Scenario | [Negative] AC 1: only the event's assigned Coordinator |
| Pre-conditions | — |
| Test Steps | Cancel as every other role, as another Coordinator, and after the event was reassigned. |
| Test Data | `coordinator2@test.local`, `organiser@test.local`. |
| Expected Result | "You do not have permission to do that.", "Event not found." or "This event was updated by another user. Refresh and try again."; nothing is written. |

**Automated by:** `tests/unit/cancel-event.test.ts` › "SCRUM-82 [AC1] TC-82-03: …" (2 tests); `tests/unit/auth.test.ts` › "SCRUM-82 [AC1] TC-82-03: …"

### TC-82-04

| Item | Content |
|---|---|
| Test Case ID | TC-82-04 |
| Test Scenario | [Positive] AC 3: everything held for the event is released in the same operation |
| Pre-conditions | A Confirmed event with an Approved booking, a hold, a reservation of 2 projectors with its request, a safety check awaiting review, a registered Attendee and a submitted change request. |
| Test Steps | Cancel it. |
| Test Data | Reason "Venue flooded." |
| Expected Result | Both bookings, the reservation (its stock back in the pool) and the equipment request are Cancelled; the safety check is Outdated; the registration is Cancelled; the change request is Rejected with the reason. |

**Automated by:** `tests/unit/cancel-event.test.ts` › "SCRUM-82 [AC3] TC-82-04: …"; `tests/integration/close-event.test.ts` › "SCRUM-82 [AC3, AC6] TC-82-04: …"

### TC-82-05

| Item | Content |
|---|---|
| Test Case ID | TC-82-05 |
| Test Scenario | [Negative] AC 4: a cancelled event can't be reopened |
| Pre-conditions | The event is Cancelled. |
| Test Steps | 1. Open its details. <br> 2. Cancel it again directly. |
| Test Data | — |
| Expected Result | 1. No **Cancel event** button; the reason is shown. 2. Nothing changes. |

**Automated by:** `tests/unit/cancel-event.test.ts` › "SCRUM-82 [AC4] TC-82-05: …"; `e2e/close-event.spec.ts` (TC-82-12)

### TC-82-06

| Item | Content |
|---|---|
| Test Case ID | TC-82-06 |
| Test Scenario | [Positive] AC 6: everyone involved is told |
| Pre-conditions | Two Attendees are registered. |
| Test Steps | Cancel the event. |
| Test Data | — |
| Expected Result | The Organiser and the Coordinator get "Event cancelled"; each Attendee gets "An event you registered for was cancelled"; all with the reason. |

**Automated by:** `tests/unit/cancel-event.test.ts` › "SCRUM-82 [AC6] TC-82-06: …"; `tests/integration/close-event.test.ts` › "… TC-82-04: …"

### TC-82-07

| Item | Content |
|---|---|
| Test Case ID | TC-82-07 |
| Test Scenario | [Concurrency] AC 4: two cancels at the same moment |
| Pre-conditions | A Planning event. |
| Test Steps | Send two cancels at once. |
| Test Data | — |
| Expected Result | Both succeed, and the event is cancelled once, with one history entry. |

**Automated by:** `tests/integration/close-event.test.ts` › "SCRUM-82 [AC4] TC-82-07: …"

### TC-82-08

| Item | Content |
|---|---|
| Test Case ID | TC-82-08 |
| Test Scenario | [Negative] AC 5: an event with registrations is cancelled, not rejected |
| Pre-conditions | A Planning event with a registered Attendee (it was Confirmed and returned to Planning). |
| Test Steps | Reject it (SCRUM-117). |
| Test Data | — |
| Expected Result | "This event has registrations, so it can't be rejected. Cancel it instead." Nothing is written. An event ever Confirmed is refused the same way (TC-117-05). |

**Automated by:** `tests/unit/reject-planning.test.ts` › "SCRUM-82 [AC5] TC-82-08: …"

### TC-82-09

| Item | Content |
|---|---|
| Test Case ID | TC-82-09 |
| Test Scenario | [Positive, Boundary] AC 7: a finished Confirmed event becomes Completed when events are next read |
| Pre-conditions | A Confirmed event whose end has passed. |
| Test Steps | Open **Events** (or My Registrations, or the event's page). |
| Test Data | — |
| Expected Result | The event shows Completed, with when, and a history entry. At exactly its end time it is still Confirmed. |

**Automated by:** `tests/unit/event-closing.test.ts` › "SCRUM-82 [AC7] TC-82-09: …" (2 tests); `tests/integration/close-event.test.ts` › "… TC-82-10: …"

### TC-82-10

| Item | Content |
|---|---|
| Test Case ID | TC-82-10 |
| Test Scenario | [Negative, Concurrency] AC 7, AC 8, AC 9: completion happens once, and never for a Cancelled event |
| Pre-conditions | A finished Confirmed event and a finished Cancelled event. |
| Test Steps | Load two pages at the same moment, then again. |
| Test Data | — |
| Expected Result | The Confirmed one is completed once, with one history entry; checking again changes nothing; the Cancelled one stays Cancelled. |

**Automated by:** `tests/unit/event-closing.test.ts` › "SCRUM-82 [AC8] TC-82-10: …"; `tests/integration/close-event.test.ts` › "SCRUM-82 [AC7, AC8, AC9] TC-82-10: …"

### TC-82-11

| Item | Content |
|---|---|
| Test Case ID | TC-82-11 |
| Test Scenario | [Positive, Boundary] AC 10: an undecided event whose start has passed is Overdue |
| Pre-conditions | Events Submitted, Under Review or Planning, one starting yesterday, one starting tomorrow. |
| Test Steps | Open **Events** as the Coordinator. |
| Test Data | — |
| Expected Result | Yesterday's shows **Overdue** beside its status; tomorrow's doesn't. Nothing is Overdue at exactly its start, nor once Approved, Confirmed or closed. It is never completed automatically. |

**Automated by:** `tests/unit/event-closing.test.ts` › "SCRUM-82 [AC10] TC-82-11: …" (5 tests); `e2e/close-event.spec.ts` (TC-82-13)

### TC-82-12

| Item | Content |
|---|---|
| Test Case ID | TC-82-12 |
| Test Scenario | [Positive] AC 1, AC 3, AC 4: cancel in the browser |
| Pre-conditions | A Confirmed event with a registered `attendee@test.local`. |
| Test Steps | 1. As the Coordinator, open it, click **Cancel event**, see the button disabled without a reason, enter one, cancel. <br> 2. Reopen it. <br> 3. As the Organiser, open it. <br> 4. As the Attendee, open My Registrations. |
| Test Data | Reason "The keynote speaker withdrew." |
| Expected Result | 1. Cancelled; the registration is Cancelled. 2. The reason shows and **Cancel event** is gone. 3. The reason shows. 4. The card reads Cancelled with the reason. |

**Automated by:** `e2e/close-event.spec.ts` › "SCRUM-82 [AC1, AC3, AC4] TC-82-12: …"

### TC-82-13

| Item | Content |
|---|---|
| Test Case ID | TC-82-13 |
| Test Scenario | [Positive] AC 7, AC 10: Overdue and Completed in the browser |
| Pre-conditions | A Planning event that started yesterday, a Confirmed event that ended yesterday, and a Planning event next week. |
| Test Steps | Open **Events** as the Coordinator. |
| Test Data | — |
| Expected Result | The first is marked Overdue, the next week's isn't, and the finished one shows Completed. |

**Automated by:** `e2e/close-event.spec.ts` › "SCRUM-82 [AC7, AC10] TC-82-13: …"
