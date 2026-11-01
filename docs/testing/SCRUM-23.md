# SCRUM-23 — View an event's current status: test cases

Story and acceptance criteria: [docs/backlog/SCRUM-23.md](../backlog/SCRUM-23.md).
Format and conventions: [README.md](README.md). Each status is drawn by
[components/events/status-badge.tsx](../../components/events/status-badge.tsx).

Written on 2026-10-12 from the acceptance criteria, then mapped to the tests
that already existed (SCRUM-176). The tests predate the `SCRUM-n [ACx] TC-n-xx`
title format, so each case names them by their current titles.

**Shared pre-conditions for every case:** the database is migrated and seeded
and the app is running. Signed in as `organiser@test.local` (`Password123!`),
unless the case says otherwise.

| ID | Type | Criterion | Automated |
|---|---|---|---|
| [TC-23-01](#tc-23-01) | Positive | AC 1 | Unit |
| [TC-23-02](#tc-23-02) | Positive | AC 2 | Unit, e2e |

---

### TC-23-01

| Item | Content |
|---|---|
| Test Case ID | TC-23-01 |
| Test Scenario | [Positive] AC 1: every one of the nine statuses has a badge that names it |
| Pre-conditions | None beyond the shared ones. |
| Test Steps | 1. Look at the badge for each status. |
| Test Data | Draft, Submitted, Under Review, Approved, Planning, Confirmed, Completed, Cancelled, Rejected |
| Expected Result | Each of the nine has its own badge, labelled in words. |

**Automated by:** `tests/unit/status-badge.test.ts` › "SCRUM-16 [AC2, AC5] TC-16-02, SCRUM-23 [AC1] TC-23-01, SCRUM-24 [AC1, AC2] TC-24-01: covers every one of the nine statuses", "SCRUM-16 [AC2, AC5] TC-16-02, SCRUM-23 [AC1] TC-23-01: labels each status in words a user reads, not the enum value"

### TC-23-02

| Item | Content |
|---|---|
| Test Case ID | TC-23-02 |
| Test Scenario | [Positive] AC 2: the Organiser and the Coordinator see the status on the event itself |
| Pre-conditions | A request Under Review with `coordinator@test.local`. |
| Test Steps | 1. As the Organiser, open **My Events** and the request. <br> 2. As the Coordinator, open **Events** and the request. |
| Test Data | The Under Review request |
| Expected Result | Both see "Under Review" on the list and on the details, without asking anyone. |

**Automated by:** `tests/unit/events.test.ts` › "SCRUM-84 [AC3] TC-84-03, SCRUM-23 [AC2] TC-23-02: [Happy Path] exposes event name and current status badge properties for list display"; `e2e/events.spec.ts` › "SCRUM-23 [AC2] TC-23-02, SCRUM-24 [AC7] TC-24-05: coordinator views assigned event status and status remains consistent across views"
