# SCRUM-45 — Organiser and Coordinator workflow notifications: test cases

Story and acceptance criteria: [docs/backlog/SCRUM-45.md](../backlog/SCRUM-45.md).
Format and conventions: [README.md](README.md). The notices are read in the
notification list ([SCRUM-48](SCRUM-48.md)), which links each one to its
event.

**Shared pre-conditions for every case:** a local PostgreSQL migrated with
`npm run db:deploy` and seeded with `npm run db:seed`. Accounts use the
password `Password123!`. Each automated case makes its own event (assigned to
`coordinator@test.local` or the second seeded Coordinator) and removes it.

**Still to do, because the steps they report aren't built yet:** AC1's
assignment by the Lead (SCRUM-165; today assignment is automatic and keeps
its own notice), AC5 (SCRUM-128, SCRUM-26), AC6 and AC7 (SCRUM-82), AC9
(SCRUM-128) and AC10 (SCRUM-21). Each gets its case with its story. When
SCRUM-82 cancels an event, it must also withdraw the registration-closed
notice written ahead in TC-45-07.

| ID | Type | Criterion | Automated |
|---|---|---|---|
| [TC-45-01](#tc-45-01) | Positive, Negative | AC 1 | Unit, integration |
| [TC-45-02](#tc-45-02) | Positive, Negative | AC 2, AC 13 | Integration, e2e |
| [TC-45-03](#tc-45-03) | Positive | AC 3 | Unit, integration, e2e |
| [TC-45-04](#tc-45-04) | Positive, Negative | AC 4, AC 13 | Unit, integration |
| [TC-45-05](#tc-45-05) | Positive, Negative | AC 8, AC 14 | Unit, integration |
| [TC-45-06](#tc-45-06) | Positive, Boundary | AC 11, AC 13 | Integration |
| [TC-45-07](#tc-45-07) | Positive | AC 11 | Unit, integration |
| [TC-45-08](#tc-45-08) | Positive, Negative | AC 12, AC 13 | Unit |

AC 15 (no duplicates of SCRUM-85's or SCRUM-124's notices) holds by
construction: every notice here goes to the event's Organiser or Coordinator.

---

### TC-45-01

| Item | Content |
|---|---|
| Test Case ID | TC-45-01 |
| Test Scenario | [Positive, Negative] AC 1: a submitted request tells its Organiser it is waiting to be assigned |
| Pre-conditions | Signed in as `organiser@test.local`. |
| Test Steps | 1. Submit a new event request "Career Fair". <br> 2. Resubmit an amended rejected request whose Coordinator still holds the role. <br> 3. Submit a draft someone else submitted at the same moment. |
| Test Data | — |
| Expected Result | Step 1: the Organiser gets "Request submitted": "\"Career Fair\" was submitted and is waiting to be assigned to a Coordinator." While assignment is automatic, the assignment notices for the Organiser and the Coordinator follow as their own notices. Step 2: it goes straight back to its Coordinator, so no submission notice. Step 3: one submission, with one set of notices. |

**Automated by:** `tests/unit/event-auto-assignment.test.ts` › "SCRUM-45 [AC1, AC12] TC-45-01: the Organiser is told the request was submitted and is waiting to be assigned, then the assignment is a notice of its own" and "AC: no coordinator available — …"; `tests/unit/clarification-and-amend.test.ts` › "SCRUM-108 [AC9, AC11, AC14] TC-108-05: …", "SCRUM-108 [AC11, AC14] TC-108-14: …" and "SCRUM-108 [AC12] TC-108-08: …"; `tests/integration/concurrency.test.ts` › "SCRUM-14 AC: two simultaneous submissions of one draft succeed once and notify once"

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
| Expected Result | Step 1: "Your request was rejected": "\"…\" was rejected: The date clashes with exam week. What you can do next: Amend and resubmit." Step 2: "Your event was rejected": "\"…\" couldn't be arranged and was rejected: No venue can take it. What you can do next: Submit as a new request." |

**Automated by:** `e2e/workflow-notifications.spec.ts` › "SCRUM-45 [AC3] TC-45-03: rejecting a request in the app tells its Organiser the reason and what they can do next"; `tests/integration/workflow-notifications.test.ts` › both "SCRUM-45 [AC3] TC-45-03: …" tests; `tests/unit/reject-planning.test.ts` › "SCRUM-117 [AC6] TC-117-06: …"

### TC-45-04

| Item | Content |
|---|---|
| Test Case ID | TC-45-04 |
| Test Scenario | [Positive, Negative] AC 4, AC 13: a confirmed event tells its Organiser once |
| Pre-conditions | A ready Planning event (an approved booking covering it, no equipment), its Coordinator signed in. |
| Test Steps | 1. Confirm it. <br> 2. Confirm it again. <br> 3. On another event whose Registration needed is No, confirm it. |
| Test Data | — |
| Expected Result | Step 1: "Your event is confirmed": "\"…\" is confirmed, and registration is open." Step 2: no second notice. Step 3: "\"Gala\" is confirmed.", with no registration-closed notice. |

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

**Automated by:** `tests/integration/workflow-notifications.test.ts` › "SCRUM-45 [AC8, AC14] TC-45-05: a clarification question tells the Organiser what is needed, and writes no status notice"; `tests/unit/clarification.test.ts` › "[Positive] AC: organiser responds, clarification is marked answered, coordinator is notified"

### TC-45-06

| Item | Content |
|---|---|
| Test Case ID | TC-45-06 |
| Test Scenario | [Positive, Boundary] AC 11, AC 13: registration reaching capacity, and a withdrawal from a full event, tell the Organiser and the Coordinator |
| Pre-conditions | A Confirmed event with capacity 2 and registration open. |
| Test Steps | 1. `attendee@test.local` registers. <br> 2. `attendee2@test.local` registers. <br> 3. `attendee@test.local` withdraws, then withdraws again. <br> 4. `attendee2@test.local` withdraws. |
| Test Data | — |
| Expected Result | Step 1: no notice (one place left). Step 2: "Registration is full": "\"…\" has reached its capacity of 2.", once each to the Organiser and the Coordinator. Step 3: "A place opened at a full event", once each; withdrawing again writes nothing. Step 4: no notice, since the event wasn't full. |

**Automated by:** `tests/integration/workflow-notifications.test.ts` › "SCRUM-45 [AC11, AC13] TC-45-06: the registration that fills the last place, and a withdrawal from the full event, each tell the Organiser and Coordinator once"

### TC-45-07

| Item | Content |
|---|---|
| Test Case ID | TC-45-07 |
| Test Scenario | [Positive] AC 11: registration closing at its closing time tells the Organiser and the Coordinator then |
| Pre-conditions | A ready Planning event whose registration will open. |
| Test Steps | 1. Confirm it, with no registration window. <br> 2. Confirm another whose window closes on 30 May 2031, 6:00 pm, before it starts. |
| Test Data | — |
| Expected Result | A "Registration closed" notice for each of them, written at confirmation and shown from the closing time: the event's start in step 1, 30 May 2031, 6:00 pm SGT in step 2 ("Registration for \"Gala\" closed at 30 May 2031, 6:00 pm SGT."). It doesn't appear before then (SCRUM-48 AC8). |

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
