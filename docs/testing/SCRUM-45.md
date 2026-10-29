# SCRUM-45 — Organiser and Coordinator workflow notifications: test cases

Story and acceptance criteria: [docs/backlog/SCRUM-45.md](../backlog/SCRUM-45.md).
Format and conventions: [README.md](README.md). The notices are read in the
notification list ([SCRUM-48](SCRUM-48.md)), which links each one to its
event.

**Shared pre-conditions for every case:** a local PostgreSQL migrated with
`npm run db:deploy` and seeded with `npm run db:seed`. Accounts use the
password `Password123!`. Each automated case makes its own event (assigned to
`coordinator@test.local` or the second seeded Coordinator) and removes it.

**Notices sent by the stories that build their steps:** the Lead's
assignment (AC1's second half) is SCRUM-165's, a cancellation (AC6) is
SCRUM-82's, and a change request's outcome (AC9) is SCRUM-128's; TC-45-01,
TC-45-11 and TC-45-12 cite their tests. Cancelling also withdraws the
registration-closed notice written ahead in TC-45-07 (SCRUM-82's TC-82-04).
Reassignment's notices (AC10) are SCRUM-21's; TC-45-13 cites its tests. Every criterion is covered.

| ID | Type | Criterion | Automated |
|---|---|---|---|
| [TC-45-01](#tc-45-01) | Positive, Negative | AC 1 | Unit, integration |
| [TC-45-02](#tc-45-02) | Positive, Negative | AC 2, AC 13 | Integration, e2e |
| [TC-45-03](#tc-45-03) | Positive | AC 3 | Unit, integration, e2e |
| [TC-45-04](#tc-45-04) | Positive, Negative | AC 4, AC 13 | Unit, integration |
| [TC-45-05](#tc-45-05) | Positive, Negative | AC 8, AC 14 | Unit, integration |
| [TC-45-06](#tc-45-06) | Positive, Boundary | AC 11, AC 13 | Unit, integration |
| [TC-45-07](#tc-45-07) | Positive | AC 11 | Unit, integration |
| [TC-45-08](#tc-45-08) | Positive, Negative | AC 12, AC 13 | Unit |
| [TC-45-09](#tc-45-09) | Positive, Negative | AC 5, AC 12, AC 13 | Unit, integration, e2e |
| [TC-45-10](#tc-45-10) | Positive, Negative | AC 7, AC 12, AC 13 | Unit, integration, e2e |
| [TC-45-11](#tc-45-11) | Positive | AC 6 | Unit, integration (SCRUM-82's) |
| [TC-45-12](#tc-45-12) | Positive | AC 9 | Unit (SCRUM-128's) |
| [TC-45-13](#tc-45-13) | Positive, Concurrency | AC 10, AC 13 | Unit, integration, e2e (SCRUM-21's) |

AC 15 (no duplicates of SCRUM-85's or SCRUM-124's notices) holds by
construction: every notice here goes to the event's Organiser or Coordinator.

---

### TC-45-01

| Item | Content |
|---|---|
| Test Case ID | TC-45-01 |
| Test Scenario | [Positive, Negative] AC 1: a submitted request tells its Organiser it is waiting to be assigned |
| Pre-conditions | Signed in as `organiser@test.local`. |
| Test Steps | 1. Submit a new event request "Career Fair". <br> 2. Resubmit an amended rejected request whose Coordinator still holds the role. <br> 3. Submit a draft someone else submitted at the same moment. <br> 4. As the Lead, assign "Career Fair" to a Coordinator (SCRUM-165). |
| Test Data | — |
| Expected Result | Step 1: the Organiser gets "Request submitted": "\"Career Fair\" was submitted and is waiting to be assigned to a Coordinator." No assignment notice is sent yet: the request waits for the Lead. Step 2: it goes straight back to its Coordinator, so no submission notice. Step 3: one submission, with one set of notices. Step 4: the Organiser and the assigned Coordinator are each told. |

**Automated by:** `tests/unit/submission-queue.test.ts` › "SCRUM-45 [AC1, AC12] TC-45-01: the Organiser is told the request was submitted and is waiting to be assigned; no assignment notice is sent until the Lead assigns"; `tests/unit/lead-queue.test.ts` › "SCRUM-165 [AC5] TC-165-07: [Positive] the Coordinator and the Organiser are notified" (step 4); `tests/unit/clarification-and-amend.test.ts` › "SCRUM-108 [AC9, AC11, AC14] TC-108-05, SCRUM-165 [AC9] TC-165-12: the amended request goes back to the same Coordinator, and the resubmission is recorded", "SCRUM-108 [AC14] TC-108-14, SCRUM-165 [AC9] TC-165-12: when its Coordinator lost the role, the resubmitted request returns to the queue and the history records who held it" and "SCRUM-108 [AC12] TC-108-08: …"; `tests/integration/concurrency.test.ts` › "SCRUM-124 [AC10] TC-124-10, SCRUM-14 [AC3] TC-14-05, SCRUM-45 [AC1] TC-45-01: SCRUM-14 AC: two simultaneous submissions of one draft succeed once and notify once"

### TC-45-02

| Item | Content |
|---|---|
| Test Case ID | TC-45-02 |
| Test Scenario | [Positive, Negative] AC 2, AC 13: an approved request tells its Organiser once |
| Pre-conditions | Signed in as the Coordinator of an Under Review request. |
| Test Steps | 1. Approve it. <br> 2. Approve it again (another tab). |
| Test Data | `coordinator@test.local` |
| Expected Result | Step 1: it moves to Planning, and the Organiser gets "Your request was approved": "\"…\" was approved and is now being planned." Step 2: refused, and no second notice. |

**Automated by:** `e2e/workflow-notifications.spec.ts` › "SCRUM-45 [AC2, AC12] TC-45-02: approving a request in the app tells its Organiser, naming the event"; `tests/integration/workflow-notifications.test.ts` › "SCRUM-45 [AC2, AC12, AC13] TC-45-02: approving a request tells its Organiser once, naming the event"

### TC-45-03

| Item | Content |
|---|---|
| Test Case ID | TC-45-03 |
| Test Scenario | [Positive] AC 3: a rejected request or Planning event tells its Organiser the reason and what they can do next |
| Pre-conditions | An Under Review request, and a Planning event, each with its Coordinator signed in. |
| Test Steps | 1. Reject the request with "The date clashes with exam week." and Amend and resubmit. <br> 2. Reject the Planning event with "No venue can take it." and Submit as a new request. |
| Test Data | — |
| Expected Result | Step 1: "Your request was rejected": "\"…\" was rejected: The date clashes with exam week. What you can do next: Amend and resubmit." Step 2: "Your event was rejected": "\"…\" couldn't be arranged and was rejected: No venue can take it. What you can do next: Submit as a new request." A reason typed without a full stop gets one, so it doesn't run into the next step. |

**Automated by:** `e2e/workflow-notifications.spec.ts` › "SCRUM-45 [AC3] TC-45-03: rejecting a request in the app tells its Organiser the reason and what they can do next"; `tests/integration/workflow-notifications.test.ts` › both "SCRUM-45 [AC3] TC-45-03: …" tests; `tests/unit/reject-planning.test.ts` › "SCRUM-117 [AC6] TC-117-06: …"

### TC-45-04

| Item | Content |
|---|---|
| Test Case ID | TC-45-04 |
| Test Scenario | [Positive, Negative] AC 4, AC 13: a confirmed event tells its Organiser once |
| Pre-conditions | A ready Planning event (an approved booking covering it, no equipment), its Coordinator signed in. |
| Test Steps | 1. Confirm it. <br> 2. Confirm it again. <br> 3. On another event whose Registration needed is No, confirm it. |
| Test Data | — |
| Expected Result | Step 1: "Your event is confirmed": "\"…\" is confirmed, and registration is open." Step 2: no second notice. Step 3: "\"Gala\" is confirmed.", with no registration-closed notice. With registration opening later it says when ("Registration opens at …"), and with its window already closed it says so instead of "registration is open". |

**Automated by:** `tests/integration/workflow-notifications.test.ts` › "SCRUM-45 [AC4, AC11, AC13] TC-45-04, TC-45-07: …"; `tests/unit/event-confirm.test.ts` › "SCRUM-45 [AC4, AC11] TC-45-04: with registration not needed, the Organiser is told it is confirmed, and no registration-closed notice is written"

### TC-45-05

| Item | Content |
|---|---|
| Test Case ID | TC-45-05 |
| Test Scenario | [Positive, Negative] AC 8, AC 14: a clarification tells the Organiser what is needed, and its answer tells the Coordinator, with no status notice |
| Pre-conditions | An Under Review request, its Coordinator signed in. |
| Test Steps | 1. Ask "Which room layout do you need?". <br> 2. As the Organiser, answer it. |
| Test Data | — |
| Expected Result | Step 1: the Organiser's only notice is "Clarification requested": "Your coordinator has asked a question about \"…\": Which room layout do you need?"; no Event status notice. Step 2: the Coordinator gets "Clarification answered". |

**Automated by:** `tests/integration/workflow-notifications.test.ts` › "SCRUM-45 [AC8, AC14] TC-45-05: a clarification question tells the Organiser what is needed, and writes no status notice"; `tests/unit/clarification.test.ts` › "SCRUM-18 [AC4, AC6] TC-18-05, SCRUM-45 [AC8, AC14] TC-45-05: [Positive] organiser responds, clarification is marked answered, coordinator is notified"

### TC-45-06

| Item | Content |
|---|---|
| Test Case ID | TC-45-06 |
| Test Scenario | [Positive, Boundary] AC 11, AC 13: registration reaching capacity, and a withdrawal from a full event, tell the Organiser and the Coordinator |
| Pre-conditions | A Confirmed event with capacity 2 and registration open. |
| Test Steps | 1. `attendee@test.local` registers. <br> 2. `attendee2@test.local` registers. <br> 3. `attendee@test.local` withdraws, then withdraws again. <br> 4. `attendee2@test.local` withdraws. |
| Test Data | — |
| Expected Result | Step 1: no notice (one place left). Step 2: "Registration is full": "\"…\" has reached its capacity of 2.", once each to the Organiser and the Coordinator. Step 3: "A place opened at a full event", once each; withdrawing again writes nothing. Step 4: no notice, since the event wasn't full. An event with no capacity set never sends one, and neither does a withdrawal someone else made a moment earlier. |

**Automated by:** `tests/integration/workflow-notifications.test.ts` › "SCRUM-45 [AC11, AC13] TC-45-06: the registration that fills the last place, and a withdrawal from the full event, each tell the Organiser and Coordinator once"; `tests/unit/registration-actions.test.ts` › the "SCRUM-45 … TC-45-06" tests

### TC-45-07

| Item | Content |
|---|---|
| Test Case ID | TC-45-07 |
| Test Scenario | [Positive] AC 11: registration closing at its closing time tells the Organiser and the Coordinator then |
| Pre-conditions | A ready Planning event whose registration will open. |
| Test Steps | 1. Confirm it, with no registration window. <br> 2. Confirm another whose window closes on 30 May 2031, 6:00 pm, before it starts. |
| Test Data | — |
| Expected Result | A "Registration closed" notice for each of them, written at confirmation and shown from the closing time: the event's start in step 1, 30 May 2031, 6:00 pm SGT in step 2 ("Registration for \"Gala\" closed at 30 May 2031, 6:00 pm SGT."). It doesn't appear before then (SCRUM-48 AC8). A closing time already past writes no notice, which would otherwise show at once beside the confirmation. When SCRUM-82 cancels the event or SCRUM-128 moves its times, they find this notice as the event's "Registration closed" one not yet shown, and withdraw it. |

**Automated by:** `tests/integration/workflow-notifications.test.ts` › "SCRUM-45 [AC4, AC11, AC13] TC-45-04, TC-45-07: …"; `tests/unit/event-confirm.test.ts` › "SCRUM-45 [AC11] TC-45-07: a registration window closing before the event starts shows its notice at the closing time"; `tests/unit/event-notifications.test.ts` › "SCRUM-45 [AC11] TC-45-07: …"

### TC-45-08

| Item | Content |
|---|---|
| Test Case ID | TC-45-08 |
| Test Scenario | [Positive, Negative] AC 12, AC 13: every notice names the event and links to it, once per recipient |
| Pre-conditions | — |
| Test Steps | 1. Write a notice to the Organiser and the Coordinator. <br> 2. Write one naming the Organiser twice and a Coordinator who isn't assigned. |
| Test Data | — |
| Expected Result | Step 1: one each, about the event (so the list links to it), with the title and message given. Step 2: one, to the Organiser. |

**Automated by:** `tests/unit/event-notifications.test.ts` › "SCRUM-45 [AC12] TC-45-08: …" and "SCRUM-45 [AC13] TC-45-08: …"

### TC-45-09

| Item | Content |
|---|---|
| Test Case ID | TC-45-09 |
| Test Scenario | [Positive, Negative] AC 5, AC 12, AC 13: a Confirmed event back in Planning tells its Organiser why |
| Pre-conditions | A Confirmed event with an approved venue booking. Signed in as its Coordinator. |
| Test Steps | 1. Approve a change request that changes its expected attendance (SCRUM-128). <br> 2. On another Confirmed event, cancel a booking flagged Needs Reconsideration (SCRUM-26). <br> 3. Approve an impactful change for an event in Planning. |
| Test Data | Expected attendance 40 → 60 |
| Expected Result | Step 1: the Organiser gets "Your event is back in Planning": '"[event]" is back in Planning: a change to Expected attendance was approved. It needs confirming again before new registrations open.' Step 2: the same title, "its Coordinator cancelled a venue booking that needed reconsideration" (or "equipment", for a reservation). Each is written once, with the status change. Step 3: it isn't Confirmed, so no such notice. |

**Automated by:** `tests/unit/change-decision.test.ts` › "SCRUM-45 [AC5, AC12] TC-45-09: back in Planning, the Organiser is told why" and `tests/unit/change-decision.test.ts` › "SCRUM-128 [AC6] TC-128-05, SCRUM-45 [AC5] TC-45-09: an impactful change to an event Under Review or in Planning keeps its status, and sends no back-in-Planning notice"; `tests/unit/reconsideration-actions.test.ts` › "SCRUM-45 [AC5, AC12] TC-45-09: cancelling a flagged %s of a Confirmed event tells its Organiser why it is back in Planning"; `tests/integration/workflow-notifications.test.ts` › "SCRUM-45 [AC5, AC12, AC13] TC-45-09: an approved change that returns a Confirmed event to Planning tells its Organiser once, with the reason" and `tests/integration/workflow-notifications.test.ts` › "SCRUM-45 [AC5, AC12, AC13] TC-45-09: cancelling a flagged booking of a Confirmed event tells its Organiser once why it is back in Planning"; `e2e/change-decision.spec.ts` › "SCRUM-128 [AC1, AC2, AC4, AC5] TC-128-13, SCRUM-208 [AC2] TC-208-06: the Coordinator sees the current and requested values and what's affected, approves, and the Confirmed event returns to Planning with its booking flagged" (the Organiser's own list, step 1)

### TC-45-10

| Item | Content |
|---|---|
| Test Case ID | TC-45-10 |
| Test Scenario | [Positive, Negative] AC 7, AC 12, AC 13: a completed event tells its Organiser and Coordinator once |
| Pre-conditions | A Confirmed event whose end has passed, and one with no Coordinator. |
| Test Steps | 1. Load a page, which completes finished events (SCRUM-82). <br> 2. Load two pages at the same moment. <br> 3. Load a page again. |
| Test Data | — |
| Expected Result | Step 1: the Organiser and the Coordinator each get "Event completed": '"[event]" has ended and is now Completed.' The event with no Coordinator tells only its Organiser. Step 2: still one each. Step 3: nothing more. |

**Automated by:** `tests/unit/event-closing.test.ts` › "SCRUM-45 [AC7, AC12, AC13] TC-45-10: each completed event tells its Organiser and Coordinator once, naming the event" and `tests/unit/event-closing.test.ts` › "SCRUM-82 [AC8] TC-82-10, SCRUM-45 [AC13] TC-45-10: when nothing has finished, or it was already completed, nothing is written and nobody is told"; `tests/integration/close-event.test.ts` › "SCRUM-82 [AC7, AC8, AC9] TC-82-10: a finished Confirmed event completes once, even when two pages load at the same moment; at its end time it is still Confirmed, and a Cancelled one never completes" (one notice each, with two pages at once); `e2e/close-event.spec.ts` › "SCRUM-82 [AC7, AC10] TC-82-13: a request whose start has passed is marked Overdue for the Coordinator, and a finished Confirmed event reads as Completed" (each one's own list)

### TC-45-11

| Item | Content |
|---|---|
| Test Case ID | TC-45-11 |
| Test Scenario | [Positive] AC 6: cancelling an event tells its Organiser and its Coordinator, with the reason |
| Pre-conditions | A Planning event. Signed in as its Coordinator. |
| Test Steps | 1. Cancel the event with a reason (SCRUM-82). |
| Test Data | Reason "Venue flooded." |
| Expected Result | The Organiser and the Coordinator each get "Event cancelled" with the reason, and the registration-closed notice written ahead is withdrawn. |

**Automated by:** SCRUM-82's `tests/unit/cancel-event.test.ts` › "SCRUM-82 [AC6] TC-82-06: the Organiser, the Coordinator and each Attendee whose registration was cancelled are notified with the reason" and `tests/integration/close-event.test.ts` › "SCRUM-82 [AC3, AC6] TC-82-04: cancelling releases the booking, the hold, the reservation and its stock, the equipment request, the registration, the awaiting safety check and the change request together, and withdraws the notices written ahead"

### TC-45-12

| Item | Content |
|---|---|
| Test Case ID | TC-45-12 |
| Test Scenario | [Positive] AC 9: a change request's outcome tells the Organiser who raised it, with the reason if rejected |
| Pre-conditions | A Submitted change request. Signed in as the event's Coordinator. |
| Test Steps | 1. Approve it. <br> 2. Reject another with a reason (SCRUM-128). |
| Test Data | — |
| Expected Result | Step 1: "Change request approved", naming what changed. Step 2: "Change request rejected", with the reason. |

**Automated by:** SCRUM-128's `tests/unit/change-decision.test.ts` › "SCRUM-128 [AC2, AC10] TC-128-02: the requested values become the event's and the request becomes Approved, with who and when, in one transaction" and `tests/unit/change-decision.test.ts` › "SCRUM-128 [AC3, AC10] TC-128-03: rejecting with a reason leaves the event unchanged, marks the request Rejected and tells the Organiser why"

### TC-45-13

| Item | Content |
|---|---|
| Test Case ID | TC-45-13 |
| Test Scenario | [Positive, Concurrency] AC 10, AC 13: reassigning an event tells the new and previous Coordinators and the Organiser, once each |
| Pre-conditions | A Planning event assigned to `coordinator@test.local`. Signed in as `lead@test.local`. |
| Test Steps | 1. Reassign it to `coordinator2@test.local` (SCRUM-21). <br> 2. Two Leads reassign another event at the same moment. |
| Test Data | — |
| Expected Result | Step 1: the new Coordinator gets "An event was reassigned to you", the previous one "An event was reassigned", and the Organiser "Your event has a new coordinator", each in their own list. Step 2: one reassignment is saved, with three notices in all. |

**Automated by:** SCRUM-21's `tests/unit/reassign.test.ts` › "SCRUM-21 [AC6] TC-21-07: the new and previous Coordinators and the Organiser are each notified once"; `tests/integration/reassign.test.ts` › "SCRUM-21 [AC2, AC9] TC-21-02: [Concurrency] two Leads reassign the same event at the same moment: exactly one is saved, the event has one Coordinator, and one history entry exists" (three notices); `e2e/reassign.spec.ts` › "SCRUM-21 [AC1, AC5, AC6, AC8] TC-21-01, TC-21-06, TC-21-07, TC-21-08: the Lead reassigns an event at once; the previous Coordinator can only view it, and the Organiser sees the new Coordinator" (each one's own list)
