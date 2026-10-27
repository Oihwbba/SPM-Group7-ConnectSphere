# SCRUM-129 — Every event in Singapore time: test cases

Story and acceptance criteria: [docs/backlog/SCRUM-129.md](../backlog/SCRUM-129.md).
Format and conventions: [README.md](README.md). Times are converted and
labelled in [lib/datetime.ts](../../lib/datetime.ts); the one period rule is in
[lib/period.ts](../../lib/period.ts). The database refuses an event in any
other timezone.

Written on 2026-10-12 from the acceptance criteria, then mapped to the tests
that already existed (SCRUM-176). The tests predate the `SCRUM-n [ACx] TC-n-xx`
title format, so each case names them by their current titles.

**Shared pre-conditions for every case:** the database is migrated and seeded
and the app is running. Signed in as `organiser@test.local` (`Password123!`),
unless the case says otherwise.

| ID | Type | Criterion | Automated |
|---|---|---|---|
| [TC-129-01](#tc-129-01) | Positive | AC 1 | Unit, integration, e2e |
| [TC-129-02](#tc-129-02) | Negative | AC 1 | Integration |
| [TC-129-03](#tc-129-03) | Positive | AC 2 | Unit, integration |
| [TC-129-04](#tc-129-04) | Positive | AC 3, AC 4 | Unit, e2e |
| [TC-129-05](#tc-129-05) | Boundary | AC 1, AC 4 | Unit |
| [TC-129-06](#tc-129-06) | Boundary | AC 5 | Unit |

---

### TC-129-01

| Item | Content |
|---|---|
| Test Case ID | TC-129-01 |
| Test Scenario | [Positive] AC 1: a new request is a Singapore-time event, and the form has no timezone field |
| Pre-conditions | Signed in as the Organiser. |
| Test Steps | 1. Click **Create Event Request** and go to the date step. <br> 2. Save a draft, then submit a request. |
| Test Data | Any future times |
| Expected Result | The form has no timezone field and says its times are SGT. Both the draft and the submitted request are stored with the timezone Asia/Singapore. |

**Automated by:** `tests/unit/datetime.test.ts` › "SCRUM-129 [AC1 - Singapore timezone]: the event timezone is Asia/Singapore (UTC+8)"; `tests/unit/events.test.ts` › "SCRUM-129 [AC1 - Singapore timezone]: a new draft and an updated draft are stored as Asia/Singapore events", "SCRUM-129 [AC1 - Singapore timezone]: a new submission and a submitted draft are stored as Asia/Singapore events"; `tests/integration/event-timezone.test.ts` › "SCRUM-129 [AC1 - Singapore timezone]: a new event with no timezone given is stored as Asia/Singapore"; `e2e/events.spec.ts` › "SCRUM-13 [AC6] TC-13-07, SCRUM-129 [AC1] TC-129-01: the request form has no timezone selector and states its times are SGT"

### TC-129-02

| Item | Content |
|---|---|
| Test Case ID | TC-129-02 |
| Test Scenario | [Negative] AC 1: the database refuses an event in another timezone, or with none |
| Pre-conditions | Direct access to the database. |
| Test Steps | 1. Insert an event with the timezone "UTC". <br> 2. Insert an event with no timezone. |
| Test Data | As above |
| Expected Result | Both inserts are refused, and no event is saved. |

**Automated by:** `tests/integration/event-timezone.test.ts` › "SCRUM-129 [AC1 - Singapore timezone]: the database refuses an event stored with any other timezone", "SCRUM-129 [AC1 - Singapore timezone]: the database refuses an event with no timezone"

### TC-129-03

| Item | Content |
|---|---|
| Test Case ID | TC-129-03 |
| Test Scenario | [Positive] AC 2: an event saved before SCRUM-129 under another timezone keeps its instants, and is shown in Singapore time |
| Pre-conditions | An event stored with another timezone before the SCRUM-129 migration. |
| Test Steps | 1. Run the migrations. <br> 2. Open the event. |
| Test Data | An event entered as 09:00 New York time (EDT), stored as 13:00 UTC |
| Expected Result | The event is now Asia/Singapore, and its stored instants are unchanged. It is shown at the same moment in Singapore time: 9:00 pm SGT. |

**Automated by:** `tests/unit/datetime.test.ts` › "SCRUM-129 [AC2 - Existing events]: an instant stored under another timezone is shown in Singapore time, unchanged"; `tests/integration/event-timezone.test.ts` › "SCRUM-129 [AC2 - Existing events]: the migration relabels an event saved under another timezone and keeps its stored instants"

### TC-129-04

| Item | Content |
|---|---|
| Test Case ID | TC-129-04 |
| Test Scenario | [Positive] AC 3, AC 4: every time shown is labelled SGT, and is the stored UTC instant |
| Pre-conditions | Signed in as the Organiser, with a request whose start is stored as 02:00 UTC. |
| Test Steps | 1. Open **My Events**. <br> 2. Open the request's details. |
| Test Data | A start stored as 02:00 UTC |
| Expected Result | The list and details show 10:00 am SGT. A date shown without a time carries no label. |

**Automated by:** `tests/unit/datetime.test.ts` › "SCRUM-129 [AC3 - SGT label]: every displayed time is labelled SGT", "SCRUM-129 [AC3 - SGT label]: date-only formats carry no time, so no label", "SCRUM-129 [AC4 - UTC storage]: a Singapore wall time round-trips through the UTC instant it is stored as"; `tests/unit/events.test.ts` › "SCRUM-129 [AC4 - UTC storage]: the submitted UTC instants are stored exactly as sent"; `e2e/events.spec.ts` › "SCRUM-129 [AC3, AC4] TC-129-04: the list and details show the stored UTC instants in SGT"

### TC-129-05

| Item | Content |
|---|---|
| Test Case ID | TC-129-05 |
| Test Scenario | [Boundary] AC 1, AC 4: an early-morning Singapore time is stored on the previous UTC day |
| Pre-conditions | Signed in as the Organiser. |
| Test Steps | 1. Submit a request starting at 06:00 SGT. |
| Test Data | 06:00 SGT on 1 Dec |
| Expected Result | The start is stored as 22:00 UTC on 30 Nov, and shown again as 06:00 SGT on 1 Dec. |

**Automated by:** `tests/unit/datetime.test.ts` › "SCRUM-129 [AC1 - Singapore timezone]: an early-morning Singapore time lands on the previous UTC day"

### TC-129-06

| Item | Content |
|---|---|
| Test Case ID | TC-129-06 |
| Test Scenario | [Boundary] AC 5: a period includes its start and excludes its end, so periods that only touch don't overlap |
| Pre-conditions | None beyond the shared ones. |
| Test Steps | 1. Compare 10:00–12:00 with 12:00–14:00, both ways round. <br> 2. Check registration at the exact opening and closing instants of its window. |
| Test Data | The periods above; a registration window |
| Expected Result | The two periods don't overlap. 10:00 is inside the first period and 12:00 is not. Registration is open at the opening instant and closed at the closing instant. The database filter uses the same bounds. |

**Automated by:** `tests/unit/period.test.ts` › "SCRUM-129 [AC5 - One period convention]: periods that only touch do not overlap, in either order", "SCRUM-129 [AC5 - One period convention]: the start instant is inside the period and the end instant is not", "SCRUM-129 [AC5 - One period convention]: the database filter uses the same bounds"; `tests/unit/registration-state.test.ts` › "SCRUM-129 [AC5 - One period convention]: registration is open at the exact opening instant", "SCRUM-129 [AC5 - One period convention]: registration is no longer open at the exact closing instant"
