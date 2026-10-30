# SCRUM-254 — No event rests in Approved, and stop using the old registration capacity column: test cases

SCRUM-254 is a Chore task in Jira. Approval moves an event straight to
Planning (SCRUM-81), yet the lifecycle still let an event left Approved be
cancelled, the event page treated Approved like Planning, and nothing stopped
an event being stored as Approved. The seed also wrote a registration
capacity the app never reads.

Format and conventions: [README.md](README.md).

**Shared pre-conditions:** a local PostgreSQL migrated with `npm run db:deploy`
and seeded with `npm run db:seed`, as in CI's `build-and-test`. TC-254-01 and
TC-254-02 build their own scratch database instead.

| ID | Type | Criterion | Automated |
|---|---|---|---|
| [TC-254-01](#tc-254-01) | Positive | AC 1 | Integration |
| [TC-254-02](#tc-254-02) | Negative, Boundary | AC 2 | Integration |
| [TC-254-03](#tc-254-03) | Negative | AC 3 | Unit |
| [TC-254-04](#tc-254-04) | Positive | AC 4 | Unit, integration |
| [TC-254-05](#tc-254-05) | Positive | AC 5 | The whole suite, in CI |

---

### TC-254-01

| Item | Content |
|---|---|
| Test Case ID | TC-254-01 |
| Test Scenario | [Positive] AC 1: an event left Approved is moved to Planning when the migration runs, and nothing else changes |
| Pre-conditions | A database with every migration before `20261030130000_no_event_rests_approved`, and three events: one Approved, one Planning and one Under Review. |
| Test Steps | 1. Run the migration. <br> 2. Read each event's status and history. |
| Test Data | — |
| Expected Result | The Approved event is in Planning, with one history entry: Status changed, Approved → Planning, by no user (a system change), as the approve action records it. The other two keep their status, with nothing added to their history. |

**Automated by:** `tests/integration/no-event-rests-approved.test.ts` › "SCRUM-254 [AC1] TC-254-01: …" (2 tests)

### TC-254-02

| Item | Content |
|---|---|
| Test Case ID | TC-254-02 |
| Test Scenario | [Negative, Boundary] AC 2: the database refuses an event stored as Approved, and still allows approval's move |
| Pre-conditions | The migrated scratch database of TC-254-01. |
| Test Steps | 1. Insert an event as Approved. <br> 2. Change the Under Review event to Approved. <br> 3. Change it to Planning instead. |
| Test Data | — |
| Expected Result | 1 and 2 are refused with SQLSTATE 23514 and the constraint `event_never_rests_approved`; no event is added and the Under Review one is unchanged. 3 is saved. |

**Automated by:** `tests/integration/no-event-rests-approved.test.ts` › "SCRUM-254 [AC2] TC-254-02: …" (2 tests)

### TC-254-03

| Item | Content |
|---|---|
| Test Case ID | TC-254-03 |
| Test Scenario | [Negative] AC 3: nothing moves an event out of Approved, and no page treats one as Approved |
| Pre-conditions | — |
| Test Steps | 1. Ask the lifecycle for every move out of Approved. <br> 2. Cancel an event read as Approved, as its Coordinator. <br> 3. Read the statuses that open Arrangements, and the next step for an Approved event. |
| Test Data | — |
| Expected Result | 1. None is allowed, Cancelled included. 2. Refused with "This event is Approved, so it can't be cancelled."; nothing is written. 3. Arrangements open from Planning: Planning, Confirmed, Completed and Cancelled. An Approved event gets "Nothing is waiting.", not Planning's checklist. |

**Automated by:** `tests/unit/event-lifecycle.test.ts` › "SCRUM-254 [AC3] TC-254-03: nothing moves an event out of Approved either, not even to Cancelled"; `tests/unit/cancel-event.test.ts` › "SCRUM-254 [AC3] TC-254-03: an event read as Approved can't be cancelled, and nothing is written"; `tests/unit/event-next-step.test.ts` › "SCRUM-254 [AC3] TC-254-03: Arrangements and the next step start at Planning, not Approved"

### TC-254-04

| Item | Content |
|---|---|
| Test Case ID | TC-254-04 |
| Test Scenario | [Positive] AC 4: the old registration capacity column is no longer read or written |
| Pre-conditions | The Prisma client generated from `prisma/schema.prisma`; freshly seeded. |
| Test Steps | 1. List the Event fields the client reads and writes. <br> 2. List the seeded events (`evt_`) with a value in the column. |
| Test Data | — |
| Expected Result | 1. `registrationCapacity` is not among them (the schema marks it `@ignore`); `expectedAttendance` is. 2. None: the seed writes no separate capacity. The column itself stays until a later migration drops it. |

**Automated by:** `tests/unit/registration-capacity-column.test.ts` › "SCRUM-254 [AC4] TC-254-04: the database client has no Event.registrationCapacity to read or write"; `tests/integration/seed-lifecycle.test.ts` › "SCRUM-233 [AC13] TC-233-13: …" (step 2)

### TC-254-05

| Item | Content |
|---|---|
| Test Case ID | TC-254-05 |
| Test Scenario | [Positive] AC 5: no test stores an event as Approved |
| Pre-conditions | The migrated, seeded database, with `event_never_rests_approved`. |
| Test Steps | 1. Run the whole suite. |
| Test Data | — |
| Expected Result | Every test passes. A test that stored an event as Approved would now fail on the constraint; the two that did (`event-page-data.test.ts`, `request-reservation.test.ts`) use a Planning event instead. |

**Automated by:** CI's `build-and-test`, which migrates and seeds before running the suite
