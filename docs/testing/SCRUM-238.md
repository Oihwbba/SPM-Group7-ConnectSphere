# SCRUM-238 — Seed data that lets every role see and try every function: test cases

SCRUM-238 is a Chore task in Jira. The seed was built story by story and left
several roles with nothing to do: no safety check for the Safety Officer, one
pending booking for Venue Staff, nothing in review for Technical Support, and
13 statuses and 22 notification types with no row.

Format and conventions: [README.md](README.md).

**Shared pre-conditions:** a local PostgreSQL migrated with `npm run db:deploy`
and seeded with `npm run db:seed`, as in CI's `build-and-test`. The new rows
sit 50 or more days out, on venue and day pairs nothing else uses.

| ID | Type | Criterion | Automated |
|---|---|---|---|
| [TC-238-01](#tc-238-01) | Positive | AC 2 | Integration |
| [TC-238-02](#tc-238-02) | Positive | AC 1 | Integration |
| [TC-238-03](#tc-238-03) | Boundary | AC 3 | CI's seed step; the re-run is Manual |
| [TC-238-04](#tc-238-04) | Positive | AC 4 | The whole suite, in CI |
| [TC-238-05](#tc-238-05) | Positive | AC 5, AC 6 | Manual (a document check, and the shared database after the merge) |

---

### TC-238-01

| Item | Content |
|---|---|
| Test Case ID | TC-238-01 |
| Test Scenario | [Positive] AC 2: every status, and every notification type, has a seeded row |
| Pre-conditions | Freshly seeded. |
| Test Steps | 1. For each workflow record, list the statuses of the rows with seeded ids (`evt_`, `bkg_`, `eqr_`, `res_`, `reg_`, `clr_`, `chg_`, `sfc_`), and the reasons of seeded unavailability (`vun_`, `eun_`). <br> 2. List the types of the seeded notifications (`ntf_`), and who each is for. |
| Test Data | — |
| Expected Result | 1. Every value of every status enum, both rejection outcomes and every unavailability reason appears. <br> 2. All 28 notification types appear. Each staff-only type is for a user holding that role: a new venue request for Venue Staff, a new equipment request for Technical Support, a request awaiting assignment for a Lead, a requested safety check for a Safety Officer, and a changed registered event for an Attendee. |

**Automated by:** `tests/integration/seed-coverage.test.ts` › "SCRUM-238 [AC2] TC-238-01: every status of every workflow record has a seeded row" and "SCRUM-238 [AC2] TC-238-01: every notification type is seeded, for a person who holds the role that receives it"

### TC-238-02

| Item | Content |
|---|---|
| Test Case ID | TC-238-02 |
| Test Scenario | [Positive] AC 1: each role has work waiting to act on |
| Pre-conditions | Freshly seeded. |
| Test Steps | 1. Sign in as each account in the README's "Every role's work" table. <br> 2. Open each page in its menu. |
| Test Data | `coordinator@`, `coordinator2@`, `lead@`, `venuestaff@`, `techsupport@`, `safety@`, `organiser@`, `attendee@` and `multirole@test.local` / `Password123!` |
| Expected Result | Each has something to act on: the Lead an overdue unassigned request; the Safety Officer a check awaiting review; Venue Staff a second pending request, a hold, an approved hold and a flagged booking; Technical Support a request in review, an approved one with nothing reserved and a flagged reservation; the Organiser a clarification naming the fields to change and a complete draft; the Coordinator a cancellation request and an event whose safety check is approved. The multi-role account organises one event (with a pending venue request) and coordinates another. |

**Automated by:** `tests/integration/seed-coverage.test.ts` › "SCRUM-238 [AC1] TC-238-02: each role has work waiting to act on" and "SCRUM-238 [AC1] TC-238-02: the multi-role account organises one event and coordinates another"

### TC-238-03

| Item | Content |
|---|---|
| Test Case ID | TC-238-03 |
| Test Scenario | [Boundary] AC 3: the seed runs again without duplicating anything, and every row passes the database's rules |
| Pre-conditions | A local database, already seeded. |
| Test Steps | 1. Count the rows in Event, Booking, Notification, SafetyCheck and EventOperationalNote. <br> 2. Run `npm run db:seed` again, with `DATABASE_URL` set to the local database. <br> 3. Count again. |
| Test Data | — |
| Expected Result | The seed finishes with no error, and every count is unchanged. A row breaking a database rule (two approved bookings clashing, a second open request or check on an event, a hold without its deadline) would stop the seed, and so CI's `build-and-test`, which seeds before testing. |

**Automated by:** CI's `build-and-test` seeds a fresh database, which fails on any rule broken. The re-run is Manual: run on 28 Oct, with counts 80, 19, 13457, 5 and 3 before and after.

### TC-238-04

| Item | Content |
|---|---|
| Test Case ID | TC-238-04 |
| Test Scenario | [Positive] AC 4: every seeded record the tests rely on is unchanged |
| Pre-conditions | Freshly seeded. |
| Test Steps | 1. Run the unit, integration and e2e suites. |
| Test Data | — |
| Expected Result | Everything passes. The existing rows and ids are untouched; the new rows avoid the dates, venues and equipment the tests use (no new active venue, nothing on the Lectern, nothing reserved on the projector). |

**Automated by:** the whole suite, in CI's `build-and-test`.

### TC-238-05

| Item | Content |
|---|---|
| Test Case ID | TC-238-05 |
| Test Scenario | [Positive] AC 5, AC 6: the docs describe the data, and the shared database has it once merged |
| Pre-conditions | — |
| Test Steps | 1. Read the README's "Every role's work" table and the note in `docs/demo.md`. <br> 2. After the merge, run `npm run db:deploy` and `npm run db:seed` on the shared database, and sign in to the live site as `safety@test.local`. |
| Test Data | — |
| Expected Result | 1. Both describe the new data by account. 2. The Safety Officer sees "Safety Review — Engineering Open Day" awaiting review. |

**Automated by:** Manual (a document check, and a check of the shared database after the merge).
