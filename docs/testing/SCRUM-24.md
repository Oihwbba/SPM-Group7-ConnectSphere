# SCRUM-24 — Keep event status consistent with actions taken: test cases

Story and acceptance criteria: [docs/backlog/SCRUM-24.md](../backlog/SCRUM-24.md).
Format and conventions: [README.md](README.md). An event's one status is
`Event.status` in [prisma/schema.prisma](../../prisma/schema.prisma). A
Coordinator's decision goes through `transitionEventStatus`, which writes only
if the status is still the one the user saw (ADR 0006).

Written on 2026-10-12 from the acceptance criteria, then mapped to the tests
that already existed (SCRUM-176). The tests predate the `SCRUM-n [ACx] TC-n-xx`
title format, so each case names them by their current titles.

- **AC 4 and AC 6:** each transition's own story tests it: SCRUM-14 submits,
  SCRUM-165 assigns (SCRUM-20 did, before it), SCRUM-19 decides, SCRUM-108 resubmits, SCRUM-81 confirms
  and SCRUM-117 rejects from Planning. TC-24-03 tests that the gate refuses a
  transition the lifecycle doesn't have.
- **AC 5 (Confirmed back to Planning):** an approved impactful change
  request does it (SCRUM-128's TC-128-11), and so does cancelling a flagged
  arrangement (SCRUM-135 AC8, SCRUM-26's TC-26-11), which the AC's wording
  predates. Those are the only writes that set Planning on a Confirmed
  event (the approval that sets Planning applies only to an Under Review
  request, TC-135-11). TC-24-06 shows deciding or confirming a Confirmed
  event again leaves it Confirmed.

**Shared pre-conditions for every case:** the database is migrated and seeded
and the app is running. A request by `organiser@test.local` is Under Review
with `coordinator@test.local` (both `Password123!`).

| ID | Type | Criterion | Automated |
|---|---|---|---|
| [TC-24-01](#tc-24-01) | Positive | AC 1, AC 2 | Unit |
| [TC-24-02](#tc-24-02) | Positive | AC 3 | Unit, e2e |
| [TC-24-03](#tc-24-03) | Negative | AC 4, AC 6 | Unit |
| [TC-24-04](#tc-24-04) | Concurrency | AC 7 | Unit, integration |
| [TC-24-05](#tc-24-05) | Positive | AC 7 | e2e |
| [TC-24-06](#tc-24-06) | Negative | AC 5 | Integration |

---

### TC-24-01

| Item | Content |
|---|---|
| Test Case ID | TC-24-01 |
| Test Scenario | [Positive] AC 1, AC 2: an event has one status, and it is one of the nine |
| Pre-conditions | None beyond the shared ones. |
| Test Steps | 1. Read the event's status. <br> 2. List the statuses an event can hold. |
| Test Data | The schema's `EventStatus` |
| Expected Result | One status field, holding one of Draft, Submitted, Under Review, Approved, Planning, Confirmed, Completed, Cancelled or Rejected. |

**Automated by:** `tests/unit/status-badge.test.ts` › "covers every one of the nine statuses"

### TC-24-02

| Item | Content |
|---|---|
| Test Case ID | TC-24-02 |
| Test Scenario | [Positive] AC 3: asking for clarification leaves the event Under Review |
| Pre-conditions | Signed in as the assigned Coordinator. |
| Test Steps | 1. Ask the Organiser a question about the request. <br> 2. Check the request's status. |
| Test Data | "What is the expected start time?" |
| Expected Result | The status is still Under Review; the question is a clarification on the event, not a status. |

**Automated by:** `tests/unit/clarification.test.ts` › "[Positive] AC: coordinator requests clarification, event status is untouched, organiser is notified"; `e2e/clarification.spec.ts` › "coordinator asks, organiser replies, coordinator sees the answer (AC: sub-state, notify, respond, re-review)"

### TC-24-03

| Item | Content |
|---|---|
| Test Case ID | TC-24-03 |
| Test Scenario | [Negative] AC 4, AC 6: the gate refuses a transition that isn't the lifecycle's |
| Pre-conditions | Signed in as a Coordinator. |
| Test Steps | 1. Send a change of a Submitted request to Under Review directly. <br> 2. Send an approval for a request that isn't Under Review. |
| Test Data | The requests' ids |
| Expected Result | Both are refused, for example "That status change is not allowed from the event's current status.", and the status is unchanged. |

**Automated by:** `tests/unit/event-status.test.ts` › "SCRUM-20: a coordinator cannot claim a request into review — that transition is automatic" (step 1) and "SCRUM-135 [AC11] TC-135-11: refuses to decide an event that is %s, naming its status" (step 2, with the message "This event is Submitted, so it can't be approved.").

### TC-24-04

| Item | Content |
|---|---|
| Test Case ID | TC-24-04 |
| Test Scenario | [Concurrency] AC 7: two decisions at the same moment leave one status |
| Pre-conditions | Two tabs as the assigned Coordinator on the same request. |
| Test Steps | 1. Click **Approve** in one tab and **Reject** in the other at the same moment. |
| Test Data | The Under Review request |
| Expected Result | One decision is saved. The other is refused with "This event was updated by another user. Refresh and try again." and writes no history entry. |

**Automated by:** `tests/unit/event-status.test.ts` › "SCRUM-24: the loser of two simultaneous decisions is told to refresh, and no audit entry is written"; `tests/integration/concurrency.test.ts` › "SCRUM-24: the loser of two simultaneous decisions is told to refresh, and no audit entry is written"

### TC-24-05

| Item | Content |
|---|---|
| Test Case ID | TC-24-05 |
| Test Scenario | [Positive] AC 7: everyone looking at the event sees the same status |
| Pre-conditions | The Organiser and the Coordinator each have the request open. |
| Test Steps | 1. The Coordinator approves it. <br> 2. Watch the Organiser's open page. <br> 3. With the request open in the details dialog, have the review queue drop it. |
| Test Data | The Under Review request |
| Expected Result | Both see Planning without reloading. A dialog left open on an event that has left the queue stays open, with a warning. |

**Automated by:** `e2e/events.spec.ts` › "coordinator views assigned event status and status remains consistent across views (SCRUM-23 & SCRUM-24)", "SCRUM-24 [AC7] TC-24-05: two users viewing the same event simultaneously see consistent live status without manual refresh", "open modal remains mounted with warning when viewed event is dropped from review queue (SCRUM-24)"

### TC-24-06

| Item | Content |
|---|---|
| Test Case ID | TC-24-06 |
| Test Scenario | [Negative] AC 5: a Confirmed event goes back to Planning only through an approved impactful change request |
| Pre-conditions | A Confirmed event. |
| Test Steps | 1. Try to move it to Planning by any action other than approving an impactful change request. |
| Test Data | The Confirmed event |
| Expected Result | Refused; it stays Confirmed. |

**Automated by:** `tests/integration/status-consistency.test.ts` › "SCRUM-24 [AC5] TC-24-06: deciding a Confirmed event again is refused and confirming it again changes nothing; it stays Confirmed". The two ways back to Planning: `tests/integration/change-decision.test.ts` › "SCRUM-128 [AC2, AC4, AC5] TC-128-11: …" and SCRUM-26's TC-26-11.
