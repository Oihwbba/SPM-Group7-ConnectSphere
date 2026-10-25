# SCRUM-48 — User views their notification list: test cases

Story and acceptance criteria: [docs/backlog/SCRUM-48.md](../backlog/SCRUM-48.md).
Format and conventions: [README.md](README.md).

**Shared pre-conditions for every case:** a local PostgreSQL migrated with
`npm run db:deploy` and seeded with `npm run db:seed`. Accounts use the
password `Password123!`. Nothing in the app writes a notification with a
show-from time or withdraws one yet (SCRUM-163 and SCRUM-124 will), so the
AC8 cases write those rows directly. Times are UTC.

| ID | Type | Criterion | Automated |
|---|---|---|---|
| [TC-48-01](#tc-48-01) | Positive | AC 1 | Unit, integration |
| [TC-48-02](#tc-48-02) | Positive | AC 2, AC 3 | Unit, integration, e2e |
| [TC-48-03](#tc-48-03) | Boundary | AC 2 | Integration |
| [TC-48-04](#tc-48-04) | Positive | AC 3 | Unit, integration, e2e |
| [TC-48-05](#tc-48-05) | Positive | AC 4 | Integration, e2e |
| [TC-48-06](#tc-48-06) | Positive, Negative | AC 5 | Unit, integration |
| [TC-48-07](#tc-48-07) | Positive | AC 5 | e2e |
| [TC-48-08](#tc-48-08) | Positive | AC 5 (Safety Officer) | Unit, integration |
| [TC-48-09](#tc-48-09) | Negative | AC 5, AC 6 | Unit, integration, e2e |
| [TC-48-10](#tc-48-10) | Positive | AC 6 (several roles) | Integration |
| [TC-48-11](#tc-48-11) | Positive | AC 7 | Integration |
| [TC-48-12](#tc-48-12) | Boundary | AC 8 | Unit, integration |
| [TC-48-13](#tc-48-13) | Positive, Negative | AC 8 | Integration, e2e |
| [TC-48-14](#tc-48-14) | Negative | AC 8 | Integration |
| [TC-48-15](#tc-48-15) | Negative | AC 2 | Unit |

---

### TC-48-01

| Item | Content |
|---|---|
| Test Case ID | TC-48-01 |
| Test Scenario | [Positive] AC 1: all my notifications are listed, newest first |
| Pre-conditions | Signed in as a user with three notifications, shown from 30, 10 and 1 minutes ago, and a hold reminder written two hours ago that shows from five minutes ago. |
| Test Steps | 1. Open Notifications. |
| Test Data | Titles "Oldest", "Middle", "Newest"; reminder "Reminder" |
| Expected Result | All of them are listed, newest first: "Newest", "Reminder", "Middle", "Oldest". The reminder is placed by when it showed, not when it was written. |

**Automated by:** `tests/integration/notifications.test.ts` › "SCRUM-48 [AC1] TC-48-01: all my notifications are listed, newest shown first" and "SCRUM-48 [AC1, AC8] TC-48-01: a reminder written early is ordered by when it shows, not when it was written"; `tests/unit/notifications.test.ts` › "SCRUM-48 [AC1, AC6, AC7, AC8] TC-48-01: reads the session user's visible notifications of every type, newest shown first"

### TC-48-02

| Item | Content |
|---|---|
| Test Case ID | TC-48-02 |
| Test Scenario | [Positive] AC 2, AC 3: opening an unread notification marks it read, and the header's count drops by one |
| Pre-conditions | Signed in as a fresh Organiser account with one Under Review event and one new unread notification about it (the automated case makes its own account, so other specs' notices can't change its count). |
| Test Steps | 1. Note the count on the header's bell. <br> 2. Open Notifications from the bell. <br> 3. Open the newest notification. <br> 4. Close the event details. <br> 5. Open Notifications again. |
| Test Data | `organiser@test.local` |
| Expected Result | Step 2: the new notification is first and shown as unread. Step 4: the bell's count is one lower. Step 5: the notification is shown as read. The row's `readAt` is set; the other notifications are still unread. |

**Automated by:** `e2e/notifications.spec.ts` › "SCRUM-48 [AC1, AC2, AC3, AC5] TC-48-02, TC-48-04, TC-48-07: opening the newest notification marks it read, lowers the count and opens the event"; `tests/integration/notifications.test.ts` › "SCRUM-48 [AC2, AC3] TC-48-02: opening an unread notification marks it read, and the unread count drops by one"; `tests/unit/notifications.test.ts` › "SCRUM-48 [AC2, AC3] TC-48-02: marks my unread notification read and refreshes the header's count"

### TC-48-03

| Item | Content |
|---|---|
| Test Case ID | TC-48-03 |
| Test Scenario | [Boundary] AC 2: opening a notification that is already read changes nothing |
| Pre-conditions | A notification read at 2026-09-01 02:00. |
| Test Steps | 1. Open it again. |
| Test Data | `readAt` 2026-09-01T02:00:00Z |
| Expected Result | It opens, and `readAt` is still 2026-09-01T02:00:00Z. |

**Automated by:** `tests/integration/notifications.test.ts` › "SCRUM-48 [AC2] TC-48-03: opening a read notification again keeps the time it was first read"

### TC-48-04

| Item | Content |
|---|---|
| Test Case ID | TC-48-04 |
| Test Scenario | [Positive] AC 3: the header shows my unread count |
| Pre-conditions | Signed in as `organiser@test.local`, with some unread notifications and one written to show in an hour. |
| Test Steps | 1. Look at the bell in the header. |
| Test Data | `organiser@test.local` |
| Expected Result | Its accessible name is "Notifications, *n* unread", where *n* counts my unread notifications that are showing now; the one due in an hour isn't counted. With none unread it reads "Notifications, none unread" and shows no badge. If the count can't be read, the header shows none rather than the page failing. |

**Automated by:** `e2e/notifications.spec.ts` › "SCRUM-48 [AC1, AC2, AC3, AC5] TC-48-02, TC-48-04, TC-48-07: …"; `tests/unit/notifications.test.ts` › "SCRUM-48 [AC3, AC8] TC-48-04: counts only my unread notifications that are showing" and "SCRUM-48 [AC3] TC-48-04: a signed-out caller has no unread count, before the query runs" and "SCRUM-48 [AC3] TC-48-04: a failed count shows none in the header instead of failing every page"

### TC-48-05

| Item | Content |
|---|---|
| Test Case ID | TC-48-05 |
| Test Scenario | [Positive] AC 4: with no notifications, an empty state is shown rather than an error |
| Pre-conditions | Signed in as a new account with no notifications (another user has one). |
| Test Steps | 1. Open Notifications. |
| Test Data | A throwaway Attendee account |
| Expected Result | "No notifications yet" is shown, with no list items, and the bell reads "Notifications, none unread". |

**Automated by:** `e2e/notifications.spec.ts` › "SCRUM-48 [AC4] TC-48-05: a user with no notifications sees an empty state, not an error"; `tests/integration/notifications.test.ts` › "SCRUM-48 [AC4] TC-48-05: with no notifications, the list is empty and the count is zero, not an error"

### TC-48-06

| Item | Content |
|---|---|
| Test Case ID | TC-48-06 |
| Test Scenario | [Positive, Negative] AC 5: each notification links to a page this user is allowed to open |
| Pre-conditions | A notification about event `evt_1`, for each role in turn. |
| Test Steps | 1. Work out the notification's link for each role. |
| Test Data | Event status Planning, Confirmed, Cancelled or Completed; stored link `/bookings`, `/equipment-requests` or none |
| Expected Result | Organiser and Coordinator: `/events/evt_1`, the event's own page (SCRUM-208). Attendee: `/events/evt_1` for a Confirmed event, or one back in Planning to be re-planned (SCRUM-85 AC7, AC9), and no link for a Cancelled or Completed one, which has no Attendee page. Venue Staff and Technical Support, who can't open the event: the notification's own link, or none. Event Coordinator Lead and Safety Officer: none yet. A notification about no event keeps its own link. |

**Automated by:** `tests/unit/notifications.test.ts` › every "SCRUM-48 [AC5] TC-48-06: …" test; `tests/integration/notifications.test.ts` › "SCRUM-48 [AC5] TC-48-06: an Organiser's notification about their event links to the event's page"

### TC-48-07

| Item | Content |
|---|---|
| Test Case ID | TC-48-07 |
| Test Scenario | [Positive] AC 5: an Organiser opening a notification lands on the event |
| Pre-conditions | As TC-48-02. |
| Test Steps | 1. Open the newest notification. |
| Test Data | `organiser@test.local`, "Under Review — Career Fair" |
| Expected Result | The address is `/events?event=evt_under_review` and the details of "Under Review — Career Fair" are open. Closing them leaves `/events`. |

**Automated by:** `e2e/notifications.spec.ts` › "SCRUM-48 [AC1, AC2, AC3, AC5] TC-48-02, TC-48-04, TC-48-07: …"

### TC-48-08

| Item | Content |
|---|---|
| Test Case ID | TC-48-08 |
| Test Scenario | [Positive] AC 5: a Safety Officer's notification links to the safety check |
| Pre-conditions | A Coordinator has requested a safety check (SCRUM-166). Signed in as `safety@test.local`. |
| Test Steps | 1. Open Notifications. <br> 2. Open "Safety check requested". |
| Test Data | — |
| Expected Result | The notice links to that check (`/safety-checks/<id>`), and the check opens. |

**Automated by:** `tests/unit/notifications.test.ts` › "SCRUM-48 [AC5] TC-48-08: a Safety Officer's notice about a safety check opens that check"; `tests/integration/staff-notifications.test.ts` › "SCRUM-124 [AC8, AC11, AC14] TC-124-08, TC-124-11: a safety check's Changes requested flags the booking, and tells its Coordinator and each Venue Staff member once" (the officer's own list links to the check). SCRUM-166 writes the link; a Safety Officer can't open the event itself, so the notice's own link is followed (TC-48-06).

### TC-48-09

| Item | Content |
|---|---|
| Test Case ID | TC-48-09 |
| Test Scenario | [Negative] AC 6: I never see or open another user's notifications |
| Pre-conditions | I have one notification and another user has one. |
| Test Steps | 1. Open Notifications. <br> 2. Try to mark the other user's notification read by its id. |
| Test Data | — |
| Expected Result | Step 1: only mine is listed and counted. Step 2: "Notification not found." (the same as an id that doesn't exist), and the other user's notification is still unread. Signed out, the list is empty and nothing is queried. A link to another Organiser's event, or to one that doesn't exist (`/events?event=…`), opens nothing and shows nothing of it. |

**Automated by:** `e2e/notifications.spec.ts` › "SCRUM-48 [AC5, AC6] TC-48-09: a link to another Organiser's event, or to one that doesn't exist, opens nothing"; `tests/integration/notifications.test.ts` › "SCRUM-48 [AC6] TC-48-09: another user's notifications are never listed or counted, and can't be marked read"; `tests/unit/notifications.test.ts` › "SCRUM-48 [AC6, AC8] TC-48-09: only my own, not withdrawn, and shown from their time on", "SCRUM-48 [AC6] TC-48-09: a signed-out caller gets an empty list, before the query runs" and "SCRUM-48 [AC6] TC-48-09: a notification that isn't mine or isn't showing is not found, and nothing is written"

### TC-48-10

| Item | Content |
|---|---|
| Test Case ID | TC-48-10 |
| Test Scenario | [Positive] AC 6: a user with several roles sees the notifications for all of them in one list |
| Pre-conditions | The seeded `multirole@test.local` is Venue Staff, with Technical Support and Coordinator as additional roles (SCRUM-121). |
| Test Steps | 1. A notice goes to every member of Venue Staff, and another to every member of Technical Support. <br> 2. Sign in as `multirole@test.local` and open Notifications. |
| Test Data | `multirole@test.local` / `Password123!` |
| Expected Result | Both are listed. |

**Automated by:** `tests/integration/multiple-roles.test.ts` › "SCRUM-48 [AC6] TC-48-10, SCRUM-121 [AC2] TC-121-02: an account that is Venue Staff and Technical Support sees the notices of both in one list". The list is filtered by the account, not the role, so it needed no change; the role-wide notices (SCRUM-124) reach a role held as an additional one.

### TC-48-11

| Item | Content |
|---|---|
| Test Case ID | TC-48-11 |
| Test Scenario | [Positive] AC 7: notifications from every source appear in this one list |
| Pre-conditions | I have one notification of every `NotificationType`. |
| Test Steps | 1. Open Notifications. |
| Test Data | Every value of `NotificationType` |
| Expected Result | All of them are listed and counted as unread. |

**Automated by:** `tests/integration/notifications.test.ts` › "SCRUM-48 [AC7] TC-48-11: notifications of every type appear in the one list"

### TC-48-12

| Item | Content |
|---|---|
| Test Case ID | TC-48-12 |
| Test Scenario | [Boundary] AC 8: a notification appears exactly at its show-from time |
| Pre-conditions | One notification shown from *now*, one from one millisecond after *now*. |
| Test Steps | 1. Read the list and the count at *now*. |
| Test Data | — |
| Expected Result | The first is listed and counted; the second is neither. |

**Automated by:** `tests/integration/notifications.test.ts` › "SCRUM-48 [AC8] TC-48-12: shown from exactly now, it is listed and counted; from one millisecond later, it is neither"; `tests/unit/notifications.test.ts` › "SCRUM-48 [AC8] TC-48-12: without a time given, visibility is judged at the current time"

### TC-48-13

| Item | Content |
|---|---|
| Test Case ID | TC-48-13 |
| Test Scenario | [Positive, Negative] AC 8: a notification not yet showing appears from its time on, with nothing else done |
| Pre-conditions | A notification shown from an hour from now. |
| Test Steps | 1. Read the list and count now. <br> 2. Try to mark it read by its id. <br> 3. Read the list and count an hour from now. |
| Test Data | — |
| Expected Result | Step 1: not listed or counted. Step 2: "Notification not found." Step 3: listed and counted as unread. |

**Automated by:** `tests/integration/notifications.test.ts` › "SCRUM-48 [AC8] TC-48-13: a notification not yet showing can't be opened, and appears from its time on with nothing else done"; `e2e/notifications.spec.ts` checks that one due in an hour isn't on the page.

### TC-48-14

| Item | Content |
|---|---|
| Test Case ID | TC-48-14 |
| Test Scenario | [Negative] AC 8: a notification withdrawn before its time never appears |
| Pre-conditions | A notification shown from an hour from now and withdrawn now. |
| Test Steps | 1. Read the list and count now, in an hour and in a day. <br> 2. Try to mark it read by its id. |
| Test Data | — |
| Expected Result | Step 1: never listed or counted. Step 2: "Notification not found." |

**Automated by:** `tests/integration/notifications.test.ts` › "SCRUM-48 [AC8] TC-48-14: a notification withdrawn before its time never appears, even after that time"

### TC-48-15

| Item | Content |
|---|---|
| Test Case ID | TC-48-15 |
| Test Scenario | [Negative] AC 2: a request to mark a notification read that is invalid or signed out writes nothing |
| Pre-conditions | — |
| Test Steps | 1. Mark read with no id, an empty id, a number, or no input. <br> 2. Mark read while signed out. |
| Test Data | `{}`, `{ id: "" }`, `{ id: 7 }`, `null` |
| Expected Result | Step 1: refused before anything is read. Step 2: "You do not have permission to do that." Nothing is read or written in either. |

**Automated by:** `tests/unit/notifications.test.ts` › "SCRUM-48 [AC2] TC-48-15: invalid input %j is refused before any read or write", "SCRUM-48 [AC6] TC-48-15: a signed-out caller is refused, and nothing is read or written" and "SCRUM-48 [AC2] TC-48-15: an unexpected database failure is not swallowed"
