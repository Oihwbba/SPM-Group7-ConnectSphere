# SCRUM-68 — View only the events I own: test cases

Story and acceptance criteria: [docs/backlog/SCRUM-68.md](../backlog/SCRUM-68.md).
Format and conventions: [README.md](README.md). Ownership is the relationship
check in `can()` ([lib/auth/can.ts](../../lib/auth/can.ts)); the Organiser's
list queries only their own events.

Written on 2026-10-12 from the acceptance criteria, then mapped to the tests
that already existed (SCRUM-176). The tests predate the `SCRUM-n [ACx] TC-n-xx`
title format, so each case names them by their current titles.

**AC 5** is a scope statement: the individual Organiser account is the
boundary, so there is nothing to share across an organisation. TC-68-01 and
TC-68-02 test that boundary.

**Shared pre-conditions for every case:** the database is migrated and seeded
and the app is running. `organiser@test.local` and `organiser2@test.local`
each have events (`Password123!`).

| ID | Type | Criterion | Automated |
|---|---|---|---|
| [TC-68-01](#tc-68-01) | Positive | AC 1, AC 5 | Unit, e2e |
| [TC-68-02](#tc-68-02) | Negative | AC 2, AC 3, AC 5 | Unit, e2e |
| [TC-68-03](#tc-68-03) | Negative | AC 4 | Unit |

---

### TC-68-01

| Item | Content |
|---|---|
| Test Case ID | TC-68-01 |
| Test Scenario | [Positive] AC 1, AC 5: an Organiser's list holds only the events they submitted |
| Pre-conditions | Signed in as `organiser2@test.local`. |
| Test Steps | 1. Open **My Events**. |
| Test Data | organiser2's "Another Client's Event — Product Launch"; organiser@test.local's "Draft — Annual Tech Summit" |
| Expected Result | organiser2's own event is listed, newest-updated first. Nothing of the other Organiser's appears anywhere on the page. |

**Automated by:** `tests/unit/organiser-attendee-events-access.test.ts` › "SCRUM-68 [AC1, AC5] TC-68-01: [Positive] queries only events owned by this organiser, newest-updated first"; `tests/unit/events.test.ts` › "SCRUM-84 [AC1, AC2] TC-84-01, TC-84-02, SCRUM-68 [AC1, AC5] TC-68-01: [Happy Path / Ownership Isolation] executes organiser query filtering only events belonging to logged-in organiser"; `e2e/events.spec.ts` › "SCRUM-68 [AC1, AC5] TC-68-01, SCRUM-84 [AC1] TC-84-01: enforces ownership isolation: organiser2 sees only their own events"

### TC-68-02

| Item | Content |
|---|---|
| Test Case ID | TC-68-02 |
| Test Scenario | [Negative] AC 2, AC 3, AC 5: another Organiser's event can't be opened, and the refusal looks like a missing event |
| Pre-conditions | Signed in as `organiser2@test.local`, with the id of an event of `organiser@test.local`. |
| Test Steps | 1. Read that event, and its clarification, directly. <br> 2. Do the same with an id that doesn't exist. <br> 3. Open an event's own address. |
| Test Data | The other Organiser's event id; a made-up id |
| Expected Result | Steps 1 and 2 get the same "not found" answer, revealing nothing. Step 3 returns "not found", since no event has its own page. |

**Automated by:** `tests/unit/auth.test.ts` › "SCRUM-67 [AC1] TC-67-02, SCRUM-68 [AC2, AC3, AC4, AC5] TC-68-02, TC-68-03: does not let a different organiser read someone else's event"; `tests/unit/clarification.test.ts` › "SCRUM-18 TC-18-10, SCRUM-68 [AC2, AC3, AC5] TC-68-02: [Negative] another organiser's clarification is indistinguishable from a missing one"; `e2e/access-control.spec.ts` › "SCRUM-208 [AC5] TC-208-13: another organiser's event and a made-up id are the same 404"; `e2e/event-page.spec.ts` › "SCRUM-208 [AC5] TC-208-13: another Coordinator's event is the same 404 as one that doesn't exist"

### TC-68-03

| Item | Content |
|---|---|
| Test Case ID | TC-68-03 |
| Test Scenario | [Negative] AC 4: a draft is seen only by the Organiser who made it |
| Pre-conditions | `organiser@test.local` has a draft. |
| Test Steps | 1. As a Coordinator, open **Events** and read the draft directly. <br> 2. As `organiser2@test.local`, read it. |
| Test Data | The draft's id |
| Expected Result | The draft isn't on the Coordinator's list, and both reads are refused. |

**Automated by:** `tests/unit/auth.test.ts` › "SCRUM-68 [AC4] TC-68-03: hides an unassigned draft from coordinators", "SCRUM-67 [AC1] TC-67-02, SCRUM-68 [AC2, AC3, AC4, AC5] TC-68-02, TC-68-03: does not let a different organiser read someone else's event"; `tests/unit/coordinator-assigned-events.test.ts` › "SCRUM-15 [AC1, AC8] TC-15-11, SCRUM-16 [AC4] TC-16-03, SCRUM-68 [AC4] TC-68-03, SCRUM-69 [AC1] TC-69-02: [Negative] an unassigned draft is not in any Coordinator's list"
