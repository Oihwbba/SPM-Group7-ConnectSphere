# SCRUM-164 — The Event Coordinator Lead and Safety Officer sign in with their own role: test cases

Story and acceptance criteria: [docs/backlog/SCRUM-164.md](../backlog/SCRUM-164.md).
Format and conventions: [README.md](README.md). The roles themselves were
added by SCRUM-172; the work each role does is SCRUM-165, SCRUM-21 and
SCRUM-141 (the Lead) and SCRUM-166 (the Safety Officer), tested in their own
specifications.

**Shared pre-conditions for every case:** the database is migrated and seeded
and the app is running. The seed has `lead@test.local` (Event Coordinator
Lead) and `safety@test.local` (Safety Officer). Every account's password is
`Password123!`.

| ID | Type | Criterion | Automated |
|---|---|---|---|
| [TC-164-01](#tc-164-01) | Positive | AC 1, AC 4 | Unit, e2e |
| [TC-164-02](#tc-164-02) | Positive | AC 1, AC 4 | Unit, e2e |
| [TC-164-03](#tc-164-03) | Negative | AC 1, AC 3 | e2e |
| [TC-164-04](#tc-164-04) | Negative | AC 2, AC 3 | Unit, integration |
| [TC-164-05](#tc-164-05) | Positive | AC 2 | Unit, integration, e2e |
| [TC-164-06](#tc-164-06) | Positive | AC 5 | Manual |

### TC-164-01

| Item | Content |
|---|---|
| Test Case ID | TC-164-01 |
| Test Scenario | [Positive] AC 1, AC 4: the seeded Lead signs in, lands on its role's home page, and its menu shows only what the role allows |
| Pre-conditions | Signed out. |
| Test Steps | 1. Sign in as the Lead. <br> 2. Look at the side menu and the user menu. |
| Test Data | `lead@test.local` / `Password123!` |
| Expected Result | The Lead lands on the first page its role allows, the Unassigned queue (SCRUM-165). The user menu reads "Event Coordinator Lead". The side menu has only Unassigned Queue, Venue Catalogue (SCRUM-34 AC2) and All Events (SCRUM-141), all derived from the permission table; notifications are reached from the bell (SCRUM-207). |

**Automated by:** `e2e/coordinator-lead-role.spec.ts` › "SCRUM-164 [AC1, AC4] TC-164-01: …"; `tests/unit/nav.test.ts` › "SCRUM-172 [AC1] TC-172-01, SCRUM-164 [AC1] TC-164-01, SCRUM-165 [AC10] TC-165-13: COORDINATOR_LEAD is labelled and lands on the Unassigned queue"

### TC-164-02

| Item | Content |
|---|---|
| Test Case ID | TC-164-02 |
| Test Scenario | [Positive] AC 1, AC 4: the seeded Safety Officer signs in and lands on its role's home page |
| Pre-conditions | Signed out. |
| Test Steps | 1. Sign in as the Safety Officer. <br> 2. Look at the side menu. |
| Test Data | `safety@test.local` / `Password123!` |
| Expected Result | The Safety Officer lands on Safety Checks. The side menu has only Safety Checks and Venue Catalogue; notifications are reached from the bell (SCRUM-207). |

**Automated by:** `tests/unit/nav.test.ts` › "SCRUM-172 [AC1] TC-172-01, SCRUM-166 [AC1] TC-166-03: SAFETY_OFFICER is labelled and lands on the safety check queue"; `e2e/safety-check.spec.ts` › "SCRUM-166 [AC1, AC2, AC3, AC9, AC14] TC-166-15: …" (signs in as `safety@test.local` and lands on `/safety-checks`)

### TC-164-03

| Item | Content |
|---|---|
| Test Case ID | TC-164-03 |
| Test Scenario | [Negative] AC 1, AC 3: the Lead typing another role's page directly is refused |
| Pre-conditions | Signed in as the Lead. |
| Test Steps | 1. Type each URL into the address bar: `/events`, `/bookings/new`, `/bookings`, `/equipment`, `/registrations`. |
| Test Data | `lead@test.local` |
| Expected Result | Each page shows "Access denied" and nothing else. |

**Automated by:** `e2e/coordinator-lead-role.spec.ts` › "SCRUM-164 [AC1, AC3] TC-164-03: the Lead typing … directly is refused" (5 tests)

### TC-164-04

| Item | Content |
|---|---|
| Test Case ID | TC-164-04 |
| Test Scenario | [Negative] AC 2, AC 3: neither role can decide, plan or edit an event, even by calling the action directly |
| Pre-conditions | A session for each role. |
| Test Steps | 1. Ask the permission table whether each role may create, review, confirm or reject an event, decide a booking, record unavailability or reserve equipment. <br> 2. Call `createDraftEvent` directly as each role. |
| Test Data | Roles `COORDINATOR_LEAD`, `SAFETY_OFFICER` |
| Expected Result | Every check is refused. The direct call is refused and the database is unchanged. |

**Automated by:** `tests/unit/auth.test.ts` › "SCRUM-172 [AC1] TC-172-01: %s reads only its own notifications and can't decide, plan or edit an event" (2 tests); `tests/integration/permission-guard.test.ts` › "refuses %s directly and leaves the database unchanged" (includes both roles)

### TC-164-05

| Item | Content |
|---|---|
| Test Case ID | TC-164-05 |
| Test Scenario | [Positive] AC 2: each role can do its own job |
| Pre-conditions | Signed in as the Lead, or as the Safety Officer. |
| Test Steps | 1. As the Lead, assign, reassign and view every event. <br> 2. As the Safety Officer, record a safety check's outcome. |
| Test Data | `lead@test.local`, `safety@test.local` |
| Expected Result | The Lead's work behaves as SCRUM-165, SCRUM-21 and SCRUM-141 describe. The Safety Officer's work behaves as SCRUM-166 describes, and its approval doesn't confirm the event (SCRUM-166 AC14). |

**Automated by:** the Safety Officer's half by SCRUM-166's cases ([TC-166-15](SCRUM-166.md#tc-166-15)). The Lead's half by SCRUM-165's, SCRUM-21's and SCRUM-141's cases: `e2e/lead-queue.spec.ts` › "SCRUM-14 [AC1] TC-14-01, SCRUM-20 [AC1, AC2, AC3, AC7, AC8] TC-20-01, SCRUM-135 [AC2, AC6] TC-135-02, SCRUM-164 [AC2] TC-164-05, SCRUM-165 [AC1, AC2, AC3, AC4, AC5, AC8, AC11] TC-165-01, TC-165-02, TC-165-04, TC-165-05, TC-165-07, TC-165-11, TC-165-14: a submitted request waits in the queue, the Lead assigns it, and only then does the Coordinator get it" (assigning), `e2e/reassign.spec.ts` › "SCRUM-21 [AC1, AC5, AC6, AC8] …" (reassigning) and `e2e/all-events.spec.ts` › "SCRUM-141 [AC2, AC3, AC5] TC-141-04, TC-141-06, TC-141-08: …" (every event), with `tests/integration/reassign.test.ts` › "SCRUM-21 [AC2, AC9] TC-21-02: …"

### TC-164-06

| Item | Content |
|---|---|
| Test Case ID | TC-164-06 |
| Test Scenario | [Positive] AC 5: the product overview lists all seven roles |
| Pre-conditions | — |
| Test Steps | 1. Open `docs/product-context.md`, "Who uses it". |
| Test Data | — |
| Expected Result | Seven roles are listed, including the Event Coordinator Lead and the Safety Officer. |

**Automated by:** **Manual** (a document check)
