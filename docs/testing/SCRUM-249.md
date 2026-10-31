# SCRUM-249 — An overdue event can still be approved or confirmed: test cases

SCRUM-249 is a Bug task in Jira, with four acceptance criteria:
[docs/backlog/SCRUM-249.md](../backlog/SCRUM-249.md).

Format and conventions: [README.md](README.md).

**Where the behaviour lives:** `transitionEventStatus` and `confirmEvent` in
`app/(app)/events/actions.ts` refuse with `OVERDUE_REFUSAL`, using `isOverdue`
from `lib/event-closing.ts`. `nextStep` in `lib/event-next-step.ts` writes the
banner. `components/events/review-decision.tsx` doesn't offer Approve.

**Shared pre-conditions:** a seeded database (`npm run db:seed`), signed in as
`coordinator@test.local` or `organiser@test.local` / `Password123!`. Each
automated case creates its own event. To try one by hand, use the seeded
"Under Review: Overdue — Volunteer Thank-You Tea" and "Planning: Overdue —
Campus Cleanup".

| ID | Type | Criterion | Automated |
|---|---|---|---|
| [TC-249-01](#tc-249-01) | Negative | AC 1 | integration |
| [TC-249-02](#tc-249-02) | Positive | AC 1 | integration |
| [TC-249-03](#tc-249-03) | Negative | AC 2 | integration |
| [TC-249-04](#tc-249-04) | Positive | AC 2 | integration |
| [TC-249-05](#tc-249-05) | Boundary | AC 1, AC 2, AC 3 | unit |
| [TC-249-06](#tc-249-06) | Boundary | AC 3 | unit |
| [TC-249-07](#tc-249-07) | Positive | AC 4 | unit |
| [TC-249-08](#tc-249-08) | Negative | AC 4 | unit |
| [TC-249-09](#tc-249-09) | Concurrency | AC 3 | integration |
| [TC-249-10](#tc-249-10) | Positive | AC 1, AC 4 | e2e |
| [TC-249-11](#tc-249-11) | Positive | AC 4 | e2e |
| [TC-249-12](#tc-249-12) | Negative | AC 4 | e2e |

### TC-249-01

| Item | Content |
|---|---|
| Test Case ID | TC-249-01 |
| Test Scenario | [Negative] AC 1: approving an overdue request is refused and nothing is saved |
| Pre-conditions | An event Under Review, assigned to the signed-in Coordinator, whose start has passed, with an open clarification question |
| Test Steps | 1. Call approve on the event. |
| Test Data | Start 2001-03-05 10:00 SGT |
| Expected Result | Refused with "This event is overdue: its start time has passed. It can be rejected or cancelled." The event stays Under Review with no decision recorded, no history entry or notification is written, and the question stays open. |

**Automated by:** `tests/integration/overdue-events.test.ts` › "SCRUM-249 [AC1] TC-249-01: approving an overdue request is refused, and it stays Under Review with nothing written"

### TC-249-02

| Item | Content |
|---|---|
| Test Case ID | TC-249-02 |
| Test Scenario | [Positive] AC 1: rejecting an overdue request still works |
| Pre-conditions | As TC-249-01, without the question |
| Test Steps | 1. Reject the event with a reason and an outcome. |
| Test Data | Reason "Its date has passed."; outcome New request |
| Expected Result | The event is Rejected with that reason. |

**Automated by:** `tests/integration/overdue-events.test.ts` › "SCRUM-249 [AC1] TC-249-02: rejecting an overdue request still works"

### TC-249-03

| Item | Content |
|---|---|
| Test Case ID | TC-249-03 |
| Test Scenario | [Negative] AC 2: confirming an overdue event that is otherwise ready is refused and nothing is saved |
| Pre-conditions | A Planning event assigned to the signed-in Coordinator, with an Approved booking, No equipment needed and an Approved safety check |
| Test Steps | 1. Confirm the event with its start in the past. <br> 2. Confirm the same arrangements with a start in the future. |
| Test Data | Start 2001-03-05 10:00 SGT, then 2036-03-05 10:00 SGT |
| Expected Result | Step 1 is refused with the message in TC-249-01. The event stays in Planning, registration stays closed, no confirmed details are recorded, and no history entry or notification is written. Step 2 is confirmed, so only the start refused step 1. |

**Automated by:** `tests/integration/overdue-events.test.ts` › "SCRUM-249 [AC2] TC-249-03: confirming an overdue event that is otherwise ready is refused, and it stays in Planning with nothing written" and "SCRUM-249 [AC2] TC-249-03: the same event, starting later, can be confirmed, so only its start refused it"

### TC-249-04

| Item | Content |
|---|---|
| Test Case ID | TC-249-04 |
| Test Scenario | [Positive] AC 2: an overdue Planning event can still be rejected and cancelled |
| Pre-conditions | Two overdue Planning events assigned to the signed-in Coordinator |
| Test Steps | 1. Reject the first (SCRUM-117). <br> 2. Cancel the second (SCRUM-82). |
| Test Data | Reason "Its date has passed." |
| Expected Result | The first is Rejected and the second Cancelled. |

**Automated by:** `tests/integration/overdue-events.test.ts` › "SCRUM-249 [AC2] TC-249-04: an overdue Planning event can still be rejected (SCRUM-117)" and "SCRUM-249 [AC2] TC-249-04: an overdue Planning event can still be cancelled (SCRUM-82)"

### TC-249-05

| Item | Content |
|---|---|
| Test Case ID | TC-249-05 |
| Test Scenario | [Boundary] AC 1, AC 2, AC 3: one millisecond past its start, approving and confirming are refused, under the lock, and being overdue is the reason given even with arrangements outstanding |
| Pre-conditions | The clock fixed; the database mocked |
| Test Steps | 1. Approve a request starting 1 ms ago. <br> 2. Confirm an event starting 1 ms ago, ready and then not ready. |
| Test Data | Now 2031-06-01 10:00 SGT |
| Expected Result | Each is refused with the message in TC-249-01 and nothing is written. The row is locked before the event is read. |

**Automated by:** `tests/unit/event-status.test.ts` › "SCRUM-249 [AC1, AC3] TC-249-05: one millisecond past its start, approval is refused and nothing is written" and "SCRUM-249 [AC3] TC-249-05: the check reads the event after locking its row"; `tests/unit/event-confirm.test.ts` › "SCRUM-249 [AC2, AC3] TC-249-05: one millisecond past its start, a ready event is refused and nothing is written", "SCRUM-249 [AC2] TC-249-05: an overdue event is refused for being overdue even with arrangements outstanding" and "SCRUM-249 [AC3] TC-249-05: the check reads the event after locking its row"

### TC-249-06

| Item | Content |
|---|---|
| Test Case ID | TC-249-06 |
| Test Scenario | [Boundary] AC 3: an event starting exactly now, or later, can still be approved and confirmed |
| Pre-conditions | As TC-249-05 |
| Test Steps | 1. Approve and confirm with the start exactly now. <br> 2. Approve and confirm with the start 1 ms from now. |
| Test Data | Now 2031-06-01 10:00 SGT |
| Expected Result | Each succeeds. |

**Automated by:** `tests/unit/event-status.test.ts` › "SCRUM-249 [AC3] TC-249-06: a request starting %s can still be approved"; `tests/unit/event-confirm.test.ts` › "SCRUM-249 [AC3] TC-249-06: an event starting %s can still be confirmed"

### TC-249-07

| Item | Content |
|---|---|
| Test Case ID | TC-249-07 |
| Test Scenario | [Positive] AC 4: the banner tells the overdue event's Coordinator to cancel or reject it, ahead of anything else waiting on it |
| Pre-conditions | The Coordinator's view of an overdue event: Under Review; in Planning and ready to confirm; in Planning with a flagged arrangement and a change request waiting |
| Test Steps | 1. Work out the Next step for each. |
| Test Data | — |
| Expected Result | Each reads "Your turn: this event is overdue, so reject it or cancel it". Under Review it offers the review decision; in Planning it goes to Arrangements, where Reject event is. |

**Automated by:** `tests/unit/event-next-step.test.ts` › "SCRUM-249 [AC4] TC-249-07: Under Review, its Coordinator is told to close it, with Reject at hand", "SCRUM-249 [AC4] TC-249-07: in Planning, even when ready to confirm, its Coordinator is told to close it, and goes to where Reject is" and "SCRUM-249 [AC4] TC-249-07: it comes before flagged arrangements and change requests, which can't save an overdue event"

### TC-249-08

| Item | Content |
|---|---|
| Test Case ID | TC-249-08 |
| Test Scenario | [Negative] AC 4: nobody else's banner changes |
| Pre-conditions | The Organiser's view of an overdue event; the Coordinator's view of an event that isn't overdue |
| Test Steps | 1. Work out the Next step for each. |
| Test Data | — |
| Expected Result | The Organiser reads "Waiting for Cody Coordinator to review the request". The Coordinator is still asked to approve, or to confirm. |

**Automated by:** `tests/unit/event-next-step.test.ts` › "SCRUM-249 [AC4] TC-249-08: the Organiser can't close it, so their banner is unchanged" and "SCRUM-249 [AC4] TC-249-08: an event that isn't overdue still asks its Coordinator to approve or confirm it"

### TC-249-09

| Item | Content |
|---|---|
| Test Case ID | TC-249-09 |
| Test Scenario | [Concurrency] AC 3: the check is made under the event-row lock, so it sees a start moved while it waited |
| Pre-conditions | Another transaction holds the event's lock and moves its start |
| Test Steps | 1. Approve or confirm while the lock is held. <br> 2. Wait until the action is waiting on the lock. <br> 3. Commit the move. |
| Test Data | Moves from 2036 to 2001, and from 2001 to 2036 |
| Expected Result | Moved into the past, approving and confirming are refused and the status is unchanged. Moved later, approving succeeds. |

**Automated by:** `tests/integration/overdue-events.test.ts` › "SCRUM-249 [AC3] TC-249-09: approval waits for the event's lock and sees a start moved into the past while it waited", "SCRUM-249 [AC3] TC-249-09: approval waits for the event's lock and sees a start moved later while it waited" and "SCRUM-249 [AC3] TC-249-09: confirming waits for the event's lock and sees a start moved into the past while it waited"

### TC-249-10

| Item | Content |
|---|---|
| Test Case ID | TC-249-10 |
| Test Scenario | [Positive] AC 1, AC 4: Under Review, the Coordinator is told to close it, isn't offered Approve, and can reject it |
| Pre-conditions | An overdue event Under Review, assigned to the signed-in Coordinator |
| Test Steps | 1. Open Events and find the event. <br> 2. Open it. <br> 3. Reject it from the banner. |
| Test Data | `coordinator@test.local`; reason "Its date has passed." |
| Expected Result | Its row shows Overdue and Reject, not Approve. The banner reads as in TC-249-07, without Approve. After rejecting, the page reads "This request was rejected." |

**Automated by:** `e2e/overdue-events.spec.ts` › "SCRUM-249 [AC1, AC4] TC-249-10: Under Review, the Coordinator is told to close it, isn't offered Approve, and can reject it"

### TC-249-11

| Item | Content |
|---|---|
| Test Case ID | TC-249-11 |
| Test Scenario | [Positive] AC 4: in Planning, the banner leads to Reject event, and Cancel event is on the page |
| Pre-conditions | An overdue Planning event assigned to the signed-in Coordinator |
| Test Steps | 1. Open the event. <br> 2. Choose Go to Arrangements. |
| Test Data | `coordinator@test.local` |
| Expected Result | The banner reads as in TC-249-07, Cancel event is shown, and Arrangements shows Reject event. |

**Automated by:** `e2e/overdue-events.spec.ts` › "SCRUM-249 [AC4] TC-249-11: in Planning, the banner leads to Reject event, and Cancel event is on the page"

### TC-249-12

| Item | Content |
|---|---|
| Test Case ID | TC-249-12 |
| Test Scenario | [Negative] AC 4: the Organiser's banner still waits for the Coordinator |
| Pre-conditions | An overdue event Under Review, belonging to the signed-in Organiser |
| Test Steps | 1. Open the event. |
| Test Data | `organiser@test.local` |
| Expected Result | The banner waits for the Coordinator to review the request and doesn't mention Overdue. |

**Automated by:** `e2e/overdue-events.spec.ts` › "SCRUM-249 [AC4] TC-249-12: the Organiser's banner still waits for the Coordinator"
