# SCRUM-252 — My Registrations: a cancelled event's venue, and the order of re-planned events: test cases

SCRUM-252 is a Bug task in Jira, with two acceptance criteria:
[docs/backlog/SCRUM-252.md](../backlog/SCRUM-252.md).

Format and conventions: [README.md](README.md).

**Where the behaviour lives:** `shownEventTime` in `lib/confirmed-details.ts`
is the date a row shows. `getMyRegistrations` in
`app/(app)/registrations/queries.ts` orders by it, and
`app/(app)/registrations/registrations-list.tsx` displays it, and chooses the
row's venues.

**Shared pre-conditions:** a seeded database (`npm run db:seed`), signed in as
`attendee2@test.local` / `Password123!`. Each case creates its own events and
registrations. An event being re-planned is one in Planning with a last
confirmed date (SCRUM-85 AC8).

| ID | Type | Criterion | Automated |
|---|---|---|---|
| [TC-252-01](#tc-252-01) | Positive | AC 1 | unit |
| [TC-252-02](#tc-252-02) | Negative | AC 1 | unit |
| [TC-252-03](#tc-252-03) | Positive | AC 1 | e2e |
| [TC-252-04](#tc-252-04) | Positive | AC 2 | unit |
| [TC-252-05](#tc-252-05) | Negative | AC 2 | unit |
| [TC-252-06](#tc-252-06) | Boundary | AC 2 | unit |
| [TC-252-07](#tc-252-07) | Positive | AC 2 | e2e |

### TC-252-01

| Item | Content |
|---|---|
| Test Case ID | TC-252-01 |
| Test Scenario | [Positive] AC 1: a cancelled event's row shows every venue it was last confirmed with |
| Pre-conditions | A cancelled event with no live bookings, last confirmed at two venues |
| Test Steps | 1. Show the row for a Cancelled, a Withdrawn and a Registered registration. |
| Test Data | "Main Hall — Level 1", "Room 2 — Level 2" |
| Expected Result | Each row reads "Main Hall — Level 1; Room 2 — Level 2", and never "Venue to be confirmed". |

**Automated by:** `tests/unit/registrations-list.test.tsx` › "SCRUM-252 [AC1] TC-252-01: a cancelled event's row shows every venue it was last confirmed with" and "SCRUM-252 [AC1] TC-252-01: so does a registration I had withdrawn, or one the cancellation didn't update"

### TC-252-02

| Item | Content |
|---|---|
| Test Case ID | TC-252-02 |
| Test Scenario | [Negative] AC 1: an event that isn't cancelled still shows its approved venues |
| Pre-conditions | A Confirmed event with an approved booking, whose saved last confirmed venue differs |
| Test Steps | 1. Show the row. |
| Test Data | Approved "Main Hall — Level 1"; last confirmed "Old Hall — Level 9" |
| Expected Result | The row reads "Main Hall — Level 1". |

**Automated by:** `tests/unit/registrations-list.test.tsx` › "SCRUM-252 [AC1] TC-252-02: an event that isn't cancelled still shows its approved venues, not what was last confirmed"

### TC-252-03

| Item | Content |
|---|---|
| Test Case ID | TC-252-03 |
| Test Scenario | [Positive] AC 1: on the page, a cancelled event shows the venues it was last confirmed with |
| Pre-conditions | A cancelled event last confirmed at two venues, with the signed-in Attendee's registration Cancelled |
| Test Steps | 1. Open My Registrations. |
| Test Data | `attendee2@test.local` |
| Expected Result | The row reads Cancelled and "Seminar Room 2.1 — Level 2, Block B; Exhibition Hall — Level 1, Block C". |

**Automated by:** `e2e/my-registrations-order.spec.ts` › "SCRUM-252 [AC1] TC-252-03: a cancelled event shows the venues it was last confirmed with"

### TC-252-04

| Item | Content |
|---|---|
| Test Case ID | TC-252-04 |
| Test Scenario | [Positive] AC 2: a re-planned event is placed by its last confirmed date |
| Pre-conditions | One event Confirmed for day 10; two being re-planned, one with its own date on day 5 and last confirmed for day 20, one with its own date on day 30 and last confirmed for day 1 |
| Test Steps | 1. Read the list. |
| Test Data | Days of January 2034 |
| Expected Result | Day 1, day 10, day 20: the reverse of their own dates' order. |

**Automated by:** `tests/unit/my-registrations.test.ts` › "SCRUM-252 [AC2] TC-252-04: a re-planned event is placed by its last confirmed date, before and after an event that isn't"

### TC-252-05

| Item | Content |
|---|---|
| Test Case ID | TC-252-05 |
| Test Scenario | [Negative] AC 2: a row that shows the event's own date is placed by that date |
| Pre-conditions | A withdrawn registration on a re-planned event; a registration on an event in Planning that was never confirmed |
| Test Steps | 1. Read the list. <br> 2. Ask what date each row shows. |
| Test Data | — |
| Expected Result | Each is placed by the event's own date, which is the date its row shows. The last confirmed date is used only while re-planned and still registered. |

**Automated by:** `tests/unit/my-registrations.test.ts` › "SCRUM-252 [AC2] TC-252-05: a withdrawn registration shows the event's own date, so it is placed by that date" and "SCRUM-252 [AC2] TC-252-05: an event never confirmed, in Planning, is placed by its own date"; `tests/unit/replanning-views.test.tsx` › "SCRUM-252 [AC2] TC-252-05: the row's date and the list's order agree: the last confirmed date while re-planned and still registered, the event's own otherwise"

### TC-252-06

| Item | Content |
|---|---|
| Test Case ID | TC-252-06 |
| Test Scenario | [Boundary] AC 2: equal dates keep the query's order, and an event with no date comes last |
| Pre-conditions | Two rows showing the same date, and one event with no start |
| Test Steps | 1. Read the list. |
| Test Data | — |
| Expected Result | The two equal rows stay in the order the query returned them, and the event with no date is last. |

**Automated by:** `tests/unit/my-registrations.test.ts` › "SCRUM-252 [AC2] TC-252-06: equal dates keep the query's order, and an event with no date comes last"

### TC-252-07

| Item | Content |
|---|---|
| Test Case ID | TC-252-07 |
| Test Scenario | [Positive] AC 2: on the page, rows are in the order of the dates they show |
| Pre-conditions | One event Confirmed; two being re-planned, whose own dates are in the opposite order to their last confirmed dates |
| Test Steps | 1. Open My Registrations. |
| Test Data | `attendee2@test.local` |
| Expected Result | The rows are in order of the date each shows. |

**Automated by:** `e2e/my-registrations-order.spec.ts` › "SCRUM-252 [AC2] TC-252-07: rows are in the order of the dates they show, whatever the re-planned events' own dates"
