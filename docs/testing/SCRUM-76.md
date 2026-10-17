# SCRUM-76 — View my registration status: test cases

Story and acceptance criteria: [docs/backlog/SCRUM-76.md](../backlog/SCRUM-76.md).
Format and conventions: [README.md](README.md). The list is **My
Registrations**,
[app/(app)/registrations/page.tsx](<../../app/(app)/registrations/page.tsx>),
read by `getMyRegistrations`, which takes the event's details live from the
event.

Written on 2026-10-12 from the acceptance criteria, then mapped to the tests
that already existed (SCRUM-176). The tests predate the `SCRUM-n [ACx] TC-n-xx`
title format, so each case names them by their current titles.

**Shared pre-conditions for every case:** the database is migrated and seeded
and the app is running. Signed in as `attendee@test.local` (`Password123!`),
who has registrations in the seed.

| ID | Type | Criterion | Automated |
|---|---|---|---|
| [TC-76-01](#tc-76-01) | Positive | AC 1, AC 2 | Unit, e2e |
| [TC-76-02](#tc-76-02) | Positive | AC 3 | e2e |
| [TC-76-03](#tc-76-03) | Positive | AC 4 | Unit |
| [TC-76-04](#tc-76-04) | Negative | AC 5 | Unit, e2e |
| [TC-76-05](#tc-76-05) | Boundary | AC 1 | e2e |

---

### TC-76-01

| Item | Content |
|---|---|
| Test Case ID | TC-76-01 |
| Test Scenario | [Positive] AC 1, AC 2: my registrations list each event's details and my status |
| Pre-conditions | Signed in as the Attendee, Registered for one event and Withdrawn from another. |
| Test Steps | 1. Open **My Registrations**. |
| Test Data | The seeded registrations |
| Expected Result | Each row shows the event's name, date, time and venue, and the status "Registered" or "Withdrawn", soonest event first. When the event has two venues, the one in use at its start is shown. |

**Automated by:** `tests/unit/my-registrations.test.ts` › "[Positive] AC1: fetches the event name, date, time, venue and the registration status", "[Positive] AC1: with two approved bookings, the venue shown is the one in use when the event starts", "[Positive] lists the soonest event first"; `e2e/my-registrations.spec.ts` › "AC1, AC2: my list shows each event's name, date, venue and status"

### TC-76-02

| Item | Content |
|---|---|
| Test Case ID | TC-76-02 |
| Test Scenario | [Positive] AC 3: a registration for an event ConnectSphere cancelled shows as Cancelled |
| Pre-conditions | The Attendee was Registered for an event that was then cancelled. |
| Test Steps | 1. Open **My Registrations**. |
| Test Data | The seeded cancelled event |
| Expected Result | Its registration shows "Cancelled". |

**Automated by:** `e2e/my-registrations.spec.ts` › "AC3: a registration for an event ConnectSphere cancelled shows as Cancelled"

### TC-76-03

| Item | Content |
|---|---|
| Test Case ID | TC-76-03 |
| Test Scenario | [Positive] AC 4: a changed event shows its current details, not the ones from registration time |
| Pre-conditions | The Attendee registered, and then the event's time changed. |
| Test Steps | 1. Open **My Registrations**. |
| Test Data | The new time |
| Expected Result | The row shows the new time. |

**Automated by:** `tests/unit/my-registrations.test.ts` › "[Positive] AC4: event details are read live from the event, not from a copy on the registration"

### TC-76-04

| Item | Content |
|---|---|
| Test Case ID | TC-76-04 |
| Test Scenario | [Negative] AC 5: the list holds only my registrations, and only an Attendee can open it |
| Pre-conditions | Another Attendee has registrations. Then signed in as an Organiser, then signed out. |
| Test Steps | 1. As the Attendee, open **My Registrations**. <br> 2. As the Organiser, type `/registrations`. <br> 3. Signed out, ask for the list. |
| Test Data | The other Attendee's registrations |
| Expected Result | Step 1 lists only this Attendee's registrations. Step 2 is refused. Step 3 returns nothing. |

**Automated by:** `tests/unit/my-registrations.test.ts` › "[Positive] AC5: the list contains only my registrations — filtered by the session's user id", "[Negative] a signed-out caller gets an empty list, before the query runs"; `e2e/my-registrations.spec.ts` › "AC5: the list contains only my registrations", "an Organiser typing /registrations directly is refused"

### TC-76-05

| Item | Content |
|---|---|
| Test Case ID | TC-76-05 |
| Test Scenario | [Boundary] AC 1: an Attendee with no registrations is told so, and offered the events |
| Pre-conditions | Signed in as an Attendee with no registrations. |
| Test Steps | 1. Open **My Registrations**. <br> 2. Click **Browse events**. |
| Test Data | None |
| Expected Result | "No registrations yet", with a **Browse events** link that opens the event list. |

**Automated by:** `e2e/my-registrations.spec.ts` › "an Attendee with no registrations sees the empty state with a link to browse events"
