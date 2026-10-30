# SCRUM-247 — A Coordinator's edit during re-planning can set expected attendance below the people already registered: test cases

SCRUM-247 is a Bug task in Jira under SCRUM-11, raised on 30 Oct from a code
and UI review of the Event Request Lifecycle and Attendee Registration epics.
Its acceptance criteria are in [docs/backlog/SCRUM-247.md](../backlog/SCRUM-247.md).

Format and conventions: [README.md](README.md).

**Why it failed:** expected attendance is the event's registration capacity
(SCRUM-74). A change request can't lower it below the active registrations
(SCRUM-128 AC7), but the Coordinator's direct edit (SCRUM-25 AC3) didn't
check. An event re-planned after an approved change keeps its registrations
(SCRUM-128 AC5), so its attendance could be edited below them. The fix counts
the Registered registrations in the edit's transaction, after the event row
is locked (the lock a registration also takes, SCRUM-73), and refuses an
attendance below that count with `attendanceBelowRegistrationsMessage`, shown
beside the Expected attendance field. The count is taken only when the
attendance changes.

**Shared pre-conditions:** signed in as the event's assigned Coordinator
(`coordinator@test.local` / `Password123!`). The unit cases mock the
database. The integration and e2e cases need a local PostgreSQL migrated
with `npm run db:deploy` and seeded with `npm run db:seed`; they make their
own Planning event for 10, with registrations from the seeded Attendees, and
remove both afterwards.

| ID | Type | Criterion | Automated |
|---|---|---|---|
| [TC-247-01](#tc-247-01) | Negative | AC 1 | Unit, Integration, E2E |
| [TC-247-02](#tc-247-02) | Boundary | AC 1 | Unit, Integration, E2E |
| [TC-247-03](#tc-247-03) | Concurrency | AC 2 | Unit, Integration |
| [TC-247-04](#tc-247-04) | Positive | AC 1 | Unit |

---

### TC-247-01

| Item | Content |
|---|---|
| Test Case ID | TC-247-01 |
| Test Scenario | [Negative] AC 1: an expected attendance below the active registrations is refused, nothing is saved, and the number of active registrations is shown |
| Pre-conditions | A Planning event for 10 with 3 Registered and 1 Withdrawn registration (unit: an event for 60 with 50 Registered) |
| Test Steps | 1. Open the event and choose Edit details. <br> 2. Set Expected attendance to 2 and save. |
| Test Data | Attendance 2 against 3 active (unit: 30 and 49 against 50) |
| Expected Result | "This event has 3 active registrations, so the expected attendance can't be lower than 3." beside Expected attendance, which is marked invalid. The event's attendance stays 10; no audit entry, flag or safety-check change is written. The Withdrawn registration isn't counted. |

**Automated by:** `tests/unit/event-edit.test.ts` › "SCRUM-247 [AC1] TC-247-01: with 50 active registrations, an attendance of %i is refused with the number shown, and nothing is written"; `tests/integration/attendance-below-registrations.test.ts` › "SCRUM-247 [AC1] TC-247-01, TC-247-02: with 3 registered and 1 withdrawn, 2 is refused with nothing written and 3 is saved"; `e2e/attendance-below-registrations.spec.ts` › "SCRUM-247 [AC1] TC-247-01, TC-247-02: below the 3 registered is refused beside the field with nothing saved; exactly 3 saves"

### TC-247-02

| Item | Content |
|---|---|
| Test Case ID | TC-247-02 |
| Test Scenario | [Boundary] AC 1: an attendance of exactly the number of active registrations saves |
| Pre-conditions | As TC-247-01 |
| Test Steps | 1. Open the event and choose Edit details. <br> 2. Set Expected attendance to 3 and save. |
| Test Data | Attendance 3 against 3 active (unit: 50 against 50) |
| Expected Result | "Details saved." The event's attendance is 3, and the change is audited once (unit: from 60 to 50). |

**Automated by:** `tests/unit/event-edit.test.ts` › "SCRUM-247 [AC1] TC-247-02: an attendance of exactly the 50 active registrations is saved and audited"; `tests/integration/attendance-below-registrations.test.ts` › "SCRUM-247 [AC1] TC-247-01, TC-247-02: with 3 registered and 1 withdrawn, 2 is refused with nothing written and 3 is saved"; `e2e/attendance-below-registrations.spec.ts` › "SCRUM-247 [AC1] TC-247-01, TC-247-02: below the 3 registered is refused beside the field with nothing saved; exactly 3 saves"

### TC-247-03

| Item | Content |
|---|---|
| Test Case ID | TC-247-03 |
| Test Scenario | [Concurrency] AC 2: the count is taken under the event-row lock that registration also takes, so a registration and an edit can't together go past the limit |
| Pre-conditions | A Planning event for 10 with 2 Registered registrations |
| Test Steps | 1. A registration locks the event row (`FOR UPDATE`, as SCRUM-73's does) and inserts a third registration, and holds the lock. <br> 2. The Coordinator saves an attendance of 2, which would fit the 2 already there. <br> 3. The registration commits. |
| Test Data | Attendance 10 → 2; a third Attendee registering |
| Expected Result | The edit waits for the lock, then counts 3 and is refused with "This event has 3 active registrations, so the expected attendance can't be lower than 3." The attendance stays 10 and the 3 registrations stand. Counting before the lock lets the edit save 2 for 3 people. In the unit case, the lock is the edit's first query in its transaction and the count follows it. |

**Automated by:** `tests/unit/event-edit.test.ts` › "SCRUM-247 [AC2] TC-247-03: the registrations are counted after the event row is locked, inside the edit's transaction"; `tests/integration/attendance-below-registrations.test.ts` › "SCRUM-247 [AC2] TC-247-03: a registration made at the same moment is waited for and counted, so the edit is refused"

### TC-247-04

| Item | Content |
|---|---|
| Test Case ID | TC-247-04 |
| Test Scenario | [Positive] AC 1: an edit that leaves the attendance unchanged saves as before, and doesn't count registrations |
| Pre-conditions | An event for 60 with 50 Registered (unit) |
| Test Steps | 1. Change only the event's name and save. |
| Test Data | Name "Annual Gala 2036"; attendance 60 unchanged |
| Expected Result | The edit saves; registrations are not counted. |

**Automated by:** `tests/unit/event-edit.test.ts` › "SCRUM-247 [AC1] TC-247-04: an edit that leaves the attendance alone doesn't count registrations"
