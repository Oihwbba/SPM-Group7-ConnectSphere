# SCRUM-69 — View only the events assigned to me: test cases

Story and acceptance criteria: [docs/backlog/SCRUM-69.md](../backlog/SCRUM-69.md).
Format and conventions: [README.md](README.md). A Coordinator's list is the
events assigned to them plus the unassigned events that aren't drafts, the
same rule `can()` applies to opening one
([lib/auth/can.ts](../../lib/auth/can.ts)).

Written on 2026-10-12 from the acceptance criteria, then mapped to the tests
that already existed (SCRUM-176). The tests predate the `SCRUM-n [ACx] TC-n-xx`
title format, so each case names them by their current titles.

**What changes next:** SCRUM-165 sends new requests to the Lead's unassigned
queue, so unassigned events will leave the Coordinators' lists (AC 4), and
SCRUM-21 replaces the handover in AC 3 with reassignment by the Lead. These
cases describe the system as built today.

**Shared pre-conditions for every case:** the database is migrated and seeded
and the app is running. Signed in as `coordinator@test.local`
(`Password123!`). The seed has events assigned to each Coordinator and an
unassigned Submitted one.

| ID | Type | Criterion | Automated |
|---|---|---|---|
| [TC-69-01](#tc-69-01) | Positive | AC 1, AC 4 | Unit, e2e |
| [TC-69-02](#tc-69-02) | Negative | AC 1 | Unit, e2e |
| [TC-69-03](#tc-69-03) | Positive | AC 2 | Unit, e2e |
| [TC-69-04](#tc-69-04) | Positive | AC 3 | Unit, e2e |
| [TC-69-05](#tc-69-05) | Positive | AC 4 | e2e |

---

### TC-69-01

| Item | Content |
|---|---|
| Test Case ID | TC-69-01 |
| Test Scenario | [Positive] AC 1, AC 4: my list is my events plus the Submitted ones nobody has yet |
| Pre-conditions | Signed in as the Coordinator. |
| Test Steps | 1. Open **Events**. <br> 2. Open one of the listed events. |
| Test Data | The seeded events |
| Expected Result | The list holds the events assigned to this Coordinator and the unassigned Submitted ones, and each opens. The same unassigned event is in the other Coordinator's list too. |

**Automated by:** `tests/unit/coordinator-assigned-events.test.ts` › "[Positive] AC1: my list is the events assigned to me, plus unassigned events that are not drafts", "[Positive] AC1: an event assigned to me is one I can open", "[Positive] AC4: a Submitted event with no Coordinator is in every Coordinator's list"; `e2e/coordinator-assigned-events.spec.ts` › "AC1, AC4: my default list shows my events and unassigned Submitted ones, not another Coordinator's", "AC4: an unassigned Submitted event appears in every Coordinator's list"

### TC-69-02

| Item | Content |
|---|---|
| Test Case ID | TC-69-02 |
| Test Scenario | [Negative] AC 1: another Coordinator's event, and an unassigned draft, are neither listed nor openable |
| Pre-conditions | Signed in as the Coordinator. |
| Test Steps | 1. Open **Events**. <br> 2. Open the other Coordinator's event, and an unassigned draft, directly. |
| Test Data | Their ids |
| Expected Result | Neither is listed, and both reads are refused. |

**Automated by:** `tests/unit/coordinator-assigned-events.test.ts` › "[Negative] AC1: an event assigned to another Coordinator is neither listed nor openable", "[Negative] AC1: an unassigned draft is not in any Coordinator's list"; `e2e/coordinator-assigned-events.spec.ts` › "AC1, AC4: my default list shows my events and unassigned Submitted ones, not another Coordinator's"

### TC-69-03

| Item | Content |
|---|---|
| Test Case ID | TC-69-03 |
| Test Scenario | [Positive] AC 2: the list shows name, date and status, and is searched, filtered and sorted like My Event Requests |
| Pre-conditions | Signed in as the Coordinator. |
| Test Steps | 1. Read a row. <br> 2. Search by part of a name in a different case. <br> 3. Filter by a status, and open the awaiting-review tab. <br> 4. Sort by start date. |
| Test Data | The seeded events |
| Expected Result | Each row shows the name, proposed date and status. Each step keeps only the matching events, and sorting orders them by proposed date. The awaiting-review tab holds the events this Coordinator can still decide. |

**Automated by:** `tests/unit/coordinator-assigned-events.test.ts` › "[Positive] AC2: searching by name keeps only matching events, ignoring case", "[Positive] AC2: filtering by status keeps only that status", "[Positive] AC2: the Awaiting review tab keeps the events a Coordinator can still decide", "[Positive] AC2: sorting by start date orders by proposed date"; `e2e/coordinator-assigned-events.spec.ts` › "AC2: the list shows each event's name, proposed date and status, and can be searched"

### TC-69-04

| Item | Content |
|---|---|
| Test Case ID | TC-69-04 |
| Test Scenario | [Positive] AC 3: an event handed to another Coordinator leaves my list and appears in theirs |
| Pre-conditions | An event assigned to this Coordinator. |
| Test Steps | 1. Assign the event to the other Coordinator (the handover). <br> 2. Open **Events** as each. |
| Test Data | The event |
| Expected Result | It is gone from this Coordinator's list and is in the other's. |

**Automated by:** `tests/unit/coordinator-assigned-events.test.ts` › "[Positive] AC3: after a handover the event leaves my list and is in the new Coordinator's"; `e2e/coordinator-assigned-events.spec.ts` › "AC3: an event handed to another Coordinator leaves my list and appears in theirs"

### TC-69-05

| Item | Content |
|---|---|
| Test Case ID | TC-69-05 |
| Test Scenario | [Positive] AC 4: the Coordinator who approves an unassigned event becomes its Coordinator, and it leaves the others' lists |
| Pre-conditions | An unassigned Submitted event, in both Coordinators' lists. |
| Test Steps | 1. As this Coordinator, approve it. <br> 2. Open **Events** as the other Coordinator. |
| Test Data | The unassigned event |
| Expected Result | This Coordinator is now its Coordinator, and it is no longer in the other's list. |

**Automated by:** `e2e/coordinator-assigned-events.spec.ts` › "AC4: a Coordinator who approves an unassigned Submitted event becomes its Coordinator, so it leaves the others' lists"; `tests/unit/event-status.test.ts` › "SCRUM-19, SCRUM-81 [AC1, AC2] TC-81-01: a coordinator approves an unassigned submitted request, becomes its coordinator, and it moves to Planning"
