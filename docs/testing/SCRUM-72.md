# SCRUM-72 — View an event I could attend: test cases

Story and acceptance criteria: [docs/backlog/SCRUM-72.md](../backlog/SCRUM-72.md).
Format and conventions: [README.md](README.md). The Attendee's list and event
page are in [app/(app)/events/](<../../app/(app)/events/>); whether
registration is open is `computeRegistrationState` in
[lib/registration-state.ts](../../lib/registration-state.ts).

Written on 2026-10-12 from the acceptance criteria, then mapped to the tests
that already existed (SCRUM-176). The tests predate the `SCRUM-n [ACx] TC-n-xx`
title format, so each case names them by their current titles.

**Shared pre-conditions for every case:** the database is migrated and seeded
and the app is running. Signed in as `attendee@test.local` (`Password123!`).
The seed has Confirmed events (one full, one with a registration window), and
events in other statuses, including a Cancelled one.

| ID | Type | Criterion | Automated |
|---|---|---|---|
| [TC-72-01](#tc-72-01) | Positive | AC 1, AC 2 | Unit, e2e |
| [TC-72-02](#tc-72-02) | Positive | AC 3 | Unit, e2e |
| [TC-72-03](#tc-72-03) | Negative | AC 4 | Unit, e2e |
| [TC-72-04](#tc-72-04) | Boundary | AC 5 | Unit |
| [TC-72-05](#tc-72-05) | Boundary | AC 6 | Unit, e2e |
| [TC-72-06](#tc-72-06) | Negative | AC 7 | Unit, e2e |
| [TC-72-07](#tc-72-07) | Negative | AC 8 | Unit, e2e |
| [TC-72-08](#tc-72-08) | Positive | AC 1 | Unit, e2e |

---

### TC-72-01

| Item | Content |
|---|---|
| Test Case ID | TC-72-01 |
| Test Scenario | [Positive] AC 1, AC 2: the Attendee browses Confirmed events, each with its details |
| Pre-conditions | Signed in as the Attendee. |
| Test Steps | 1. Open **Events**. <br> 2. Read an event's entry. |
| Test Data | The seeded Confirmed events |
| Expected Result | Only Confirmed events are listed, soonest first. Each shows its name, description, date and times (with the end date when it ends on a later day), venue name and location. Since SCRUM-171 AC 4, only Confirmed events that take registrations are listed ([TC-171-06](SCRUM-171.md#tc-171-06)); since SCRUM-162 AC 7, an event with several venues shows each approved one ([TC-162-11](SCRUM-162.md#tc-162-11)). |

**Automated by:** `tests/unit/attendee-events.test.ts` › "SCRUM-171 [AC4] TC-171-06, [Positive] AC: queries only CONFIRMED events that take registrations, ordered by start date", "SCRUM-162 [AC7] TC-162-11, [Positive] AC: fetches every approved booking's venue, the caller's own registration, and the active-registration count for each event"; `tests/unit/datetime.test.ts` › "[Positive] SCRUM-72 AC2: a same-day event shows its date, start time and end time", "[Positive] SCRUM-72 AC2: an event that ends on a later day shows the full end date"; `e2e/attendee-events.spec.ts` › "SCRUM-72 [AC1, AC2, AC7] TC-72-01, TC-72-06: the browse list shows Confirmed events with venue, capacity and registration state, and excludes Cancelled ones"

### TC-72-02

| Item | Content |
|---|---|
| Test Case ID | TC-72-02 |
| Test Scenario | [Positive] AC 3: an event shows its registration window, if set, and its places left |
| Pre-conditions | A Confirmed event with a registration window and 10 of 50 places taken. |
| Test Steps | 1. Open the event. |
| Test Data | The seeded event with a window |
| Expected Result | The page shows when registration opens and closes, in SGT, and 40 places left. |

**Automated by:** `tests/unit/registration-state.test.ts` › "SCRUM-72 AC3: a set window shows its opening and closing times", "AC: subtracts active registrations from the total"; `e2e/attendee-events.spec.ts` › "SCRUM-72 [AC3] TC-72-02: an open event's detail page shows the registration period and an honestly-disabled Register button"

### TC-72-03

| Item | Content |
|---|---|
| Test Case ID | TC-72-03 |
| Test Scenario | [Negative] AC 4: an event whose registration isn't open is still listed, with its state and no way to register |
| Pre-conditions | Confirmed events whose registration hasn't opened, was closed by hand, and has ended. |
| Test Steps | 1. Open **Events**, then each event. |
| Test Data | The three events |
| Expected Result | All three are listed. Each shows its state ("Registration not yet open" or "Registration closed") with **Register** disabled. |

**Automated by:** `tests/unit/registration-state.test.ts` › "[Negative] AC: registrationOpensAt in the future → NOT_YET_OPEN", "[Negative] AC: registrationEnabled false → CLOSED, regardless of capacity or period", "[Negative] AC: registrationClosesAt in the past → EXPIRED", "has a human label for every state (exhaustive at the type level too)"; `e2e/attendee-events.spec.ts` › "SCRUM-72 [AC4, AC8] TC-72-03: going straight to /events/${id} shows "${label}" with Register disabled"

### TC-72-04

| Item | Content |
|---|---|
| Test Case ID | TC-72-04 |
| Test Scenario | [Boundary] AC 5: with no window set, registration is open from confirmation until the event starts |
| Pre-conditions | A Confirmed event with no registration window. |
| Test Steps | 1. Open the event before its start. <br> 2. Check it at the exact start instant, and after. |
| Test Data | The event's start time |
| Expected Result | Before the start it is open and says "Opens on confirmation", closing at the start. At the start instant and after, it is closed. |

**Automated by:** `tests/unit/registration-state.test.ts` › "SCRUM-72 AC5: no period set, before the event starts → OPEN", "SCRUM-72 AC5: no period set, at the exact start instant → closed", "SCRUM-72 AC5: no period set, after the event starts → closed", "SCRUM-72 AC5: no window set shows the default — opens on confirmation, closes at the start"

### TC-72-05

| Item | Content |
|---|---|
| Test Case ID | TC-72-05 |
| Test Scenario | [Boundary] AC 6: a full event stays listed and shows Full; one place left is still open |
| Pre-conditions | A full Confirmed event, and one with one place left. |
| Test Steps | 1. Open **Events**, then the full event. <br> 2. Open the event with one place left. |
| Test Data | The seeded full event |
| Expected Result | The full event is listed and shown as "Full", with **Register** disabled. The other is open. |

**Automated by:** `tests/unit/registration-state.test.ts` › "[Negative] AC: remaining capacity zero → FULL", "[Boundary] AC: one remaining place → OPEN, not FULL"; `e2e/attendee-events.spec.ts` › "SCRUM-72 [AC6] TC-72-05, SCRUM-74 [AC4] TC-74-04: opening a full event's detail page shows it as full with the register action disabled"

### TC-72-06

| Item | Content |
|---|---|
| Test Case ID | TC-72-06 |
| Test Scenario | [Negative] AC 7: Cancelled and other non-Confirmed events aren't listed |
| Pre-conditions | Signed in as the Attendee. |
| Test Steps | 1. Open **Events**. |
| Test Data | The seeded Cancelled and Planning events |
| Expected Result | Neither appears. |

**Automated by:** `tests/unit/attendee-events.test.ts` › "[Negative] AC: a non-Confirmed event (e.g. Planning) is not browsable — same null as missing", "[Negative] AC: a Cancelled event is not browsable"; `e2e/attendee-events.spec.ts` › "SCRUM-72 [AC1, AC2, AC7] TC-72-01, TC-72-06: the browse list shows Confirmed events with venue, capacity and registration state, and excludes Cancelled ones"

### TC-72-07

| Item | Content |
|---|---|
| Test Case ID | TC-72-07 |
| Test Scenario | [Negative] AC 8: opening an event by its address follows the same rules as the list |
| Pre-conditions | Signed in as the Attendee; then as an Organiser. |
| Test Steps | 1. As the Attendee, go to the address of a Cancelled event, a Planning event, and an id that doesn't exist. <br> 2. As an Organiser, go to a Confirmed event's Attendee page. |
| Test Data | The events' ids; a made-up id |
| Expected Result | Each returns "not found", the same for a hidden event as for a missing one. |

**Automated by:** `tests/unit/attendee-events.test.ts` › "[Negative] a missing id returns null without distinguishing it from a not-yet-visible one", "[Security gate] a role without event:browse (e.g. VENUE_STAFF) is refused before the query even runs", "[Negative] a signed-out caller is refused"; `e2e/attendee-events.spec.ts` › "SCRUM-72 [AC8] TC-72-07: direct event URLs do not bypass visibility rules — a Cancelled event 404s for an Attendee", "SCRUM-72 [AC8] TC-72-07: a non-existent event id 404s the same way as a real but invisible one", "an Organiser hitting a Confirmed event's attendee-detail URL still 404s (unchanged pre-existing behaviour)"; `e2e/attendee-events.spec.ts` › "SCRUM-72 [AC7, AC8] TC-72-07: going straight to /events/${id} (not Confirmed) 404s", run for a Draft, a Planning and a Completed event

### TC-72-08

| Item | Content |
|---|---|
| Test Case ID | TC-72-08 |
| Test Scenario | [Positive] AC 1: typing a keyword narrows the list |
| Pre-conditions | Signed in as the Attendee. |
| Test Steps | 1. Type part of an event's name, in a different case, into the search. <br> 2. Clear it. |
| Test Data | A keyword with spaces around it |
| Expected Result | Only events whose name or description contains the keyword are listed; clearing it lists them all again. |

**Automated by:** `tests/unit/attendee-events-search.test.ts` › "[Positive] keeps events whose name contains the keyword", "[Positive] matches the description too, ignoring upper/lower case", "[Positive] a blank or whitespace keyword keeps every event", "[Boundary] trims surrounding spaces before matching"; `e2e/attendee-events.spec.ts` › "SCRUM-72 [AC1] TC-72-08, SCRUM-168 [AC2] TC-168-02: typing a keyword narrows the list to matching events, ignoring case"
