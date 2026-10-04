# SCRUM-117 — Reject an event that can't be fulfilled: test cases

Story and acceptance criteria: [docs/backlog/SCRUM-117.md](../backlog/SCRUM-117.md).
Format and conventions: [README.md](README.md). Rejection is
`rejectPlanningEvent` in
[app/(app)/events/actions.ts](<../../app/(app)/events/actions.ts>), offered by
the readiness checklist; the decisions behind it are
[ADR 0015](../adr/0015-rejecting-a-planning-event.md).

**Shared pre-conditions for every case:** the database is migrated and seeded
and the app is running. Unless the case says otherwise, the event is in
**Planning**, owned by `organiser@test.local` and assigned to
`coordinator@test.local` (both `Password123!`), and was never Confirmed.

| ID                      | Type     | Criterion              | Automated   |
| ----------------------- | -------- | ---------------------- | ----------- |
| [TC-117-01](#tc-117-01) | Positive | AC 1, AC 2             | Unit        |
| [TC-117-02](#tc-117-02) | Negative | AC 2                   | Unit, e2e   |
| [TC-117-03](#tc-117-03) | Positive | AC 3                   | Unit        |
| [TC-117-04](#tc-117-04) | Negative | AC 1                   | Unit        |
| [TC-117-05](#tc-117-05) | Negative | AC 4                   | Unit, e2e   |
| [TC-117-06](#tc-117-06) | Positive | AC 6                   | Unit        |
| [TC-117-07](#tc-117-07) | Negative | AC 5                   | Unit, e2e   |
| [TC-117-08](#tc-117-08) | Positive | AC 1, AC 3, AC 6       | Integration |
| [TC-117-09](#tc-117-09) | Positive | AC 1, AC 2, AC 3, AC 6 | e2e         |
| [TC-117-10](#tc-117-10) | Negative | AC 4, AC 5             | e2e         |

---

### TC-117-01

| Item            | Content                                                                                          |
| --------------- | ------------------------------------------------------------------------------------------------ |
| Test Scenario   | [Positive] AC 1, AC 2: rejecting a Planning event with a reason and an outcome makes it Rejected |
| Pre-conditions  | Signed in as the assigned Coordinator.                                                           |
| Test Steps      | 1. Open the event. <br> 2. Click **Reject event**, give a reason, choose an outcome, confirm.    |
| Test Data       | Submit as a new request                                                                          |
| Expected Result | The event is Rejected with the reason, the outcome, and who decided it and when.                 |

**Automated by:** `tests/unit/reject-planning.test.ts` › "SCRUM-117 [AC1, AC2] TC-117-01: …"

### TC-117-02

| Item            | Content                                                                                                                                                                                  |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Test Scenario   | [Negative] AC 2: the reason and the outcome are both required                                                                                                                            |
| Pre-conditions  | As TC-117-01.                                                                                                                                                                            |
| Test Steps      | 1. Try to reject with a blank reason, with no outcome, or (directly) with an outcome that isn't one of the two.                                                                          |
| Test Data       | —                                                                                                                                                                                        |
| Expected Result | The dialog's **Reject event** stays disabled; direct requests are refused ("A rejection reason is required." / "Choose what the organiser can do next.") and nothing is read or written. |

**Automated by:** `tests/unit/reject-planning.test.ts` › "SCRUM-117 [AC2] TC-117-02: …" and "SCRUM-117 [AC2]: an outcome that isn't one of the two choices …"; `e2e/reject-planning.spec.ts` › TC-117-09 (disabled without an outcome)

### TC-117-03

| Item            | Content                                                                                                                                                                                                             |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Test Scenario   | [Positive] AC 3: rejecting releases everything held for the event, in the same operation                                                                                                                            |
| Pre-conditions  | The event has venue bookings (Pending, Approved), equipment reservations, an open equipment request and a submitted change request.                                                                                 |
| Test Steps      | 1. Reject it.                                                                                                                                                                                                       |
| Test Data       | —                                                                                                                                                                                                                   |
| Expected Result | The bookings, reservations and equipment request are Cancelled (the reserved stock is available again); the change request is Rejected with the same reason. All in one transaction, after the event row is locked. |

**Automated by:** `tests/unit/reject-planning.test.ts` › "SCRUM-117 [AC3] TC-117-03: …"

### TC-117-04

| Item            | Content                                                                     |
| --------------- | --------------------------------------------------------------------------- |
| Test Scenario   | [Negative] AC 1: only a Planning event can be rejected this way             |
| Pre-conditions  | The event is Under Review, Confirmed, Rejected or Cancelled.                |
| Test Steps      | 1. Send a reject request for it.                                            |
| Test Data       | —                                                                           |
| Expected Result | Refused: "Only an event in Planning can be rejected here." Nothing changes. |

**Automated by:** `tests/unit/reject-planning.test.ts` › "SCRUM-117 [AC1] TC-117-04: …"

### TC-117-05

| Item            | Content                                                                                                                                                         |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Test Scenario   | [Negative] AC 4: an event that was ever Confirmed can't be rejected; it is cancelled instead                                                                    |
| Pre-conditions  | The event's history has a Planning → Confirmed entry.                                                                                                           |
| Test Steps      | 1. Open it as the Coordinator. <br> 2. Send a reject request directly.                                                                                          |
| Test Data       | —                                                                                                                                                               |
| Expected Result | No **Reject event** button. The direct request is refused: "This event has been confirmed before, so it can't be rejected. Cancel it instead." Nothing changes. |

**Automated by:** `tests/unit/reject-planning.test.ts` › "SCRUM-117 [AC4] TC-117-05: …"; `tests/unit/readiness-actions.test.ts` › "SCRUM-117 [AC4] TC-117-05: …"; `e2e/reject-planning.spec.ts` › TC-117-10

### TC-117-06

| Item            | Content                                                                                                                                                                |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Test Scenario   | [Positive] AC 6: the Organiser is notified and the rejection is recorded with who and when                                                                             |
| Pre-conditions  | As TC-117-01.                                                                                                                                                          |
| Test Steps      | 1. Reject the event.                                                                                                                                                   |
| Test Data       | —                                                                                                                                                                      |
| Expected Result | The Organiser gets a notice with the reason. History has the status change (with the reason), the outcome, and a summary of what was released, all by the Coordinator. |

**Automated by:** `tests/unit/reject-planning.test.ts` › "SCRUM-117 [AC6] TC-117-06: …"

### TC-117-07

| Item            | Content                                                                                                                                                                   |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Test Scenario   | [Negative] AC 5: only the event's assigned Coordinator can reject it                                                                                                      |
| Pre-conditions  | —                                                                                                                                                                         |
| Test Steps      | 1. Send a reject request as each user below.                                                                                                                              |
| Test Data       | The Organiser; Technical Support; signed out; another Coordinator; any Coordinator when nobody is assigned; a missing event; an event reassigned while the request waited |
| Expected Result | Refused every time (no permission, "Event not found." or "updated by another user"); only the assigned Coordinator is offered the button.                                 |

**Automated by:** `tests/unit/reject-planning.test.ts` › "SCRUM-117 [AC5] TC-117-07: …" and "SCRUM-117 [AC5]: an event reassigned …"; `tests/unit/auth.test.ts` › "SCRUM-117 [AC5] TC-117-07: …"; `tests/unit/readiness-actions.test.ts` › "SCRUM-117 [AC5] TC-117-07: …"

### TC-117-08

| Item            | Content                                                                                                                                                                                               |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Test Scenario   | [Positive] AC 1, AC 3, AC 6: against a real database, everything is released together and the stock returns                                                                                           |
| Pre-conditions  | A Planning event with an approved booking, an approved equipment request with 2 Projectors reserved, and a submitted change request.                                                                  |
| Test Steps      | 1. Reject it.                                                                                                                                                                                         |
| Test Data       | —                                                                                                                                                                                                     |
| Expected Result | The event is Rejected; the booking, reservation and request are Cancelled; the change request is Rejected with the reason; 2 fewer Projectors are held for that period; the Organiser has one notice. |

**Automated by:** `tests/integration/reject-planning.test.ts` › "SCRUM-117 [AC1, AC3, AC6] TC-117-08: …"

### TC-117-09

| Item            | Content                                                                                                                                                                                |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Test Scenario   | [Positive] AC 1, AC 2, AC 3, AC 6: the whole journey                                                                                                                                   |
| Pre-conditions  | A Planning event with an approved booking and a Projector reserved.                                                                                                                    |
| Test Steps      | 1. As the Coordinator, open the event, click **Reject event**, enter a reason (Reject stays disabled), choose **Submit as a new request**, confirm. <br> 2. As the Organiser, open it. |
| Test Data       | —                                                                                                                                                                                      |
| Expected Result | "Event rejected. Its arrangements were released." The booking and reservation are Cancelled. The Organiser sees Rejected, the reason, and "Next step: Submit as a new request".        |

**Automated by:** `e2e/reject-planning.spec.ts` › "SCRUM-117 [AC1, AC2, AC3, AC6] TC-117-09: …"

### TC-117-10

| Item            | Content                                                                                                 |
| --------------- | ------------------------------------------------------------------------------------------------------- |
| Test Scenario   | [Negative] AC 4, AC 5: Reject isn't offered on an event that was Confirmed before, nor to its Organiser |
| Pre-conditions  | A Planning event whose history has a Planning → Confirmed entry.                                        |
| Test Steps      | 1. Open it as the Coordinator, then as the Organiser.                                                   |
| Test Data       | —                                                                                                       |
| Expected Result | The readiness checklist shows, without a **Reject event** button, for both.                             |

**Automated by:** `e2e/reject-planning.spec.ts` › "SCRUM-117 [AC4, AC5] TC-117-10: …"
