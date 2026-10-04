# SCRUM-126 — Coordinator decides whether a rejected request is amended or submitted as new: test cases

Story and acceptance criteria: [docs/backlog/SCRUM-126.md](../backlog/SCRUM-126.md).
Format and conventions: [README.md](README.md). The outcome is chosen in
`transitionEventStatus`, enforced in `submitEventRequest`, and a new request is
started by `startRequestFromRejected`, all in
[app/(app)/events/actions.ts](<../../app/(app)/events/actions.ts>). The
decisions behind them are [ADR 0013](../adr/0013-rejection-outcome.md).

**Shared pre-conditions for every case:** the database is migrated and seeded
and the app is running. Unless the case says otherwise, the event is Under
Review, owned by `organiser@test.local` and assigned to
`coordinator@test.local` (both `Password123!`).

| ID                      | Type        | Criterion                    | Automated              |
| ----------------------- | ----------- | ---------------------------- | ---------------------- |
| [TC-126-01](#tc-126-01) | Positive    | AC 1                         | Unit, integration      |
| [TC-126-02](#tc-126-02) | Negative    | AC 1                         | Unit, integration, e2e |
| [TC-126-03](#tc-126-03) | Positive    | AC 2                         | Unit, e2e              |
| [TC-126-04](#tc-126-04) | Negative    | AC 3                         | Unit, e2e              |
| [TC-126-05](#tc-126-05) | Positive    | AC 4                         | Unit, e2e              |
| [TC-126-06](#tc-126-06) | Negative    | AC 4                         | Unit                   |
| [TC-126-07](#tc-126-07) | Positive    | AC 6                         | Unit, e2e              |
| [TC-126-08](#tc-126-08) | Positive    | AC 1, AC 3, AC 4, AC 5, AC 6 | e2e                    |
| [TC-126-09](#tc-126-09) | Boundary    | AC 7                         | Integration            |
| [TC-126-10](#tc-126-10) | Concurrency | AC 4                         | Unit, integration, e2e |

---

### TC-126-01

| Item            | Content                                                                                                               |
| --------------- | --------------------------------------------------------------------------------------------------------------------- |
| Test Case ID    | TC-126-01                                                                                                             |
| Test Scenario   | [Positive] AC 1: rejecting with a reason and an outcome saves both                                                    |
| Pre-conditions  | Signed in as the assigned Coordinator.                                                                                |
| Test Steps      | 1. On **Events**, click **Reject** on the event. <br> 2. Enter a reason, choose an outcome, click **Reject request**. |
| Test Data       | (a) Amend and resubmit <br> (b) Submit as a new request                                                               |
| Expected Result | The event is Rejected with that reason and that outcome.                                                              |

**Automated by:** `tests/unit/rejection-outcome.test.ts` › "SCRUM-126 [AC1] TC-126-01: …"; `tests/integration/rejection-outcome.test.ts` › "SCRUM-126 [AC1] TC-126-01: …"

### TC-126-02

| Item            | Content                                                                                                                                                                                 |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Test Case ID    | TC-126-02                                                                                                                                                                               |
| Test Scenario   | [Negative] AC 1: a rejection without an outcome cannot be made                                                                                                                          |
| Pre-conditions  | As TC-126-01.                                                                                                                                                                           |
| Test Steps      | 1. Enter a reason but choose no outcome. <br> 2. Send a reject request directly with no outcome, or one that isn't of the two choices.                                                  |
| Test Data       | No outcome; outcome "CANCEL"                                                                                                                                                            |
| Expected Result | **Reject request** stays disabled. A direct request is refused ("Choose what the organiser can do next."); nothing changes. The database also refuses a Rejected event with no outcome. |

**Automated by:** `tests/unit/rejection-outcome.test.ts` › "SCRUM-126 [AC1] TC-126-02: …" (both); `tests/integration/rejection-outcome.test.ts` › "SCRUM-126 [AC1] TC-126-02: …"; `e2e/events.spec.ts` (both reject journeys check the button stays disabled without an outcome)

### TC-126-03

| Item            | Content                                                                                                        |
| --------------- | -------------------------------------------------------------------------------------------------------------- |
| Test Case ID    | TC-126-03                                                                                                      |
| Test Scenario   | [Positive] AC 2: after Amend and resubmit, the Organiser sees Amend & Resubmit and can resubmit the same event |
| Pre-conditions  | The event was rejected with Amend and resubmit. Signed in as `organiser@test.local`.                           |
| Test Steps      | 1. Click **Amend & Resubmit**, change a field, submit.                                                         |
| Test Data       | —                                                                                                              |
| Expected Result | The same event goes back into review; its reason and outcome are cleared.                                      |

**Automated by:** `tests/unit/rejection-outcome.test.ts` › "SCRUM-126 [AC2] TC-126-03: …"; `e2e/events.spec.ts` › "coordinator rejects with a reason, organiser sees it, amends and resubmits it back into review"

### TC-126-04

| Item            | Content                                                                                                      |
| --------------- | ------------------------------------------------------------------------------------------------------------ |
| Test Case ID    | TC-126-04                                                                                                    |
| Test Scenario   | [Negative] AC 3: after Submit as a new request, Amend & Resubmit is not offered and the event stays Rejected |
| Pre-conditions  | The event was rejected with Submit as a new request. Signed in as `organiser@test.local`.                    |
| Test Steps      | 1. Look at the event's row. <br> 2. Send a resubmit request for it directly.                                 |
| Test Data       | —                                                                                                            |
| Expected Result | No **Amend & Resubmit** button. The direct request is refused and nothing changes.                           |

**Automated by:** `tests/unit/rejection-outcome.test.ts` › "SCRUM-126 [AC3] TC-126-04: …"; `e2e/rejection-outcome.spec.ts` › "SCRUM-126 [AC1, AC3, AC4, AC5, AC6] TC-126-08: …"

### TC-126-05

| Item            | Content                                                                                                                                                            |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Test Case ID    | TC-126-05                                                                                                                                                          |
| Test Scenario   | [Positive] AC 4: Start New Request creates a Draft with the rejected event's details and no link to its arrangements or history                                    |
| Pre-conditions  | As TC-126-04.                                                                                                                                                      |
| Test Steps      | 1. Click **Start New Request**.                                                                                                                                    |
| Test Data       | —                                                                                                                                                                  |
| Expected Result | "A new draft was started from this request." A Draft with the same details appears under Drafts, with no coordinator or decision. The rejected event is unchanged. |

**Automated by:** `tests/unit/rejection-outcome.test.ts` › "SCRUM-126 [AC4] TC-126-05: …"; `e2e/rejection-outcome.spec.ts` › "SCRUM-126 [AC1, AC3, AC4, AC5, AC6] TC-126-08: …"

### TC-126-06

| Item            | Content                                                                                                                                                               |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Test Case ID    | TC-126-06                                                                                                                                                             |
| Test Scenario   | [Negative] AC 4: only the Organiser of a request rejected as needing a new request can start one from it                                                              |
| Pre-conditions  | —                                                                                                                                                                     |
| Test Steps      | 1. Ask to start a new request from each event below, or as each user below.                                                                                           |
| Test Data       | An event rejected for amendment; an event that isn't Rejected; another Organiser's event; a missing event; a Coordinator, Venue Staff, Technical Support, an Attendee |
| Expected Result | Refused every time ("Event not found." or no permission); no Draft is created.                                                                                        |

**Automated by:** `tests/unit/rejection-outcome.test.ts` › "SCRUM-126 [AC4] TC-126-06: …" (both)

### TC-126-07

| Item            | Content                                                                                         |
| --------------- | ----------------------------------------------------------------------------------------------- |
| Test Case ID    | TC-126-07                                                                                       |
| Test Scenario   | [Positive] AC 6: the outcome is recorded in the event history with who chose it and when        |
| Pre-conditions  | As TC-126-01.                                                                                   |
| Test Steps      | 1. Reject the event with an outcome.                                                            |
| Test Data       | Submit as a new request                                                                         |
| Expected Result | A history entry for `rejectionOutcome`, new value NEW_REQUEST, by the Coordinator, timestamped. |

**Automated by:** `tests/unit/rejection-outcome.test.ts` › "SCRUM-126 [AC6] TC-126-07: …"; `e2e/rejection-outcome.spec.ts` › "… TC-126-08: …"

### TC-126-08

| Item            | Content                                                                                                                                                                                 |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Test Case ID    | TC-126-08                                                                                                                                                                               |
| Test Scenario   | [Positive] AC 1, AC 3, AC 4, AC 5, AC 6: the whole journey for a request rejected as needing a new request                                                                              |
| Pre-conditions  | The event is Under Review.                                                                                                                                                              |
| Test Steps      | 1. As the Coordinator, reject it with a reason and **Submit as a new request**. <br> 2. As the Organiser, open its details. <br> 3. Click **Start New Request**.                        |
| Test Data       | —                                                                                                                                                                                       |
| Expected Result | The details show the reason and "Next step: Submit as a new request" (AC 5); there is no Amend & Resubmit; a Draft with the same details appears and the rejected event stays Rejected. |

**Automated by:** `e2e/rejection-outcome.spec.ts` › "SCRUM-126 [AC1, AC3, AC4, AC5, AC6] TC-126-08: …". AC 5 for Amend and resubmit is also checked by `e2e/events.spec.ts` › the SCRUM-19 reject-and-amend journey.

### TC-126-09

| Item            | Content                                                                                                                      |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Test Case ID    | TC-126-09                                                                                                                    |
| Test Scenario   | [Boundary] AC 7: rejections recorded before this story are treated as Amend and resubmit                                     |
| Pre-conditions  | A Rejected event and a Draft from before the migration.                                                                      |
| Test Steps      | 1. Run the migration `20261003120000_event_rejection_outcome`.                                                               |
| Test Data       | —                                                                                                                            |
| Expected Result | The Rejected event's outcome is Amend and resubmit; the Draft has none. The seeded rejected concert offers Amend & Resubmit. |

**Automated by:** `tests/integration/rejection-outcome.test.ts` › "SCRUM-126 [AC7] TC-126-09: …"

### TC-126-10

| Item            | Content                                                                                                                                                                                  |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Test Case ID    | TC-126-10                                                                                                                                                                                |
| Test Scenario   | [Concurrency] AC 4: starting a new request again, or twice at the same moment, creates only one Draft                                                                                    |
| Pre-conditions  | As TC-126-04.                                                                                                                                                                            |
| Test Steps      | 1. Click **Start New Request**. <br> 2. Go back to **All** and click it again. <br> 3. Separately, send two start requests at the same moment.                                           |
| Test Data       | —                                                                                                                                                                                        |
| Expected Result | Step 2 says "A draft was already started from this request. Find it under Drafts." Exactly one Draft exists in every case; the rejected event's history records which Draft was started. |

**Automated by:** `tests/unit/rejection-outcome.test.ts` › "SCRUM-126 [AC4] TC-126-10: …" (both); `tests/integration/rejection-outcome.test.ts` › "SCRUM-126 [AC4] TC-126-10: …"; `e2e/rejection-outcome.spec.ts` › "… TC-126-08: …" (the repeat click)
