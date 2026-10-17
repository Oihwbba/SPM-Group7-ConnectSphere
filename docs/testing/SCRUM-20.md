# SCRUM-20 — Auto-assign a coordinator to a submitted event: test cases

Story and acceptance criteria: [docs/backlog/SCRUM-20.md](../backlog/SCRUM-20.md).
Format and conventions: [README.md](README.md). A Coordinator is picked by
`pickCoordinator` in
[lib/coordinator-assignment.ts](../../lib/coordinator-assignment.ts), under a
transaction-scoped advisory lock, inside `submitEventRequest`.

Written on 2026-10-12 from the acceptance criteria, then mapped to the tests
that already existed (SCRUM-176). The tests predate the `SCRUM-n [ACx] TC-n-xx`
title format, so each case names them by their current titles.

**What changes next:** SCRUM-165 replaces automatic assignment with the Lead's
unassigned queue (Week 7 change 5). These cases describe the system as built
today. AC 7's notification is now SCRUM-45 (AC 1); SCRUM-46 no longer exists.

**Shared pre-conditions for every case:** the database is migrated and seeded
and the app is running. Signed in as `organiser@test.local` (`Password123!`).
The seed has two active Coordinators.

| ID | Type | Criterion | Automated |
|---|---|---|---|
| [TC-20-01](#tc-20-01) | Positive | AC 1, AC 2, AC 3, AC 7, AC 8 | Unit, e2e |
| [TC-20-02](#tc-20-02) | Positive | AC 4, AC 5 | Unit |
| [TC-20-03](#tc-20-03) | Concurrency | AC 6 | Unit, integration |
| [TC-20-04](#tc-20-04) | Boundary | AC 9 | Unit |
| [TC-20-05](#tc-20-05) | Negative | AC 1 | Unit |

---

### TC-20-01

| Item | Content |
|---|---|
| Test Case ID | TC-20-01 |
| Test Scenario | [Positive] AC 1, AC 2, AC 3, AC 7, AC 8: a submitted request gets exactly one Coordinator, moves to Under Review, and both people are told |
| Pre-conditions | Signed in as the Organiser. |
| Test Steps | 1. Submit a complete request. <br> 2. Open it. <br> 3. Sign in as the Coordinator it names and open **Notifications**. |
| Test Data | Any complete request |
| Expected Result | The request is Under Review with one named Coordinator, recorded as its contact, with no accept or decline step. The assignment is in its history, and the Organiser and the Coordinator each have one notification. |

**Automated by:** `tests/unit/event-auto-assignment.test.ts` › "AC: a coordinator is available — event is assigned, moved to UNDER_REVIEW, both parties notified", "AC: an event has at most one assigned coordinator — the update sets exactly one coordinatorId", "AC: the assignment is logged for auditability", "AC: no accept/decline step — assignment and status change happen in the same write, nothing awaits a response"; `e2e/coordinator-assignment.spec.ts` › "submitting an event automatically assigns exactly one coordinator and moves it to Under Review, with no accept/decline step"

### TC-20-02

| Item | Content |
|---|---|
| Test Case ID | TC-20-02 |
| Test Scenario | [Positive] AC 4, AC 5: the Coordinator with the fewest active events gets the request, whatever their load |
| Pre-conditions | Coordinator A has two events Under Review; Coordinator B has one in Planning and three Completed. |
| Test Steps | 1. Submit a request. <br> 2. With only one Coordinator, submit another, whatever their load. |
| Test Data | The loads above |
| Expected Result | Step 1 goes to B, because Completed, Cancelled and Rejected events don't count. Step 2 goes to the only Coordinator; there is no cap. |

**Automated by:** `tests/unit/coordinator-assignment.test.ts` › "AC: picks the coordinator with the fewest active events", "AC: only counts ACTIVE events as load, not terminal ones (COMPLETED/CANCELLED/REJECTED excluded by the query)", "Boundary: a single coordinator is always picked, regardless of their load"

### TC-20-03

| Item | Content |
|---|---|
| Test Case ID | TC-20-03 |
| Test Scenario | [Concurrency] AC 6: two requests submitted at the same moment are assigned one after the other |
| Pre-conditions | Two Organisers' tabs, each with a complete draft. |
| Test Steps | 1. Submit both at the same moment. |
| Test Data | Two complete drafts |
| Expected Result | Each request has exactly one Coordinator and neither is left unassigned. The second assignment counts the first. |

**Automated by:** `tests/unit/coordinator-assignment.test.ts` › "AC: takes the assignment lock BEFORE reading load, so a concurrent submission counts this one's assignment"; `tests/integration/concurrency.test.ts` › "SCRUM-20: two events submitted at the same instant each end up with exactly one coordinator, and neither is left unassigned"

### TC-20-04

| Item | Content |
|---|---|
| Test Case ID | TC-20-04 |
| Test Scenario | [Boundary] AC 9: with no Coordinator account, the request stays Submitted and doesn't fail |
| Pre-conditions | A test database with no active Coordinator. |
| Test Steps | 1. Submit a complete request. |
| Test Data | Any complete request |
| Expected Result | The submission succeeds and the request is Submitted, not Under Review. |

**Automated by:** `tests/unit/event-auto-assignment.test.ts` › "AC: no coordinator available — event still reaches SUBMITTED and does not fail silently (no throw)"; `tests/unit/coordinator-assignment.test.ts` › "AC: no coordinators available — returns null rather than throwing, so the caller can still reach SUBMITTED". An e2e run isn't possible: removing every seeded Coordinator would break the shared data other tests use. `e2e/coordinator-assignment.spec.ts` › "when no coordinators exist, the event still reaches Submitted rather than failing" holds the case but is skipped (`test.skip`) for that reason, so CI reports it as Not Executed.

### TC-20-05

| Item | Content |
|---|---|
| Test Case ID | TC-20-05 |
| Test Scenario | [Negative] AC 1: a Coordinator can't claim a request into review by hand |
| Pre-conditions | Signed in as a Coordinator, with a Submitted request. |
| Test Steps | 1. Send a status change to Under Review for it directly. |
| Test Data | The Submitted request's id |
| Expected Result | The change is refused and the request is unchanged; only assignment moves it to Under Review. |

**Automated by:** `tests/unit/event-status.test.ts` › "SCRUM-20: a coordinator cannot claim a request into review — that transition is automatic"
