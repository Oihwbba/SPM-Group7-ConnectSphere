# SCRUM-69 — View only the events assigned to me: test cases

Story and acceptance criteria: [docs/backlog/SCRUM-69.md](../backlog/SCRUM-69.md).
Format and conventions: [README.md](README.md). A Coordinator's list is
exactly the events assigned to them, the same rule `can()` applies to opening
one ([lib/auth/can.ts](../../lib/auth/can.ts)).

Written on 2026-10-12 from the acceptance criteria, then mapped to the tests
that already existed (SCRUM-176). The tests predate the `SCRUM-n [ACx] TC-n-xx`
title format, so each case names them by their current titles.

**Since written:** SCRUM-165 sends new requests to the Lead's unassigned
queue, so unassigned events left the Coordinators' lists (it supersedes AC 1's
unassigned half and AC 4: TC-69-01 is superseded in part and TC-69-05 in
full), and SCRUM-21 replaced the handover in AC 3 with reassignment by the
Lead. TC-69-04 checks the lists after a change of Coordinator, however made.

**Shared pre-conditions for every case:** the database is migrated and seeded
and the app is running. Signed in as `coordinator@test.local`
(`Password123!`). The seed has events assigned to each Coordinator and an
unassigned Submitted one.

| ID | Type | Criterion | Automated |
|---|---|---|---|
| [TC-69-01](#tc-69-01) | Positive | AC 1 | Unit, e2e |
| [TC-69-02](#tc-69-02) | Negative | AC 1 | Unit, e2e |
| [TC-69-03](#tc-69-03) | Positive | AC 2 | Unit, e2e |
| [TC-69-04](#tc-69-04) | Positive | AC 3 | Unit, e2e |
| [TC-69-05](#tc-69-05) | Superseded | AC 4 | — (SCRUM-165: TC-165-11) |

---

### TC-69-01

| Item | Content |
|---|---|
| Test Case ID | TC-69-01 |
| Test Scenario | [Positive] AC 1: my list is exactly my events |
| Pre-conditions | Signed in as the Coordinator. |
| Test Steps | 1. Open **Events**. <br> 2. Open one of the listed events. |
| Test Data | The seeded events |
| Expected Result | The list holds the events assigned to this Coordinator, and each opens. The unassigned Submitted event is in neither Coordinator's list. |

**Superseded in part** on 20 Oct 2026 by SCRUM-165 AC 8 ([TC-165-11](SCRUM-165.md#tc-165-11)): the list also held the unassigned Submitted events, in every Coordinator's list; they now wait in the Lead's queue.

**Automated by:** `tests/unit/coordinator-assigned-events.test.ts` › "SCRUM-69 [AC1] TC-69-01, SCRUM-165 [AC8] TC-165-11: [Positive] my list is exactly the events assigned to me", "SCRUM-69 [AC1] TC-69-01: [Positive] an event assigned to me is one I can open" and "SCRUM-69 [AC1] TC-69-01, SCRUM-165 [AC8] TC-165-11: [Negative] a Submitted event with no Coordinator is in no Coordinator's list; it waits for the Lead (SCRUM-165 supersedes AC4)"; `e2e/coordinator-assigned-events.spec.ts` › "SCRUM-69 [AC1, AC4] TC-69-01, TC-69-02, SCRUM-165 [AC8] TC-165-11: my default list shows my events, not another Coordinator's and not unassigned requests (they wait for the Lead)" and "SCRUM-69 [AC1] TC-69-01, SCRUM-135 [AC3, AC4, AC11] TC-135-03, SCRUM-165 [AC4, AC8] TC-165-11: an unassigned Submitted event is in no Coordinator's list"

### TC-69-02

| Item | Content |
|---|---|
| Test Case ID | TC-69-02 |
| Test Scenario | [Negative] AC 1: another Coordinator's event, and an unassigned draft, are neither listed nor openable |
| Pre-conditions | Signed in as the Coordinator. |
| Test Steps | 1. Open **Events**. <br> 2. Open the other Coordinator's event, and an unassigned draft, directly. |
| Test Data | Their ids |
| Expected Result | Neither is listed, and both reads are refused. |

**Automated by:** `tests/unit/coordinator-assigned-events.test.ts` › "SCRUM-69 [AC1] TC-69-02: [Negative] an event assigned to another Coordinator is neither listed nor openable", "SCRUM-15 [AC1, AC8] TC-15-11, SCRUM-16 [AC4] TC-16-03, SCRUM-68 [AC4] TC-68-03, SCRUM-69 [AC1] TC-69-02: [Negative] an unassigned draft is not in any Coordinator's list"; `e2e/coordinator-assigned-events.spec.ts` › "SCRUM-69 [AC1, AC4] TC-69-01, TC-69-02, SCRUM-165 [AC8] TC-165-11: my default list shows my events, not another Coordinator's and not unassigned requests (they wait for the Lead)"

### TC-69-03

| Item | Content |
|---|---|
| Test Case ID | TC-69-03 |
| Test Scenario | [Positive] AC 2: the list shows name, date and status, and is searched, filtered and sorted like My Event Requests |
| Pre-conditions | Signed in as the Coordinator. |
| Test Steps | 1. Read a row. <br> 2. Search by part of a name in a different case. <br> 3. Filter by a status, and open the awaiting-review tab. <br> 4. Sort by start date. |
| Test Data | The seeded events |
| Expected Result | Each row shows the name, proposed date and status. Each step keeps only the matching events, and sorting orders them by proposed date. The awaiting-review tab holds the events this Coordinator can still decide. |

**Automated by:** `tests/unit/coordinator-assigned-events.test.ts` › "SCRUM-69 [AC2] TC-69-03: [Positive] searching by name keeps only matching events, ignoring case", "SCRUM-69 [AC2] TC-69-03: [Positive] filtering by status keeps only that status", "SCRUM-69 [AC2] TC-69-03: [Positive] the Awaiting review tab keeps the events a Coordinator can still decide", "SCRUM-69 [AC2] TC-69-03: [Positive] sorting by start date orders by proposed date"; `e2e/coordinator-assigned-events.spec.ts` › "SCRUM-69 [AC2] TC-69-03, SCRUM-168 [AC2] TC-168-02: the list shows each event's name, proposed date and status, and can be searched"

### TC-69-04

| Item | Content |
|---|---|
| Test Case ID | TC-69-04 |
| Test Scenario | [Positive] AC 3: an event handed to another Coordinator leaves my list and appears in theirs |
| Pre-conditions | An event assigned to this Coordinator. |
| Test Steps | 1. Assign the event to the other Coordinator (the handover). <br> 2. Open **Events** as each. |
| Test Data | The event |
| Expected Result | It is gone from this Coordinator's list and is in the other's. |

**Automated by:** `tests/unit/coordinator-assigned-events.test.ts` › "SCRUM-69 [AC3] TC-69-04: [Positive] after a handover the event leaves my list and is in the new Coordinator's"; `e2e/coordinator-assigned-events.spec.ts` › "SCRUM-69 [AC3] TC-69-04: an event handed to another Coordinator leaves my list and appears in theirs"

### TC-69-05

**Superseded** on 20 Oct 2026 by SCRUM-165 AC 8 ([TC-165-11](SCRUM-165.md#tc-165-11)) and SCRUM-135 AC 3 ([TC-135-03](SCRUM-135.md#tc-135-03)). The Coordinator who approved an unassigned Submitted event became its Coordinator, and it left the others' lists. No Coordinator sees or can approve an unassigned request now; the Lead assigns it (TC-165-07).

**Automated by** (SCRUM-165's tests): `tests/unit/event-status.test.ts` › "SCRUM-165 [AC8] TC-165-11: a Coordinator can't approve a request nobody has been assigned to; it waits for the Lead"; `e2e/coordinator-assigned-events.spec.ts` › "SCRUM-69 [AC1] TC-69-01, SCRUM-135 [AC3, AC4, AC11] TC-135-03, SCRUM-165 [AC4, AC8] TC-165-11: an unassigned Submitted event is in no Coordinator's list"
