# SCRUM-135 — Refuse any event status change the lifecycle does not allow: test cases

Story and acceptance criteria: [docs/backlog/SCRUM-135.md](../backlog/SCRUM-135.md).
Format and conventions: [README.md](README.md). Why it works this way:
[ADR 0006, 2026-10-14 addendum](../adr/0006-single-event-status-transition-gate.md).

**Shared pre-conditions for every case:** the database is migrated and seeded
and the app is running. Events are organised by `organiser@test.local`; an
assigned event's Coordinator is `coordinator@test.local`. Every account's
password is `Password123!`.

The lifecycle is one table, `lib/event-lifecycle.ts`. Each transition's own
story proves the action that makes it; this story proves the table and that
every action asks it.

| ID | Type | Criterion | Automated |
|---|---|---|---|
| [TC-135-01](#tc-135-01) | Positive | AC 1, AC 2, AC 3, AC 4, AC 5, AC 7, AC 8, AC 9, AC 10 | Unit |
| [TC-135-02](#tc-135-02) | Positive | AC 2, AC 6 | Unit, e2e |
| [TC-135-03](#tc-135-03) | Negative | AC 3, AC 4, AC 11 | Unit, e2e |
| [TC-135-04](#tc-135-04) | Negative | AC 4 | Unit, e2e |
| [TC-135-06](#tc-135-06) | Positive, Negative | AC 6, AC 13 | Unit |
| [TC-135-09](#tc-135-09) | Positive | AC 9 | Unit |
| [TC-135-11](#tc-135-11) | Negative | AC 11 | Unit |
| [TC-135-12](#tc-135-12) | Negative | AC 12 | Unit |
| [TC-135-13](#tc-135-13) | Negative | AC 13 | Unit |
| [TC-135-14](#tc-135-14) | Concurrency | AC 14 | Unit, integration |
| [TC-135-15](#tc-135-15) | Positive | AC 15, AC 16 | Unit |
| [TC-135-16](#tc-135-16) | Positive | AC 16 | Unit, integration |

### TC-135-01

| Item | Content |
|---|---|
| Test Case ID | TC-135-01 |
| Test Scenario | [Positive] AC 1–AC 10: every transition in the story is allowed |
| Pre-conditions | — |
| Test Steps | Ask the lifecycle about each pair. |
| Test Data | Draft → Submitted; Submitted → Under Review; Under Review → Planning, Rejected or Cancelled; Planning → Confirmed, Rejected or Cancelled; Confirmed → Planning, Cancelled or Completed. |
| Expected Result | Each is allowed. |

**Automated by:** `tests/unit/event-lifecycle.test.ts` › "SCRUM-135 TC-135-01: …" (11 tests). The actions themselves: SCRUM-14, SCRUM-20, SCRUM-81 (TC-81-01, TC-81-05), SCRUM-117, SCRUM-128, SCRUM-26 and SCRUM-82 (TC-82-01, TC-82-09).

### TC-135-02

| Item | Content |
|---|---|
| Test Case ID | TC-135-02 |
| Test Scenario | [Positive] AC 2, AC 6: the Lead's assignment and a resubmission make the moves the lifecycle allows, Submitted → Under Review |
| Pre-conditions | A Submitted request with no Coordinator; a Rejected request marked Amend and resubmit, once with its Coordinator still in the role and once without. |
| Test Steps | 1. As the Lead, assign a Coordinator from the Unassigned queue (SCRUM-165). <br> 2. As the Organiser, resubmit each rejected request. |
| Test Data | — |
| Expected Result | 1. Under Review with that Coordinator. 2. Back Under Review with the same Coordinator; or, if they no longer hold the role, Submitted with no Coordinator in the Lead's queue. |

**Automated by:** these moves are SCRUM-165's actions, so its tests are this case's: `tests/unit/lead-queue.test.ts` › "SCRUM-165 [AC5, AC11] TC-165-07, TC-165-14: …"; `e2e/lead-queue.spec.ts` › "SCRUM-165 [AC1–AC5, AC8, AC11] …"; `tests/unit/clarification-and-amend.test.ts` › "SCRUM-108 [AC9, AC11, AC14] TC-108-05, SCRUM-165 [AC9] TC-165-12: …" and "SCRUM-165 [AC9] TC-165-12 (supersedes SCRUM-108 AC11): …". The lifecycle table allowing Submitted → Under Review is TC-135-01.

### TC-135-03

| Item | Content |
|---|---|
| Test Case ID | TC-135-03 |
| Test Scenario | [Negative] AC 3, AC 4, AC 11: a Submitted request can't be approved or rejected, not even by a Coordinator assigned to it |
| Pre-conditions | "Submitted — Alumni Homecoming" (seeded) has no Coordinator; a second Submitted request is assigned to `coordinator@test.local`. |
| Test Steps | 1. As the Coordinator, open **Events**. <br> 2. Approve or reject each directly. |
| Test Data | — |
| Expected Result | 1. The unassigned request isn't in the list at all: it waits in the Lead's queue (SCRUM-165 AC8). 2. The unassigned one: "Event not found." The assigned one: "This event is Submitted, so it can't be approved." (or "rejected."). Nothing changes and no Coordinator is assigned. |

**Automated by:** `tests/unit/event-lifecycle.test.ts` › "SCRUM-135 [AC3, AC4] TC-135-03: …"; `tests/unit/event-status.test.ts` › "SCRUM-135 [AC3, AC4, AC11] TC-135-03: a Submitted request can't be %s, even by its assigned Coordinator, …" (2 tests) and "SCRUM-165 [AC8] TC-165-11: …"; `e2e/coordinator-assigned-events.spec.ts` › "SCRUM-165 [AC8] TC-165-11 (supersedes AC4): …" and "SCRUM-135 AC3, AC4: my Under Review event can be approved, and moves to Planning"; `e2e/events.spec.ts` (SCRUM-23 & SCRUM-24 journey)

### TC-135-04

| Item | Content |
|---|---|
| Test Case ID | TC-135-04 |
| Test Scenario | [Negative] AC 4: rejecting doesn't make a Coordinator assign themselves |
| Pre-conditions | A Submitted request with no Coordinator. |
| Test Steps | Reject it directly, with a reason and an outcome. |
| Test Data | Reason "Too large for any venue."; Amend and resubmit. |
| Expected Result | Refused: since SCRUM-165 AC8 the request is "not found" for a Coordinator nobody assigned. No status change, no assignment, no history entry. |

**Automated by:** `tests/unit/clarification-and-amend.test.ts` › "SCRUM-165 [AC8] TC-165-11 (supersedes SCRUM-108 AC11): a Coordinator can't reject a request nobody was assigned to; it waits for the Lead"

### TC-135-06

| Item | Content |
|---|---|
| Test Case ID | TC-135-06 |
| Test Scenario | [Positive, Negative] AC 6, AC 13: only a request rejected for amendment is resubmitted |
| Pre-conditions | Two Rejected requests: one Amend and resubmit, one Submit as a new request. |
| Test Steps | Resubmit each. |
| Test Data | — |
| Expected Result | The first goes back to Submitted, then Under Review with the same Coordinator (TC-108-05). The second: "This event is Rejected, so it can't be submitted." |

**Automated by:** `tests/unit/event-lifecycle.test.ts` › "SCRUM-135 [AC6, AC13] TC-135-06: …"; `tests/unit/events.test.ts` › "SCRUM-135 [AC11, AC13] TC-135-11: …"; `tests/unit/clarification-and-amend.test.ts` › "SCRUM-108 [AC9, AC11, AC14] TC-108-05, …"

### TC-135-09

| Item | Content |
|---|---|
| Test Case ID | TC-135-09 |
| Test Scenario | [Positive] AC 9: what can be cancelled |
| Pre-conditions | — |
| Test Steps | Read the statuses an event can be cancelled from. |
| Test Data | — |
| Expected Result | Under Review, Planning and Confirmed (and a row left Approved from before approval moved straight to Planning, so it isn't stuck holding its arrangements; nothing moves it on to Planning). The **Cancel event** button uses the same list. |

**Automated by:** `tests/unit/event-lifecycle.test.ts` › "SCRUM-135 [AC9] TC-135-09: …"; `tests/unit/cancel-event.test.ts` › "SCRUM-82 [AC1] TC-82-01: …" and "SCRUM-82 [AC1, AC3] TC-82-01, SCRUM-135 [AC9, AC12] TC-135-09: a legacy Approved event can be cancelled, and its arrangements are released"

### TC-135-11

| Item | Content |
|---|---|
| Test Case ID | TC-135-11 |
| Test Scenario | [Negative] AC 11: any other transition is refused, naming the current status |
| Pre-conditions | One event in each status. |
| Test Steps | Through each action (submit, approve, reject, reject from Planning, confirm, cancel), ask for a transition the table doesn't have. |
| Test Data | E.g. confirm an Under Review event; cancel a Draft; submit a Planning event. |
| Expected Result | "This event is Under Review, so it can't be confirmed." and so on. The status doesn't change and nothing is written. |

**Automated by:** `tests/unit/event-lifecycle.test.ts` › "SCRUM-135 [AC11] TC-135-11: …" (10 tests); `tests/unit/event-status.test.ts`, `tests/unit/event-confirm.test.ts` (TC-81-11), `tests/unit/reject-planning.test.ts` (TC-117-04), `tests/unit/cancel-event.test.ts` (TC-82-02) and `tests/unit/events.test.ts` › "SCRUM-135 [AC11, AC13] TC-135-11: …"

### TC-135-12

| Item | Content |
|---|---|
| Test Case ID | TC-135-12 |
| Test Scenario | [Negative] AC 12: Approved is never a resting status |
| Pre-conditions | An event Under Review. |
| Test Steps | Approve it. |
| Test Data | — |
| Expected Result | It is Planning, with history entries for the approval and the move. No transition leads into Approved. |

**Automated by:** `tests/unit/event-lifecycle.test.ts` › "SCRUM-135 [AC12] TC-135-12: …"; `tests/unit/event-status.test.ts` › "SCRUM-81 [AC1] TC-81-01: approving an assigned request moves it to Planning, recording who approved it and when"

### TC-135-13

| Item | Content |
|---|---|
| Test Case ID | TC-135-13 |
| Test Scenario | [Negative] AC 13: Completed and Cancelled are final |
| Pre-conditions | A Completed and a Cancelled event. |
| Test Steps | Try every transition from each. |
| Test Data | — |
| Expected Result | All refused. |

**Automated by:** `tests/unit/event-lifecycle.test.ts` › "SCRUM-135 [AC13] TC-135-13: …"; `tests/unit/cancel-event.test.ts` (TC-82-02, TC-82-05)

### TC-135-14

| Item | Content |
|---|---|
| Test Case ID | TC-135-14 |
| Test Scenario | [Concurrency] AC 14: a repeated transition is recorded once |
| Pre-conditions | An event Under Review; a ready Planning event; a Planning event. |
| Test Steps | Send each decision twice at the same moment: approve and reject; confirm twice; cancel twice. |
| Test Data | — |
| Expected Result | One wins; the other changes nothing. One history entry and one set of notifications. |

**Automated by:** `tests/integration/concurrency.test.ts` › "SCRUM-24: the loser of two simultaneous decisions …" and the SCRUM-81 confirm race; `tests/unit/event-confirm.test.ts` (TC-81-09); `tests/unit/cancel-event.test.ts` (TC-82-05); `tests/integration/close-event.test.ts` (TC-82-07, TC-82-10)

### TC-135-15

| Item | Content |
|---|---|
| Test Case ID | TC-135-15 |
| Test Scenario | [Positive] AC 15, AC 16: clarification and the safety check are steps, not statuses |
| Pre-conditions | — |
| Test Steps | Read the statuses. Ask a clarifying question on an event Under Review; request a safety check on a Planning event. |
| Test Data | — |
| Expected Result | Exactly Draft, Submitted, Under Review, Approved, Planning, Confirmed, Completed, Cancelled and Rejected. The event stays Under Review, and in Planning. |

**Automated by:** `tests/unit/event-lifecycle.test.ts` › "SCRUM-135 [AC15, AC16] TC-135-15: …"; SCRUM-18's clarification tests and SCRUM-166's safety-check tests leave the status unchanged.

### TC-135-16

| Item | Content |
|---|---|
| Test Case ID | TC-135-16 |
| Test Scenario | [Positive] AC 16: reassigning an event changes its Coordinator, never its status |
| Pre-conditions | An event Under Review, in Planning or Confirmed, with a Coordinator. Signed in as the Lead. |
| Test Steps | Reassign it to another Coordinator (SCRUM-21). |
| Test Data | — |
| Expected Result | The new Coordinator and the supervising Lead are saved; the status is what it was, and no status history entry is written. |

**Automated by:** `tests/unit/reassign.test.ts` › "SCRUM-135 [AC16] TC-135-16: reassigning a %s event changes its Coordinator, never its status" (3 tests, one per status SCRUM-21 can reassign from); `tests/integration/reassign.test.ts` › "SCRUM-21 [AC2, AC9] TC-21-02: …", where the event is still Planning after the reassignment