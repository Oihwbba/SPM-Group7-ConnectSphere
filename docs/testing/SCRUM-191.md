# SCRUM-191 — Integration suites race each other through shared data: test cases

SCRUM-191 is a Bug task in Jira, not a story, so it has no file in
[docs/backlog](../backlog/README.md) until the next sync. Its acceptance
criteria, as filed:

1. No suite's cleanup can fail because another suite used an account it made
   (SCRUM-165's race test, which replaced SCRUM-20's).
2. A second Safety Officer (`safety2@test.local`) is seeded, and SCRUM-166's
   suite uses it without creating or deleting an account, clearing only the
   notices about its own events.
3. README.md, `docs/data-model.md` and `docs/product-context.md` describe the
   Safety Officer and the Lead as built, and list the seeded accounts.
4. The whole Vitest suite with coverage passes repeatedly against the local
   database.
5. SCRUM-50's TC-50-09 judges only rows no other suite changed after the list
   was read, still checks both of its own events, and still fails if Confirmed
   events are offered.

Format and conventions: [README.md](README.md).

**Why these races happen:** Vitest runs test files in parallel against one
database. A notice sent to everyone with a role (SCRUM-124, SCRUM-166) reaches
any account of that role that exists at that moment, including one another
suite made and is about to delete. An account a suite makes mid-run therefore
either holds no such role, or is seeded instead.

**Shared pre-conditions for every case:** a local PostgreSQL migrated with
`npm run db:deploy` and seeded with `npm run db:seed`.

| ID | Type | Criterion | Automated |
|---|---|---|---|
| [TC-191-01](#tc-191-01) | Concurrency | AC 1 | Integration |
| [TC-191-02](#tc-191-02) | Concurrency | AC 2 | Integration |
| [TC-191-03](#tc-191-03) | Concurrency | AC 1 | Integration |
| [TC-191-04](#tc-191-04) | Concurrency | AC 5 | Integration |
| [TC-191-05](#tc-191-05) | Positive | AC 4 | Integration (the whole suite) |
| [TC-191-06](#tc-191-06) | Positive | AC 3 | Manual |

---

### TC-191-01

| Item | Content |
|---|---|
| Test Case ID | TC-191-01 |
| Test Scenario | [Concurrency] AC 1: two Leads assigning one request at once use seeded accounts |
| Pre-conditions | `lead@test.local` and `lead2@test.local` are seeded. |
| Test Steps | 1. Run `tests/integration/concurrency.test.ts` with the other suites. |
| Test Data | — |
| Expected Result | The race test signs in as both seeded Leads, creates and deletes no account, and passes whatever other suites submit meanwhile. |

**Automated by:** `tests/integration/concurrency.test.ts` › "SCRUM-165 [AC6] TC-165-08: [Concurrency] two Leads assign the same request at the same moment: exactly one assignment is saved and the other Lead is told who it went to"

### TC-191-02

| Item | Content |
|---|---|
| Test Case ID | TC-191-02 |
| Test Scenario | [Concurrency] AC 2: SCRUM-166's suite uses the seeded second Safety Officer |
| Pre-conditions | `safety@test.local` and `safety2@test.local` are seeded. |
| Test Steps | 1. Run `tests/integration/safety-check.test.ts` with the other suites. |
| Test Data | — |
| Expected Result | A requested check tells both seeded officers; two officers recording at once save one outcome. The suite creates and deletes no account, and clears only its own events' notices. |

**Automated by:** `tests/integration/safety-check.test.ts` › "SCRUM-166 [AC1, AC9] TC-166-01: once the venue is arranged, a requested check awaits review, every Safety Officer is notified, and Confirm waits for it" and "SCRUM-166 [AC8] TC-166-11: two Safety Officers recording at the same moment save only the first; the second is shown it"

### TC-191-03

| Item | Content |
|---|---|
| Test Case ID | TC-191-03 |
| Test Scenario | [Concurrency] AC 1: an account a suite deletes holds no role that other suites notify |
| Pre-conditions | — |
| Test Steps | 1. Run `tests/integration/w9-rules.test.ts` with the other suites. |
| Test Data | — |
| Expected Result | SCRUM-172's hold approver, which the test deletes to prove the database keeps who approved, is an Attendee, so no Venue Staff notice reaches it and the deletion fails only for the reason the test proves. |

**Automated by:** `tests/integration/w9-rules.test.ts` › "SCRUM-172 [AC13] TC-172-18: a user who approved a hold can't be deleted, so the approval never loses who made it"

### TC-191-04

| Item | Content |
|---|---|
| Test Case ID | TC-191-04 |
| Test Scenario | [Concurrency] AC 5: TC-50-09 isn't failed by an event another suite confirms after the list is read |
| Pre-conditions | — |
| Test Steps | 1. Run `tests/integration/bookings.test.ts` with the other suites. <br> 2. Make `getBookableEvents` offer Confirmed events too, and run it again. |
| Test Data | — |
| Expected Result | Step 1: it judges only rows unchanged since the list was read, and both of its own events are among them. Step 2: it fails. |

**Automated by:** `tests/integration/bookings.test.ts` › "SCRUM-50 TC-50-09: the form offers only approved events the coordinator may act on, exactly as can() allows" (step 2 is the PR's mutation check)

### TC-191-05

| Item | Content |
|---|---|
| Test Case ID | TC-191-05 |
| Test Scenario | [Positive] AC 4: the whole suite passes run after run |
| Pre-conditions | — |
| Test Steps | 1. Run `npx vitest run --coverage` three times in a row against the local database. |
| Test Data | — |
| Expected Result | Every run passes, with no suite failing in its cleanup, and every file at 100%. |

**Automated by:** the whole suite; CI runs it on every pull request.

### TC-191-06

| Item | Content |
|---|---|
| Test Case ID | TC-191-06 |
| Test Scenario | [Positive] AC 3: the docs describe the Lead and the Safety Officer as built |
| Pre-conditions | — |
| Test Steps | 1. Read README.md's roles summary and seed table, `docs/data-model.md`'s roles paragraph and `docs/product-context.md`'s roles table. |
| Test Data | — |
| Expected Result | The Lead assigns from the Unassigned Queue (SCRUM-165) and sees all events (SCRUM-141), with reassigning still to come (SCRUM-21); the Safety Officer reviews checks on the Safety Checks page (SCRUM-166). Both seeded accounts of each role are listed. |

**Automated by:** Manual (a documentation check).
