# SCRUM-17 — Review a submitted event request: test cases

Story and acceptance criteria: [docs/backlog/SCRUM-17.md](../backlog/SCRUM-17.md).
Format and conventions: [README.md](README.md). The Coordinator's list and
details are in [app/(app)/events/](<../../app/(app)/events/>); who may read an
event is `can(user, "event:read", event)` in
[lib/auth/can.ts](../../lib/auth/can.ts).

Written on 2026-10-12 from the acceptance criteria, then mapped to the tests
that already existed (SCRUM-176). The tests predate the `SCRUM-n [ACx] TC-n-xx`
title format, so each case names them by their current titles.

**Shared pre-conditions for every case:** the database is migrated and seeded
and the app is running. A request submitted by `organiser@test.local` is
assigned to `coordinator@test.local` (both `Password123!`).

| ID | Type | Criterion | Automated |
|---|---|---|---|
| [TC-17-01](#tc-17-01) | Positive | AC 1 | e2e |
| [TC-17-02](#tc-17-02) | Positive | AC 2 | Unit |
| [TC-17-03](#tc-17-03) | Negative | AC 2 | Unit |

---

### TC-17-01

| Item | Content |
|---|---|
| Test Case ID | TC-17-01 |
| Test Scenario | [Positive] AC 1: the assigned Coordinator sees every field the Organiser submitted |
| Pre-conditions | Signed in as the assigned Coordinator. |
| Test Steps | 1. Open **Events**. <br> 2. Open the request's details. |
| Test Data | A request with purpose "Showcase the department's annual research output.", 120 attendees, 1 Aug 2031 10:00 am to 6:00 pm SGT |
| Expected Result | The details show the name, purpose, both times ("1 Aug 2031, 10:00 am SGT" and "1 Aug 2031, 6:00 pm SGT"), "120 attendees", and the venue, accessibility, equipment and registration needs as entered. |

**Automated by:** `e2e/events.spec.ts` › "SCRUM-17 [AC1] TC-17-01: every field the organiser submitted is visible to the assigned coordinator"

### TC-17-02

| Item | Content |
|---|---|
| Test Case ID | TC-17-02 |
| Test Scenario | [Positive] AC 2: a Coordinator can open the requests assigned to them |
| Pre-conditions | Signed in as a Coordinator. |
| Test Steps | 1. Open **Events**. <br> 2. Open an assigned request, then an unassigned submitted one directly. |
| Test Data | The seeded events |
| Expected Result | The assigned request opens; the unassigned one is refused as if it didn't exist. The list holds exactly the events assigned to this Coordinator. |

**Superseded in part** on 20 Oct 2026 by SCRUM-165 AC 8 ([TC-165-11](SCRUM-165.md#tc-165-11)): a Coordinator could also open a submitted request nobody had picked up; it now waits in the Lead's queue.

**Automated by:** `tests/unit/coordinator-events-access.test.ts` › "SCRUM-17 [AC2] TC-17-02, SCRUM-165 [AC8] TC-165-11: [Positive] queries only the events assigned to this coordinator" and "SCRUM-17 [AC2] TC-17-02, SCRUM-165 [AC8] TC-165-11: [Negative] an unclaimed Submitted event is not viewable by a coordinator; it waits in the Lead's queue"

### TC-17-03

| Item | Content |
|---|---|
| Test Case ID | TC-17-03 |
| Test Scenario | [Negative] AC 2: no one else can open a request's details |
| Pre-conditions | A request assigned to `coordinator@test.local`. |
| Test Steps | 1. As the other seeded Coordinator, open the request's details directly. <br> 2. As a Coordinator, open an unassigned Draft. <br> 3. As `organiser2@test.local`, open the request. |
| Test Data | The request's id |
| Expected Result | Each is refused as if the request didn't exist, so it reveals nothing. |

**Automated by:** `tests/unit/coordinator-events-access.test.ts` › "SCRUM-17 [AC2] TC-17-03: [Negative] the query's OR condition matches can()'s relationship rule (SCRUM-68) exactly for an event assigned to a DIFFERENT coordinator", "SCRUM-17 [AC2] TC-17-03: [Boundary] as in SCRUM-68, an unclaimed DRAFT is NOT viewable — the query explicitly excludes DRAFT from the null-coordinator branch"; `tests/unit/event-status.test.ts` › "SCRUM-17 [AC2] TC-17-03, SCRUM-67 [AC4] TC-67-05: another coordinator's event is indistinguishable from a missing one". Step 3 is SCRUM-68's (see its spec).
