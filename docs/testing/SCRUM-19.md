# SCRUM-19 — Approve or reject an event request: test cases

Story and acceptance criteria: [docs/backlog/SCRUM-19.md](../backlog/SCRUM-19.md).
Format and conventions: [README.md](README.md). Decisions go through
`transitionEventStatus` in
[app/(app)/events/actions.ts](<../../app/(app)/events/actions.ts>), the single
gate SCRUM-24 requires (ADR 0006).

Written on 2026-10-12 from the acceptance criteria, then mapped to the tests
that already existed (SCRUM-176). The tests predate the `SCRUM-n [ACx] TC-n-xx`
title format, so each case names them by their current titles.

**AC 1 was overtaken.** Approving no longer leaves a request Approved: it
moves straight to Planning in the same step, with Approved kept in its history
(SCRUM-81, ADR 0012, SCRUM-135 AC12). TC-19-01 tests that.

**Shared pre-conditions for every case:** the database is migrated and seeded
and the app is running. A request submitted by `organiser@test.local` is Under
Review with `coordinator@test.local` (both `Password123!`).

| ID | Type | Criterion | Automated |
|---|---|---|---|
| [TC-19-01](#tc-19-01) | Positive | AC 1, AC 2 | Unit, e2e |
| [TC-19-02](#tc-19-02) | Positive | AC 3 | Unit, e2e |
| [TC-19-03](#tc-19-03) | Negative | AC 3 | Unit, e2e |
| [TC-19-04](#tc-19-04) | Positive | AC 4 | Unit, e2e |
| [TC-19-05](#tc-19-05) | Positive | AC 5 | Unit |
| [TC-19-06](#tc-19-06) | Concurrency | AC 6 | Unit, integration |

---

### TC-19-01

| Item | Content |
|---|---|
| Test Case ID | TC-19-01 |
| Test Scenario | [Positive] AC 1, AC 2: approving a request starts planning |
| Pre-conditions | Signed in as the assigned Coordinator. |
| Test Steps | 1. Open the request and click **Approve**. |
| Test Data | The Under Review request |
| Expected Result | The request is in Planning, with who approved it and when recorded; Approved appears only in its history. Nothing is booked or reserved yet: approval means planning can start. |

**Automated by:** `tests/unit/event-status.test.ts` › "SCRUM-19 [AC1, AC2] TC-19-01: the assigned coordinator approves an under-review request", "SCRUM-81 [AC1] TC-81-01: approving an assigned request moves it to Planning, recording who approved it and when"; `e2e/events.spec.ts` › "SCRUM-81 [AC1, AC2] TC-81-01: coordinator approves an under-review event and status moves to PLANNING (SCRUM-24)"

### TC-19-02

| Item | Content |
|---|---|
| Test Case ID | TC-19-02 |
| Test Scenario | [Positive] AC 3: rejecting a request records the reason, and the Organiser sees it |
| Pre-conditions | Signed in as the assigned Coordinator. |
| Test Steps | 1. On the request's row, click **Reject**. <br> 2. In "Reject event request", choose **Amend and resubmit** and fill **Rejection reason**. <br> 3. Click **Reject request**. <br> 4. Sign in as the Organiser and open the request. |
| Test Data | Reason "The venue is booked that week; please pick another date." |
| Expected Result | The request is Rejected, with the reason saved. The Organiser's details show "Rejection reason" with that text. |

**Automated by:** `tests/unit/event-status.test.ts` › "SCRUM-19 [AC3] TC-19-02: a rejection records its reason"; `e2e/events.spec.ts` › "SCRUM-126 [AC2] TC-126-03: coordinator rejects with a reason, organiser sees it, amends and resubmits it back into review"

### TC-19-03

| Item | Content |
|---|---|
| Test Case ID | TC-19-03 |
| Test Scenario | [Negative] AC 3: a rejection needs a reason that isn't blank |
| Pre-conditions | Signed in as the assigned Coordinator, in "Reject event request". |
| Test Steps | 1. Fill **Rejection reason** with spaces only. <br> 2. Try to click **Reject request**, or send the rejection directly. |
| Test Data | "   " |
| Expected Result | The rejection is refused ("A rejection reason is required."), and the request stays Under Review with nothing written. |

**Automated by:** `tests/unit/event-status.test.ts` › "SCRUM-19 [AC3] TC-19-03: a rejection with a blank reason is refused and nothing is written"; `e2e/events.spec.ts` › "SCRUM-126 [AC2] TC-126-03: coordinator rejects with a reason, organiser sees it, amends and resubmits it back into review"

### TC-19-04

| Item | Content |
|---|---|
| Test Case ID | TC-19-04 |
| Test Scenario | [Positive] AC 4: an amended rejected request returns to review |
| Pre-conditions | The request was rejected with **Amend and resubmit** (TC-19-02). Signed in as the Organiser. |
| Test Steps | 1. On the request's row, click **Amend & Resubmit**. <br> 2. In "Amend Rejected Event Request", change **Venue Requirements** and submit. |
| Test Data | Venue requirements "Any room — a different date is fine." |
| Expected Result | "Event request submitted for review successfully!" The request is back in review with the same Coordinator, and the old decision is cleared. |

**Automated by:** `tests/unit/event-status.test.ts` › "SCRUM-19 [AC4] TC-19-04: an organiser resubmits an amended rejected request and the old decision is cleared"; `e2e/events.spec.ts` › "SCRUM-126 [AC2] TC-126-03: coordinator rejects with a reason, organiser sees it, amends and resubmits it back into review"

### TC-19-05

| Item | Content |
|---|---|
| Test Case ID | TC-19-05 |
| Test Scenario | [Positive] AC 5: a rejected request is kept, not deleted |
| Pre-conditions | A request rejected as needing a new request (SCRUM-126). Signed in as the Organiser. |
| Test Steps | 1. Open **My Events**. <br> 2. Try to resubmit the rejected request. |
| Test Data | The rejected request |
| Expected Result | The request is still listed as Rejected. Resubmitting it is refused, and nothing is written. |

**Automated by:** `tests/unit/rejection-outcome.test.ts` › "SCRUM-126 [AC3] TC-126-04: a request rejected as needing a new request stays Rejected: resubmitting it is refused and nothing is written"

### TC-19-06

| Item | Content |
|---|---|
| Test Case ID | TC-19-06 |
| Test Scenario | [Concurrency] AC 6: two decisions at the same moment: one wins, and the other is told to refresh |
| Pre-conditions | Two tabs as the assigned Coordinator on the same request. |
| Test Steps | 1. Click **Approve** in one tab and **Reject** in the other at the same moment. |
| Test Data | The Under Review request |
| Expected Result | One decision is saved. The other is refused with "This event was updated by another user. Refresh and try again.", and writes no history entry. |

**Automated by:** `tests/unit/event-status.test.ts` › "SCRUM-24 [AC7] TC-24-04, SCRUM-19 [AC6] TC-19-06: the loser of two simultaneous decisions is told to refresh, and no audit entry is written"; `tests/integration/concurrency.test.ts` › "SCRUM-24 [AC7] TC-24-04, SCRUM-135 [AC14] TC-135-14, SCRUM-19 [AC6] TC-19-06: the loser of two simultaneous decisions is told to refresh, and no audit entry is written"
