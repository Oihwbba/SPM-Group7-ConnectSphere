# SCRUM-262 — An event that already took place can still be cancelled or sent back to Planning, and All Events shows it as Confirmed: test cases

Story and acceptance criteria: [docs/backlog/SCRUM-262.md](../backlog/SCRUM-262.md).
Format and conventions: [README.md](README.md).

SCRUM-262 is a Bug task. The fix: All Events completes finished events before
reading (`app/(app)/all-events/queries.ts`), and each action that changes a
Confirmed event's status calls `completeIfTakenPlace` (`lib/event-closing.ts`)
right after locking the event row: Cancel (`cancel-actions.ts`), deciding a
change request (`change-decision-actions.ts`) and resolving a flagged
arrangement (`reconsideration-actions.ts`). Why: ADR 0019's 2026-11-01
addendum.

**Shared pre-conditions:** the database is migrated and seeded
(`npm run db:deploy && npm run db:seed`). Each case uses a Confirmed event of
`coordinator@test.local` (Cody) whose end has passed, unless it says otherwise.
The integration cases run against a local database only.

| ID | Type | Criterion | Automated |
|---|---|---|---|
| [TC-262-01](#tc-262-01) | Negative | AC 1, AC 3 | Unit, integration |
| [TC-262-02](#tc-262-02) | Boundary | AC 4 | Unit, integration |
| [TC-262-03](#tc-262-03) | Negative | AC 2, AC 3 | Unit, integration |
| [TC-262-04](#tc-262-04) | Negative | AC 2, AC 3 | Unit, integration |
| [TC-262-05](#tc-262-05) | Positive | AC 5 | Unit, integration |
| [TC-262-06](#tc-262-06) | Positive | AC 6 | Manual (a document check) |

---

### TC-262-01

| Item | Content |
|---|---|
| Test Case ID | TC-262-01 |
| Test Scenario | [Negative] AC 1, AC 3: cancelling an event that has taken place is refused, and the event is saved as Completed |
| Pre-conditions | Shared; the event ended three days ago and is still saved as Confirmed. |
| Test Steps | 1. As Cody, cancel the event with a reason. |
| Test Data | Reason "Too late." |
| Expected Result | Refused: "The event has already taken place." The event is now Completed, with one history entry (Completed), and nothing is cancelled. The event row is locked before the check. |

**Automated by:** `tests/integration/finished-event.test.ts` › "SCRUM-262 [AC1, AC3] TC-262-01: cancelling an event that has taken place is refused, and the event is saved as Completed"; `tests/unit/cancel-event.test.ts` › "SCRUM-262 [AC1, AC3] TC-262-01: an event that has taken place is completed under its lock and not cancelled"

### TC-262-02

| Item | Content |
|---|---|
| Test Case ID | TC-262-02 |
| Test Scenario | [Boundary] AC 4: at exactly its end the event is still Confirmed; after it, it has taken place |
| Pre-conditions | A Confirmed event that ended an hour ago; another that ends in an hour. |
| Test Steps | 1. Check the first event at exactly its end time, then one millisecond later. <br> 2. As Cody, cancel the second event. |
| Test Data | Reason "Venue flooded." |
| Expected Result | 1. At its end it stays Confirmed; one millisecond later it is Completed. Only that event is touched. 2. It is cancelled as before. |

**Automated by:** `tests/integration/finished-event.test.ts` › "SCRUM-262 [AC4] TC-262-02: at exactly its end the event is still Confirmed; one millisecond later it has taken place", "SCRUM-262 [AC4] TC-262-02: an event that hasn't ended can still be cancelled"; `tests/unit/event-closing.test.ts` › "SCRUM-262 [AC1, AC4] TC-262-02: completeIfTakenPlace completes only that event, strictly after its end, and says it had taken place", "SCRUM-262 [AC4] TC-262-02: completeIfTakenPlace leaves an event that hasn't taken place as it is"

### TC-262-03

| Item | Content |
|---|---|
| Test Case ID | TC-262-03 |
| Test Scenario | [Negative] AC 2, AC 3: a change request for an event that has taken place is rejected as taken place, not applied |
| Pre-conditions | Shared; the Organiser submitted a change request raising the expected attendance from 20 to 30. |
| Test Steps | 1. As Cody, approve the change request. |
| Test Data | — |
| Expected Result | Refused: "The event has already taken place." The event is Completed, the change request is Rejected with that reason (SCRUM-82 AC11), and the expected attendance is still 20. |

**Automated by:** `tests/integration/finished-event.test.ts` › "SCRUM-262 [AC2, AC3] TC-262-03: a change request for an event that has taken place is rejected as taken place, not applied"; `tests/unit/change-decision.test.ts` › "SCRUM-262 [AC2, AC3] TC-262-03: a change request for an event that has taken place is not decided"

### TC-262-04

| Item | Content |
|---|---|
| Test Case ID | TC-262-04 |
| Test Scenario | [Negative] AC 2, AC 3: a flagged arrangement on an event that has taken place is left as it is, and the event never returns to Planning |
| Pre-conditions | Shared; a projector reservation for the event is flagged Needs Reconsideration. |
| Test Steps | 1. As Cody, choose **Cancel arrangement** on it. |
| Test Data | — |
| Expected Result | Refused: "The event has already taken place." The event is Completed, not Planning; the reservation is still reserved and flagged. |

**Automated by:** `tests/integration/finished-event.test.ts` › "SCRUM-262 [AC2, AC3] TC-262-04: a flagged reservation on an event that has taken place is left as it is, and the event never returns to Planning"; `tests/unit/reconsideration-actions.test.ts` › "SCRUM-262 [AC2, AC3] TC-262-04: a flag on an event that has taken place is not resolved"

### TC-262-05

| Item | Content |
|---|---|
| Test Case ID | TC-262-05 |
| Test Scenario | [Positive] AC 5: All Events shows an event that has taken place as Completed |
| Pre-conditions | Shared. |
| Test Steps | 1. As the Lead, open All Events. <br> 2. Filter by Completed. <br> 3. Open the event. |
| Test Data | `lead@test.local` |
| Expected Result | 1. The event is listed as Completed. 2. The filter includes it. 3. It opens as Completed. Someone who can't see All Events completes nothing. |

**Automated by:** `tests/integration/finished-event.test.ts` › "SCRUM-262 [AC5] TC-262-05: All Events lists and opens an event that has taken place as Completed, and the Completed filter finds it"; `tests/unit/all-events.test.ts` › "SCRUM-262 [AC5] TC-262-05: finished events are completed before the list or an event is read", "SCRUM-262 [AC5] TC-262-05: someone who can't see All Events completes nothing"

### TC-262-06

| Item | Content |
|---|---|
| Test Case ID | TC-262-06 |
| Test Scenario | [Positive] AC 6: ADR 0019 says which pages complete events, and that actions refuse a finished event |
| Pre-conditions | — |
| Test Steps | 1. Read ADR 0019's 2026-11-01 addendum. |
| Test Data | — |
| Expected Result | It names All Events alongside the three pages, says each action that changes a Confirmed event calls `completeIfTakenPlace` after locking the event, and that a new such action must do the same. |

**Automated by:** Manual (a document check, in review).
