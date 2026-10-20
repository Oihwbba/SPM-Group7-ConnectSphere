# SCRUM-21 — Reassign an event to another Coordinator: test cases

Story and acceptance criteria: [docs/backlog/SCRUM-21.md](../backlog/SCRUM-21.md).
Format and conventions: [README.md](README.md). Assigning a Submitted request
from the queue is SCRUM-165; the read-only all-events page the Lead reassigns
from is SCRUM-141.

**Shared pre-conditions for every case:** the database is migrated and seeded
and the app is running. The event is in Planning, organised by Olivia
(`organiser@test.local`) and coordinated by Cody (`coordinator@test.local`).
The tester signs in as the Lead (`lead@test.local`) unless the case says
otherwise. Every account's password is `Password123!`.

| ID | Type | Criterion | Automated |
|---|---|---|---|
| [TC-21-01](#tc-21-01) | Positive | AC 1, AC 7 | Unit, e2e |
| [TC-21-02](#tc-21-02) | Concurrency | AC 2, AC 9 | Unit, integration |
| [TC-21-03](#tc-21-03) | Negative | AC 3 | Unit, e2e |
| [TC-21-04](#tc-21-04) | Boundary | AC 3 | Unit |
| [TC-21-05](#tc-21-05) | Negative | AC 4 | Unit, e2e |
| [TC-21-06](#tc-21-06) | Positive | AC 5 | Unit, e2e |
| [TC-21-07](#tc-21-07) | Positive | AC 6 | Unit, integration, e2e |
| [TC-21-08](#tc-21-08) | Positive | AC 8 | Unit, e2e |
| [TC-21-09](#tc-21-09) | Negative | AC 10 | Unit |
| [TC-21-10](#tc-21-10) | Negative | AC 3 | Unit |

### TC-21-01

| Item | Content |
|---|---|
| Test Case ID | TC-21-01 |
| Test Scenario | [Positive] AC 1, AC 7: the Lead reassigns an Under Review, Planning or Confirmed event to another Coordinator, effective at once |
| Pre-conditions | — |
| Test Steps | 1. Open the event from **All Events**. <br> 2. Under **Reassign to**, choose Cara Coordinator and click **Reassign**. |
| Test Data | — |
| Expected Result | "Reassigned to Cara Coordinator." The page shows Cara as the Coordinator, with no acceptance step. The event's history records REASSIGNED by the Lead, from Cody to Cara, with the time. The Lead becomes the event's supervising Lead. |

**Automated by:** `tests/unit/reassign.test.ts` › "SCRUM-21 [AC1] TC-21-01: the Lead may reassign a %s event that has a Coordinator" (3 tests) and "SCRUM-21 [AC1, AC7] TC-21-01: the new Coordinator is assigned at once, …"; `tests/unit/all-events.test.ts` › "SCRUM-21 [AC1, AC3] TC-21-01, TC-21-03: …"; `e2e/reassign.spec.ts` › "SCRUM-21 [AC1, AC5, AC6, AC8] TC-21-01, TC-21-06, TC-21-07, TC-21-08: …"

### TC-21-02

| Item | Content |
|---|---|
| Test Case ID | TC-21-02 |
| Test Scenario | [Concurrency] AC 2, AC 9: two Leads reassign the same event at the same moment; exactly one reassignment is saved |
| Pre-conditions | Real PostgreSQL; a second Lead. |
| Test Steps | 1. Both Leads reassign the event to Cara at once. |
| Test Data | — |
| Expected Result | One reassignment is saved: the event has one Coordinator, Cara, one REASSIGNED history entry (Cody to Cara) and one set of notices. The other Lead is told the event was just changed and where it is now, and nothing of theirs is written. |

**Automated by:** `tests/integration/reassign.test.ts` › "SCRUM-21 [AC2, AC9] TC-21-02: [Concurrency] two Leads reassign the same event at the same moment: …"; `tests/unit/reassign.test.ts` › "SCRUM-21 [AC2, AC9] TC-21-02: …" (2 tests)

### TC-21-03

| Item | Content |
|---|---|
| Test Case ID | TC-21-03 |
| Test Scenario | [Negative] AC 3: an event can't be reassigned to its own Organiser |
| Pre-conditions | — |
| Test Steps | 1. Open the Reassign list. <br> 2. Send a reassignment to the Organiser directly to the server. |
| Test Data | — |
| Expected Result | Step 1: the Organiser isn't listed. Step 2: "The event's own Organiser can't be its Coordinator." and nothing is written. |

**Automated by:** `tests/unit/reassign.test.ts` › "SCRUM-21 [AC3] TC-21-03: …"; `tests/unit/all-events.test.ts` › "SCRUM-21 [AC1, AC3] TC-21-01, TC-21-03: …"; `e2e/reassign.spec.ts` › "… TC-21-01 …"

### TC-21-04

| Item | Content |
|---|---|
| Test Case ID | TC-21-04 |
| Test Scenario | [Boundary] AC 3: choosing the current Coordinator changes nothing |
| Pre-conditions | — |
| Test Steps | 1. Leave Cody (marked "current") selected; **Reassign** is disabled. <br> 2. Send a reassignment to Cody directly. |
| Test Data | — |
| Expected Result | "Cody Coordinator already coordinates it." No update, history entry or notice. |

**Automated by:** `tests/unit/reassign.test.ts` › "SCRUM-21 [AC3] TC-21-04: choosing the current Coordinator changes nothing"

### TC-21-05

| Item | Content |
|---|---|
| Test Case ID | TC-21-05 |
| Test Scenario | [Negative] AC 4: Draft, Submitted, Rejected, Cancelled and Completed events can't be reassigned |
| Pre-conditions | One event in each of those statuses. |
| Test Steps | 1. Open each from All Events. <br> 2. Send a reassignment directly. |
| Test Data | — |
| Expected Result | Step 1: no Reassign form. Step 2: a Submitted request says "This request has no Coordinator yet: assign it from the Unassigned queue."; Rejected, Cancelled and Completed say "Only an Under Review, Planning or Confirmed event can be reassigned."; a draft or a missing id says "Event not found.". Nothing is written. |

**Automated by:** `tests/unit/reassign.test.ts` › "SCRUM-21 [AC4] TC-21-05: …" (12 tests); `tests/unit/all-events.test.ts` › "SCRUM-21 [AC4, AC10] TC-21-05, TC-21-09: …" (3 tests); `e2e/reassign.spec.ts` › "SCRUM-21 [AC4] TC-21-05: Reassign isn't offered for a Submitted request"

### TC-21-06

| Item | Content |
|---|---|
| Test Case ID | TC-21-06 |
| Test Scenario | [Positive] AC 5: the previous Coordinator can no longer edit the event, but can still open it read-only |
| Pre-conditions | TC-21-01 done. |
| Test Steps | 1. Sign in as Cody and open **Events**. <br> 2. Open the event from **All Events**. |
| Test Data | `coordinator@test.local` |
| Expected Result | Step 1: the event isn't in Cody's Events. Step 2: "Read-only: only the event's assigned Coordinator can change it.", with no Reassign form. |

**Automated by:** `tests/unit/reassign.test.ts` › "SCRUM-21 [AC5] TC-21-06: …"; `e2e/reassign.spec.ts` › "… TC-21-06 …"

### TC-21-07

| Item | Content |
|---|---|
| Test Case ID | TC-21-07 |
| Test Scenario | [Positive] AC 6: the new and previous Coordinators and the Organiser are notified |
| Pre-conditions | TC-21-01 done. |
| Test Steps | 1. Open Notifications as Cara, Cody and Olivia. |
| Test Data | — |
| Expected Result | One "reassigned" notice each: Cara's says the event is now hers; Cody's says it went to Cara and he can still view it from All Events; Olivia's names Cara. |

**Automated by:** `tests/unit/reassign.test.ts` › "SCRUM-21 [AC6] TC-21-07: …"; `tests/integration/reassign.test.ts` › "… TC-21-02 …" (three notices for the one saved reassignment); `e2e/reassign.spec.ts` › "… TC-21-07 …" (each sees theirs in Notifications)

### TC-21-08

| Item | Content |
|---|---|
| Test Case ID | TC-21-08 |
| Test Scenario | [Positive] AC 8: the Organiser always sees the current Coordinator's name on the event |
| Pre-conditions | TC-21-01 done. |
| Test Steps | 1. Sign in as Olivia and open the event's **View Details**. |
| Test Data | `organiser@test.local` |
| Expected Result | Basic Information reads "Coordinator: Cara Coordinator"; before any Coordinator, "Not assigned yet". Anyone not related to the event gets "Event not found." |

**Automated by:** `tests/unit/readiness-actions.test.ts` › "SCRUM-21 [AC8] TC-21-08: …" (6 tests); `e2e/reassign.spec.ts` › "… TC-21-08 …"

### TC-21-09

| Item | Content |
|---|---|
| Test Case ID | TC-21-09 |
| Test Scenario | [Negative] AC 10: only Leads can reassign |
| Pre-conditions | — |
| Test Steps | 1. As each other role, send a reassignment directly. |
| Test Data | — |
| Expected Result | Refused before anything is read, even for an event the caller organises or coordinates. The Reassign form is shown to Leads only. |

**Automated by:** `tests/unit/reassign.test.ts` › "SCRUM-21 [AC10] TC-21-09: …" (9 tests); `tests/unit/all-events.test.ts` › "SCRUM-21 [AC4, AC10] TC-21-05, TC-21-09: Reassign isn't offered to %s, and no Coordinators are read"

### TC-21-10

| Item | Content |
|---|---|
| Test Case ID | TC-21-10 |
| Test Scenario | [Negative] AC 3: only someone who holds the Coordinator role can be chosen |
| Pre-conditions | — |
| Test Steps | 1. Send a reassignment to an Attendee's id directly. |
| Test Data | `usr_attendee` |
| Expected Result | "Choose someone who is a Coordinator." Nothing is written. |

**Automated by:** `tests/unit/reassign.test.ts` › "SCRUM-21 [AC3] TC-21-10: someone who isn't a Coordinator is refused"
