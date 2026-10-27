# SCRUM-20 — Auto-assign a coordinator to a submitted event: test cases

> **Superseded by SCRUM-165 (Week 7 change 5).** Requests are no longer assigned automatically; they wait in the Lead's Unassigned queue. The automatic-assignment tests were removed and replaced by SCRUM-165's (see [SCRUM-165.md](SCRUM-165.md)); the least-loaded rule now only suggests a Coordinator (TC-165-05). TC-20-01 to TC-20-04 are superseded and keep their IDs, each citing the SCRUM-165 tests that now cover it; TC-20-05 still holds.

Story and acceptance criteria: [docs/backlog/SCRUM-20.md](../backlog/SCRUM-20.md).
Format and conventions: [README.md](README.md). A Coordinator was picked by
`pickCoordinator` inside `submitEventRequest`. Since SCRUM-165,
[lib/coordinator-assignment.ts](../../lib/coordinator-assignment.ts) only
counts each Coordinator's active events and suggests the least-loaded one to
the Lead.

Written on 2026-10-12 from the acceptance criteria, then mapped to the tests
that already existed (SCRUM-176). The tests predate the `SCRUM-n [ACx] TC-n-xx`
title format, so each case names them by their current titles.

**Since written:** SCRUM-165 replaced automatic assignment with the Lead's
unassigned queue (Week 7 change 5), so TC-20-01 to TC-20-04 were superseded on
20 Oct 2026. AC 7's notification is now SCRUM-45 (AC 1); SCRUM-46 no longer
exists.

**Shared pre-conditions for every case:** the database is migrated and seeded
and the app is running. Signed in as `organiser@test.local` (`Password123!`).
The seed has two active Coordinators.

| ID | Type | Criterion | Automated |
|---|---|---|---|
| [TC-20-01](#tc-20-01) | Superseded | AC 1, AC 2, AC 3, AC 7, AC 8 | — (SCRUM-165: TC-165-01, TC-165-07) |
| [TC-20-02](#tc-20-02) | Superseded | AC 4, AC 5 | — (SCRUM-165: TC-165-05) |
| [TC-20-03](#tc-20-03) | Superseded | AC 6 | — (SCRUM-165: TC-165-08) |
| [TC-20-04](#tc-20-04) | Superseded | AC 9 | — (SCRUM-165: TC-165-01) |
| [TC-20-05](#tc-20-05) | Negative | AC 1 | Unit |

---

### TC-20-01

**Superseded** on 20 Oct 2026 by SCRUM-165 AC 1 and AC 5 ([TC-165-01](SCRUM-165.md#tc-165-01), [TC-165-07](SCRUM-165.md#tc-165-07)). A submitted request was assigned one Coordinator, moved Under Review, and both people were told. It now stays Submitted with no Coordinator until the Lead assigns one; that assignment moves it Under Review in one write, is recorded with the Lead, and tells the Coordinator and the Organiser. `tests/unit/event-auto-assignment.test.ts` and `e2e/coordinator-assignment.spec.ts` were removed.

**Automated by** (SCRUM-165's tests): `tests/unit/submission-queue.test.ts` › "SCRUM-165 [AC1] TC-165-01: [Positive] a new request stays Submitted with no Coordinator"; `tests/unit/lead-queue.test.ts` › "SCRUM-165 [AC5, AC11] TC-165-07, TC-165-14: [Positive] the event gets the Coordinator, moves to Under Review and records the supervising Lead in one write", "SCRUM-165 [AC5] TC-165-07: [Positive] the Coordinator and the Organiser are notified" and "SCRUM-165 [AC5] TC-165-07: [Positive] the assignment is recorded with the Lead who made it"; `e2e/lead-queue.spec.ts` › "SCRUM-14 [AC1] TC-14-01, SCRUM-20 [AC1, AC2, AC3, AC7, AC8] TC-20-01, SCRUM-135 [AC2, AC6] TC-135-02, SCRUM-164 [AC2] TC-164-05, SCRUM-165 [AC1, AC2, AC3, AC4, AC5, AC8, AC11] TC-165-01, TC-165-02, TC-165-04, TC-165-05, TC-165-07, TC-165-11, TC-165-14: a submitted request waits in the queue, the Lead assigns it, and only then does the Coordinator get it"

### TC-20-02

**Superseded** on 20 Oct 2026 by SCRUM-165 AC 4 ([TC-165-05](SCRUM-165.md#tc-165-05)). The Coordinator with the fewest active events was assigned the request. The same load count now only suggests a Coordinator to the Lead, who chooses; Completed, Cancelled and Rejected events still don't count.

**Automated by** (SCRUM-165's tests): `tests/unit/coordinator-assignment.test.ts` › "SCRUM-165 [AC4] TC-165-05: [Positive] suggests the least-loaded Coordinator", "SCRUM-165 [AC4] TC-165-05: [Positive] only people who hold the Coordinator role now, and only active events count as load" and "SCRUM-165 [AC4] TC-165-05: [Boundary] on a tie, suggests the first listed (the earliest created)"

### TC-20-03

**Superseded** on 20 Oct 2026 by SCRUM-165 AC 6 ([TC-165-08](SCRUM-165.md#tc-165-08)). Two submissions at the same moment no longer assign anyone, so they can't race for a Coordinator. The race that remains is two Leads assigning the same request at once: exactly one assignment is saved.

**Automated by** (SCRUM-165's tests): `tests/integration/concurrency.test.ts` › "SCRUM-165 [AC6] TC-165-08: [Concurrency] two Leads assign the same request at the same moment: exactly one assignment is saved and the other Lead is told who it went to"; `tests/unit/lead-queue.test.ts` › "SCRUM-165 [AC6, AC7] TC-165-08, TC-165-10: [Negative] a request someone else assigned first is refused, naming who it went to, and nothing else is written"

### TC-20-04

**Superseded** on 20 Oct 2026 by SCRUM-165 AC 1 ([TC-165-01](SCRUM-165.md#tc-165-01)). With no Coordinator account, the request stayed Submitted. Every submitted request now stays Submitted with no Coordinator, whether or not any Coordinator exists, and with none the Lead is offered no suggestion.

**Automated by** (SCRUM-165's tests): `tests/unit/submission-queue.test.ts` › "SCRUM-165 [AC1] TC-165-01: [Positive] a new request stays Submitted with no Coordinator" and "SCRUM-165 [AC1] TC-165-01: [Positive] nobody is recorded as assigned until the Lead chooses"; `tests/unit/coordinator-assignment.test.ts` › "SCRUM-165 [AC4] TC-165-05: [Boundary] suggests nobody when there are no Coordinators"

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
