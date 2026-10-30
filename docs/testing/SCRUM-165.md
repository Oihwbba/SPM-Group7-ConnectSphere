# SCRUM-165 — Lead assigns new requests from an unassigned queue: test cases

Story and acceptance criteria: [docs/backlog/SCRUM-165.md](../backlog/SCRUM-165.md).
Format and conventions: [README.md](README.md). The `supervisingLeadId`
column came with SCRUM-172 AC12; the Lead role and its account with SCRUM-164.

**Shared pre-conditions for every case:** the database is migrated and seeded
and the app is running. The Lead is `lead@test.local`; the Coordinators are
`coordinator@test.local` (Cody) and `coordinator2@test.local` (Cara); the
Organiser is `organiser@test.local`. "Submitted — Alumni Homecoming" waits in
the queue unassigned. Every account's password is `Password123!`.

**Covered with other stories:**

- **AC1, "every Lead is notified":** the notice is SCRUM-124 AC10's, written
  at the submit step; TC-165-01 cites its tests.
- **AC7, the event's own Organiser:** one account can be both since
  SCRUM-121 (`multirole@test.local`); TC-165-09 cites its integration tests.
- **AC8, the read-only all-events list:** SCRUM-141 (TC-141-01, TC-141-05).

| ID | Type | Criterion | Automated |
|---|---|---|---|
| [TC-165-01](#tc-165-01) | Positive | AC 1 | Unit, e2e |
| [TC-165-02](#tc-165-02) | Positive | AC 2 | Unit, e2e |
| [TC-165-03](#tc-165-03) | Boundary | AC 2 | Unit |
| [TC-165-04](#tc-165-04) | Positive | AC 3 | Unit, e2e |
| [TC-165-05](#tc-165-05) | Positive, Boundary | AC 4 | Unit, e2e |
| [TC-165-06](#tc-165-06) | Negative | AC 4 | Unit |
| [TC-165-07](#tc-165-07) | Positive | AC 5 | Unit, e2e |
| [TC-165-08](#tc-165-08) | Concurrency | AC 6 | Unit, integration |
| [TC-165-09](#tc-165-09) | Negative | AC 7 | Unit |
| [TC-165-10](#tc-165-10) | Negative | AC 7 | Unit |
| [TC-165-11](#tc-165-11) | Negative | AC 8 | Unit, e2e |
| [TC-165-12](#tc-165-12) | Positive, Negative | AC 9 | Unit |
| [TC-165-13](#tc-165-13) | Negative | AC 10 | Unit, e2e |
| [TC-165-14](#tc-165-14) | Positive | AC 11 | Unit, e2e |

### TC-165-01

| Item | Content |
|---|---|
| Test Case ID | TC-165-01 |
| Test Scenario | [Positive] AC 1: a submitted request isn't assigned; it waits in the queue |
| Pre-conditions | Signed in as the Organiser. |
| Test Steps | 1. Create and submit a complete event request. <br> 2. Sign in as the Lead. |
| Test Data | Any complete request, e.g. 50 expected, 1 Nov 2031 09:00–17:00. |
| Expected Result | The request is Submitted with no Coordinator, nothing is recorded as assigned, and it is listed in the Lead's Unassigned queue. |

**Automated by:** the Lead notice by `tests/unit/submission-queue.test.ts` › "SCRUM-124 [AC10, AC12, AC14] TC-124-10: …" and `tests/integration/staff-notifications.test.ts` › "SCRUM-124 [AC10, AC12, AC14] TC-124-10: …"; `tests/unit/submission-queue.test.ts` › "SCRUM-165 [AC1] TC-165-01: …" (2 tests); `tests/unit/auth.test.ts` › "SCRUM-165 [AC1] TC-165-01: …"; `e2e/lead-queue.spec.ts` › "SCRUM-14 [AC1] TC-14-01, SCRUM-20 [AC1, AC2, AC3, AC7, AC8] TC-20-01, SCRUM-135 [AC2, AC6] TC-135-02, SCRUM-164 [AC2] TC-164-05, SCRUM-165 [AC1, AC2, AC3, AC4, AC5, AC8, AC11] TC-165-01, TC-165-02, TC-165-04, TC-165-05, TC-165-07, TC-165-11, TC-165-14: a submitted request waits in the queue, the Lead assigns it, and only then does the Coordinator get it"

### TC-165-02

| Item | Content |
|---|---|
| Test Case ID | TC-165-02 |
| Test Scenario | [Positive] AC 2: the queue lists unassigned requests oldest first with their details, marking overdue ones |
| Pre-conditions | Signed in as the Lead; two or more requests wait, one whose start has passed. |
| Test Steps | 1. Open the Unassigned Queue. |
| Test Data | — |
| Expected Result | Each entry shows its name, event date, "Needs a Coordinator" and its submission (date and how long ago), oldest submission first, the four columns every queue shares (SCRUM-211); the past one is marked **Overdue**. Its times, attendance and Organiser show when it is opened (TC-165-04). |

**Automated by:** `tests/unit/lead-queue.test.ts` › "SCRUM-165 [AC2] TC-165-02: …" (2 tests); `e2e/lead-queue.spec.ts` › "… TC-165-02 …"

### TC-165-03

| Item | Content |
|---|---|
| Test Case ID | TC-165-03 |
| Test Scenario | [Boundary] AC 2: overdue once the start has passed, by SCRUM-82 AC10's rule, so the queue and the Coordinator's list agree |
| Pre-conditions | — |
| Test Steps | 1. Check a request starting exactly now, one a moment after its start, one starting later, and one with no start. |
| Test Data | — |
| Expected Result | Starting exactly now: not Overdue yet. A moment after its start: Overdue. Later, or no start: not Overdue. |

**Automated by:** `tests/unit/lead-queue.test.ts` › "SCRUM-165 [AC2] TC-165-03: …" (2 tests)

### TC-165-04

| Item | Content |
|---|---|
| Test Case ID | TC-165-04 |
| Test Scenario | [Positive] AC 3: opening a queued request shows its basic information, read-only |
| Pre-conditions | Signed in as the Lead. |
| Test Steps | 1. Open a request from the queue. |
| Test Data | — |
| Expected Result | Its purpose, description, date and time, attendance, venue, accessibility, layout and equipment requirements, Organiser and submission time are shown, with nothing editable. |

**Automated by:** `tests/unit/lead-queue.test.ts` › "SCRUM-165 [AC3, AC4] TC-165-04, TC-165-05: …"; `e2e/lead-queue.spec.ts` › "… TC-165-04 …"

### TC-165-05

| Item | Content |
|---|---|
| Test Case ID | TC-165-05 |
| Test Scenario | [Positive, Boundary] AC 4: each Coordinator's active events are shown and the least-loaded is suggested |
| Pre-conditions | Signed in as the Lead, on a queued request. |
| Test Steps | 1. Open the **Coordinator** choice. |
| Test Data | Cody with 2 active events (Under Review, Approved, Planning or Confirmed), Cara with 1. |
| Expected Result | Each option reads "Name — N active events"; Cara is pre-selected and marked "(suggested)". On a tie the earliest-created Coordinator is suggested; with no Coordinators, "There are no Coordinators to assign yet." |

**Automated by:** `tests/unit/coordinator-assignment.test.ts` › "SCRUM-165 [AC4] TC-165-05: …" (5 tests); `tests/unit/lead-queue.test.ts` › "… TC-165-05 …"; `e2e/lead-queue.spec.ts` › "… TC-165-05 …"

### TC-165-06

| Item | Content |
|---|---|
| Test Case ID | TC-165-06 |
| Test Scenario | [Negative] AC 4: only someone who is a Coordinator now can be assigned |
| Pre-conditions | Signed in as the Lead. |
| Test Steps | 1. Send an assignment directly naming someone who isn't a Coordinator, or naming nobody. |
| Test Data | — |
| Expected Result | Refused ("Choose someone who is a Coordinator." / "Choose a Coordinator for this request."), and nothing is written. |

**Automated by:** `tests/unit/lead-queue.test.ts` › "SCRUM-165 [AC4] TC-165-06: …" (3 tests)

### TC-165-07

| Item | Content |
|---|---|
| Test Case ID | TC-165-07 |
| Test Scenario | [Positive] AC 5: assigning sets the Coordinator and moves the request to Under Review in one operation, and both are notified |
| Pre-conditions | Signed in as the Lead, on a queued request. |
| Test Steps | 1. Choose Cody. <br> 2. Click **Assign**. <br> 3. Sign in as Cody. |
| Test Data | — |
| Expected Result | "Assigned to Cody Coordinator." The next waiting request opens (SCRUM-211 AC4). The request leaves the queue, is Under Review with Cody, the assignment is recorded with the Lead's name, the Organiser and Cody each get "A coordinator was assigned" / "You were assigned an event", and Cody sees it in his list. |

**Automated by:** `tests/unit/lead-queue.test.ts` › "SCRUM-165 [AC5] TC-165-07: …" (3 tests); `e2e/lead-queue.spec.ts` › "… TC-165-07 …"

### TC-165-08

| Item | Content |
|---|---|
| Test Case ID | TC-165-08 |
| Test Scenario | [Concurrency] AC 6: two Leads assign the same request at the same moment |
| Pre-conditions | Two Leads; one queued request. |
| Test Steps | 1. Both assign it at the same moment, to different Coordinators. |
| Test Data | — |
| Expected Result | Exactly one assignment is saved and recorded; the other Lead is told "This request is already assigned to *name*." |

**Automated by:** `tests/integration/concurrency.test.ts` › "SCRUM-165 [AC6] TC-165-08: [Concurrency] …"; `tests/unit/lead-queue.test.ts` › "SCRUM-165 [AC6, AC7] TC-165-08, TC-165-10: …"

### TC-165-09

| Item | Content |
|---|---|
| Test Case ID | TC-165-09 |
| Test Scenario | [Negative] AC 7: the event's own Organiser can't be its Coordinator |
| Pre-conditions | An account that is both the request's Organiser and a Coordinator (SCRUM-121, e.g. `multirole@test.local`). |
| Test Steps | 1. Open the request. <br> 2. Send an assignment naming them directly. |
| Test Data | — |
| Expected Result | 1. They aren't offered. 2. "The event's own Organiser can't be its Coordinator." Nothing is written. |

**Automated by:** `tests/unit/lead-queue.test.ts` › "SCRUM-165 [AC7] TC-165-09: …" (2 tests); with a real multi-role account, `tests/integration/multiple-roles.test.ts` › "SCRUM-121 [AC4] TC-121-04: the Lead isn't offered an account that is the event's Organiser, and can't assign it, even though it also coordinates"

### TC-165-10

| Item | Content |
|---|---|
| Test Case ID | TC-165-10 |
| Test Scenario | [Negative] AC 7: a request that already has a Coordinator can't be assigned again |
| Pre-conditions | The request is assigned to Cara. |
| Test Steps | 1. Open its queue page directly. <br> 2. Send an assignment directly. |
| Test Data | — |
| Expected Result | 1. Not found: it isn't in the queue. 2. "This request is already assigned to Cara Coordinator." Changing it is reassignment (SCRUM-21). |

**Automated by:** `tests/unit/lead-queue.test.ts` › "SCRUM-165 [AC7] TC-165-10: …" (2 tests) and "… TC-165-08, TC-165-10: …"; `tests/unit/auth.test.ts` › "SCRUM-165 [AC7] TC-165-10: …"

### TC-165-11

| Item | Content |
|---|---|
| Test Case ID | TC-165-11 |
| Test Scenario | [Negative] AC 8: Coordinators can't see, open or decide an unassigned request |
| Pre-conditions | Signed in as Cody; "Submitted — Alumni Homecoming" is unassigned. |
| Test Steps | 1. Open Events. <br> 2. Approve, reject or raise a change request on it directly. |
| Test Data | — |
| Expected Result | 1. It isn't listed; only Cody's own events are. 2. "Event not found." and nothing changes. |

**Automated by:** `tests/unit/auth.test.ts`, `tests/unit/event-status.test.ts`, `tests/unit/clarification-and-amend.test.ts`, `tests/unit/change-requests.test.ts`, `tests/unit/coordinator-assigned-events.test.ts`, `tests/unit/coordinator-events-access.test.ts` and `tests/unit/events.test.ts` › "… SCRUM-165 [AC8] TC-165-11 …"; `e2e/coordinator-assigned-events.spec.ts` › "SCRUM-69 [AC1, AC4] TC-69-01, TC-69-05, SCRUM-135 [AC3, AC4, AC11] TC-135-03, SCRUM-165 [AC4, AC8] TC-165-11: an unassigned Submitted event is in no Coordinator's list" (2 tests); `e2e/lead-queue.spec.ts` › "… TC-165-11 …"

### TC-165-12

| Item | Content |
|---|---|
| Test Case ID | TC-165-12 |
| Test Scenario | [Positive, Negative] AC 9: a resubmitted request keeps its Coordinator, or returns to the queue if they lost the role |
| Pre-conditions | A Rejected request with "Amend and resubmit" (SCRUM-126), previously assigned to Cody. |
| Test Steps | 1. As the Organiser, amend and resubmit it. <br> 2. Repeat after Cody no longer holds the Coordinator role. |
| Test Data | — |
| Expected Result | 1. Under Review with Cody, who is notified. 2. Submitted with no Coordinator, back in the queue, and the history records that Cody held it. |

**Automated by:** `tests/unit/clarification-and-amend.test.ts` › "… TC-108-05, SCRUM-165 [AC9] TC-165-12: …", "SCRUM-165 [AC9] TC-165-12 …" (2 tests), "… TC-108-14, SCRUM-165 [AC9] TC-165-12: …"; `tests/unit/events.test.ts` › "SCRUM-21, SCRUM-165 [AC9] TC-165-12: …"

### TC-165-13

| Item | Content |
|---|---|
| Test Case ID | TC-165-13 |
| Test Scenario | [Negative] AC 10: only Leads can see the queue and assign |
| Pre-conditions | — |
| Test Steps | 1. As each other role, open `/queue` and a queued request's page directly. <br> 2. Send an assignment directly. <br> 3. Sign in as the Lead. |
| Test Data | — |
| Expected Result | 1. "Access denied" / not found. 2. Refused before anything is read. 3. The Lead lands on the Unassigned Queue and still can't decide, plan or edit an event. |

**Automated by:** `tests/unit/lead-queue.test.ts` › "SCRUM-165 [AC10] TC-165-13: …"; `tests/unit/auth.test.ts`, `tests/unit/nav.test.ts` › "… TC-165-13 …"; `e2e/lead-queue.spec.ts` › "SCRUM-165 [AC10] TC-165-13: a Coordinator typing /queue directly is refused"

### TC-165-14

| Item | Content |
|---|---|
| Test Case ID | TC-165-14 |
| Test Scenario | [Positive] AC 11: the Lead who assigns is recorded as the supervising Lead |
| Pre-conditions | Signed in as the Lead. |
| Test Steps | 1. Assign a queued request. |
| Test Data | — |
| Expected Result | The event's supervising Lead is `lead@test.local`. |

**Automated by:** `tests/unit/lead-queue.test.ts` › "SCRUM-165 [AC5, AC11] TC-165-07, TC-165-14: …"; `e2e/lead-queue.spec.ts` › "… TC-165-14 …"
