# SCRUM-18 — Request clarification on an event under review: test cases

Story and acceptance criteria: [docs/backlog/SCRUM-18.md](../backlog/SCRUM-18.md).
Format and conventions: [README.md](README.md). The actions are
`requestClarification`, `respondToClarification` and
`getClarificationForEvent` in
[app/(app)/events/clarification-actions.ts](<../../app/(app)/events/clarification-actions.ts>).
A clarification is a `ClarificationRequest` row, not an event status
(ADR 0014).

Written on 2026-10-12 from the acceptance criteria, then mapped to the tests
that already existed (SCRUM-176). The tests predate the `SCRUM-n [ACx] TC-n-xx`
title format, so each case names them by their current titles. TC-18-11 was
added on 2026-10-13, so that every e2e test is named by a case.

Two references in the story have moved. The field-limited answer in AC 3 is
SCRUM-108, which SCRUM-109 was merged into. The notifications in AC 6 are
SCRUM-45 AC 8; SCRUM-56 was dropped.

**Shared pre-conditions for every case:** the database is migrated and seeded
and the app is running. A request by `organiser@test.local` is Under Review
with `coordinator@test.local` (both `Password123!`).

| ID | Type | Criterion | Automated |
|---|---|---|---|
| [TC-18-01](#tc-18-01) | Positive | AC 1, AC 6 | Unit, e2e |
| [TC-18-02](#tc-18-02) | Positive | AC 2 | Unit, e2e |
| [TC-18-03](#tc-18-03) | Negative | AC 2 | Unit |
| [TC-18-04](#tc-18-04) | Negative | AC 3 | Unit |
| [TC-18-05](#tc-18-05) | Positive | AC 4, AC 6 | Unit, e2e |
| [TC-18-06](#tc-18-06) | Negative | AC 4 | Unit |
| [TC-18-07](#tc-18-07) | Boundary | AC 5 | Unit |
| [TC-18-08](#tc-18-08) | Concurrency | AC 4, AC 5 | Unit, integration |
| [TC-18-09](#tc-18-09) | Negative | AC 1 | Unit |
| [TC-18-10](#tc-18-10) | Negative | Only the right people | Unit |
| [TC-18-11](#tc-18-11) | Positive | AC 1 at phone width | e2e |

---

### TC-18-01

| Item | Content |
|---|---|
| Test Case ID | TC-18-01 |
| Test Scenario | [Positive] AC 1, AC 6: asking for clarification leaves the request Under Review, and tells the Organiser |
| Pre-conditions | Signed in as the assigned Coordinator. |
| Test Steps | 1. Open the request and ask for clarification. <br> 2. Check its status. <br> 3. Sign in as the Organiser and open **Notifications**. |
| Test Data | "What is the expected start time?" |
| Expected Result | The request is still Under Review, shown as awaiting clarification. The Organiser has a notification of the question. |

**Automated by:** `tests/unit/clarification.test.ts` › "[Positive] AC: coordinator requests clarification, event status is untouched, organiser is notified"; `e2e/clarification.spec.ts` › "coordinator asks, organiser replies, coordinator sees the answer (AC: sub-state, notify, respond, re-review)"

### TC-18-02

| Item | Content |
|---|---|
| Test Case ID | TC-18-02 |
| Test Scenario | [Positive] AC 2: the question names the fields the answer may change, or none for a text answer |
| Pre-conditions | Signed in as the assigned Coordinator. |
| Test Steps | 1. Ask a question and tick **Expected attendance**. <br> 2. On another request, ask a question with no field ticked. <br> 3. As the Organiser, open each. |
| Test Data | "Please confirm the headcount."; "Is the date final?" |
| Expected Result | The first shows the question and allows only the attendance to change. The second is a text answer only. Each ticked field is stored once. |

**Automated by:** `tests/unit/clarification-and-amend.test.ts` › "SCRUM-108 [AC1] TC-108-01: the Coordinator's ticked fields are stored with the question, each once", "SCRUM-108 [AC1] TC-108-01: ticking none makes it a text answer only"; `e2e/clarification-and-amend.spec.ts` › "SCRUM-108 [AC1, AC2, AC3, AC14] TC-108-10: the Coordinator lets the Organiser change the attendance, and the answer changes only that"

### TC-18-03

| Item | Content |
|---|---|
| Test Case ID | TC-18-03 |
| Test Scenario | [Negative] AC 2: a question needs words, and only request-form fields can be named |
| Pre-conditions | Signed in as the assigned Coordinator. |
| Test Steps | 1. Ask with an empty message. <br> 2. Ask naming a field that isn't on the request form. |
| Test Data | ""; a field "budget" |
| Expected Result | Step 1 is refused with "Say what you need clarified."; step 2 is refused. Neither creates a clarification. |

**Automated by:** `tests/unit/clarification.test.ts` › "[Negative] AC: a blank message is rejected and nothing is written"; `tests/unit/clarification-and-amend.test.ts` › "SCRUM-108 [AC1] TC-108-01: a field that isn't on the request form is refused and nothing is created"

### TC-18-04

| Item | Content |
|---|---|
| Test Case ID | TC-18-04 |
| Test Scenario | [Negative] AC 3: the answer can change only the fields the question named |
| Pre-conditions | An open clarification naming only the attendance. Signed in as the Organiser. |
| Test Steps | 1. Answer it, changing the attendance and the venue requirements. |
| Test Data | Attendance 150; new venue requirements |
| Expected Result | Refused with "Only the fields your coordinator named can be changed here. Use a change request for anything else." Nothing is written. |

**Automated by:** `tests/unit/clarification-and-amend.test.ts` › "SCRUM-108 [AC5] TC-108-04: changing a field the clarification didn't name is refused, and nothing is written"

### TC-18-05

| Item | Content |
|---|---|
| Test Case ID | TC-18-05 |
| Test Scenario | [Positive] AC 4, AC 6: the Organiser's answer marks the clarification answered, and tells the Coordinator |
| Pre-conditions | An open clarification. Signed in as the Organiser. |
| Test Steps | 1. Open the request, type an answer and send it. <br> 2. Sign in as the Coordinator and open the request. |
| Test Data | "It starts at 9am." |
| Expected Result | The clarification is Answered. The Coordinator is notified, sees the answer and can review the request again. |

**Automated by:** `tests/unit/clarification.test.ts` › "[Positive] AC: organiser responds, clarification is marked answered, coordinator is notified", "[Positive] AC: a question asked on an unclaimed event still notifies the coordinator who asked"; `e2e/clarification.spec.ts` › "coordinator asks, organiser replies, coordinator sees the answer (AC: sub-state, notify, respond, re-review)"

### TC-18-06

| Item | Content |
|---|---|
| Test Case ID | TC-18-06 |
| Test Scenario | [Negative] AC 4: an empty answer, or a second answer, is refused |
| Pre-conditions | Signed in as the Organiser. |
| Test Steps | 1. Send an empty answer to an open clarification. <br> 2. Answer a clarification that was already answered. |
| Test Data | ""; any text |
| Expected Result | Step 1 is refused with "Enter a response before sending."; step 2 with "This clarification request has already been answered." Nothing changes. |

**Automated by:** `tests/unit/clarification.test.ts` › "[Negative] AC: an empty response is rejected", "[Negative] Boundary: an already-answered clarification cannot be answered again"

### TC-18-07

| Item | Content |
|---|---|
| Test Case ID | TC-18-07 |
| Test Scenario | [Boundary] AC 5: a second question while one is open creates nothing |
| Pre-conditions | An open clarification. Signed in as the assigned Coordinator. |
| Test Steps | 1. Ask another question on the same request. |
| Test Data | "Also, how many speakers?" |
| Expected Result | Refused with "There is already an open clarification request on this event." There is still one open clarification. |

**Automated by:** `tests/unit/clarification.test.ts` › "[Boundary] AC: no second open clarification is created for the same event"

### TC-18-08

| Item | Content |
|---|---|
| Test Case ID | TC-18-08 |
| Test Scenario | [Concurrency] AC 4, AC 5: questions, answers and decisions made at the same moment never double up |
| Pre-conditions | Two tabs for the people involved. |
| Test Steps | 1. Ask two questions on one request at the same moment. <br> 2. Send two answers to one clarification at the same moment. <br> 3. Ask a question at the same moment the request is decided. |
| Test Data | Any text |
| Expected Result | Step 1 leaves one open clarification and refuses the other. Step 2 leaves one answer, refuses the other, and notifies the Coordinator once. Step 3 never leaves an open clarification on the decided request. |

**Automated by:** `tests/integration/concurrency.test.ts` › "SCRUM-18: two simultaneous requests on one event create exactly one OPEN clarification and refuse the other", "SCRUM-18: two simultaneous replies leave one ANSWERED row, refuse the other, and notify the coordinator once", "SCRUM-18: a question asked at the same instant as a decision never leaves an OPEN clarification on the decided event"; `tests/unit/clarification.test.ts` › "[Boundary] AC: the open-clarification check runs under a lock on the Event row, so a simultaneous second request sees the first", "[Boundary] AC: when two replies race, the loser is refused and the coordinator is notified only once"

### TC-18-09

| Item | Content |
|---|---|
| Test Case ID | TC-18-09 |
| Test Scenario | [Negative] AC 1: only a submitted or under-review request can be questioned, and a decision closes the question |
| Pre-conditions | Signed in as a Coordinator. |
| Test Steps | 1. Ask a question on a Draft. <br> 2. Decide a request that has an open clarification, then check the clarification. |
| Test Data | A Draft; a request with an open clarification |
| Expected Result | Step 1 is refused with "Clarification can only be requested on a submitted or under-review request." In step 2 the decision closes the clarification, so a resubmitted request can be questioned again. |

**Automated by:** `tests/unit/clarification.test.ts` › "[Negative] a request cannot be clarified while it is still DRAFT"; `tests/unit/event-status.test.ts` › "SCRUM-18: deciding an event closes its still-OPEN clarification so a resubmitted request can be questioned again", "SCRUM-18: a lost decision race closes nothing"

### TC-18-10

| Item | Content |
|---|---|
| Test Case ID | TC-18-10 |
| Test Scenario | [Negative] Only the event's Coordinator asks, and only its Organiser answers |
| Pre-conditions | A request with an open clarification. |
| Test Steps | 1. As the Organiser, ask a question on their own request. <br> 2. As the Coordinator, send an answer. <br> 3. As the other Coordinator, ask on this request; as `organiser2@test.local`, answer or read its clarification. <br> 4. Signed out, send an answer. |
| Test Data | The request's and clarification's ids |
| Expected Result | Each is refused. Steps 3 get "not found", revealing nothing; step 4 is refused as not signed in. Nothing is written. |

**Automated by:** `tests/unit/clarification.test.ts` › "[Negative] Security gate: an Organiser cannot request clarification on their own event", "[Negative] a Coordinator cannot respond on the organiser's behalf", "[Negative] SCRUM-68: another coordinator's event is indistinguishable from a missing one", "[Negative] another organiser's clarification is indistinguishable from a missing one", "[Negative] an unrelated user gets not-found, never the clarification content", "[Negative] a signed-out caller is refused"

### TC-18-11

| Item | Content |
|---|---|
| Test Case ID | TC-18-11 |
| Test Scenario | [Positive] AC 1 at phone width: the review actions and the clarification dialog stay usable on a phone |
| Pre-conditions | Signed in as the assigned Coordinator, at a 375 × 812 screen. A request is Under Review. |
| Test Steps | 1. Open **Events** and find the request's card. <br> 2. Look at **View Details**, **Approve**, **Ask** and **Reject**. <br> 3. Tap **Ask**. |
| Test Data | Screen 375 × 812 |
| Expected Result | The four buttons are the same width, two to a row (**Reject** beside **Ask**, not alone on a line), and the page doesn't scroll sideways. In the clarification dialog, **Send request** and **Cancel** are stacked with at least 6 px between them. |

**Automated by:** `e2e/events.spec.ts` › "SCRUM-18/19: the four review buttons form an even two-column grid and stacked dialog buttons are separated"
