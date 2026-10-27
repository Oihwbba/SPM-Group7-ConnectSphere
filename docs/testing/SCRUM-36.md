# SCRUM-36 — View Venue Availability: test cases

Story and acceptance criteria: [docs/backlog/SCRUM-36.md](../backlog/SCRUM-36.md).
Format and conventions: [README.md](README.md). How a day is split into
stretches: `availabilityByDay` in [lib/venue-availability.ts](../../lib/venue-availability.ts),
which decides overlap with the one rule in [lib/period.ts](../../lib/period.ts).

> **Week 7 (SCRUM-158).** AC 2 and AC 4 are written for bare booking and maintenance periods. SCRUM-159 replaces AC 2 with booked periods padded by the venue's setup and turnaround time, and SCRUM-163 changes AC 4 so a Held booking also reads as (tentatively) held, not available. The cases below test the behaviour as built before those stories land.

**Shared pre-conditions for every case:** the database is migrated and seeded,
the app is running, and the tester signs in as an Event Coordinator
(`coordinator@test.local` / `Password123!`) unless the case says otherwise.
Times are Singapore time.

**AC 2 (the team's choice):** one calendar per venue, picked from a list,
rather than one grid across every venue. It shows a week, Monday to Sunday:
from tablet width up as seven columns on a 24-hour timeline, and on a phone as
a list of the same seven days. A single venue over a week stays readable on a
phone and to a screen reader, where a grid of every venue would not.

| ID | Type | Criterion | Automated |
|---|---|---|---|
| [TC-36-01](#tc-36-01) | Positive | AC 1, AC 2, AC 4 | Unit, e2e |
| [TC-36-02](#tc-36-02) | Positive | AC 3 | Unit, e2e |
| [TC-36-03](#tc-36-03) | Boundary | AC 5 | Unit, e2e |
| [TC-36-04](#tc-36-04) | Positive | AC 6 | Unit, e2e |
| [TC-36-05](#tc-36-05) | Positive, Boundary | AC 1 | Unit, e2e |
| [TC-36-06](#tc-36-06) | Positive | Screen readers and phones | e2e |
| [TC-36-07](#tc-36-07) | Negative | AC 7 (Coordinators and Venue Staff only) | Unit, e2e |
| [TC-36-08](#tc-36-08) | Positive | Details on hover | Unit, e2e |
| [TC-36-09](#tc-36-09) | Positive | AC 2 (a newly approved booking, also on an open calendar) | Unit, e2e |

---

### TC-36-01

| Item | Content |
|---|---|
| Test Case ID | TC-36-01 |
| Test Scenario | [Positive] AC 1, AC 2, AC 4: a venue's calendar shows available and unavailable periods; an approved booking reads as unavailable, and a pending request does not |
| Pre-conditions | An approved booking on the Grand Auditorium, 10 Jan 2036, 9:00 am to 1:00 pm. |
| Test Steps | 1. Open **Availability**. <br> 2. Choose the Grand Auditorium, From and To 10 Jan 2036. |
| Test Data | — |
| Expected Result | The day reads "Available midnight to 9:00 am", "Booked 9:00 am to 1:00 pm", "Available 1:00 pm to midnight", with a solid bar for the booking. A pending request does not appear. |

**Automated by:** `tests/unit/venue-availability.test.ts` › "SCRUM-36 [AC2] TC-36-01: an approved booking reads as unavailable, with free time either side"; `e2e/availability.spec.ts` › "SCRUM-37 [AC1, AC2, AC5], SCRUM-36 [AC2, AC3, AC5]: maintenance is recorded, seen, refused over, and sat flush against a booking"

### TC-36-02

| Item | Content |
|---|---|
| Test Case ID | TC-36-02 |
| Test Scenario | [Positive] AC 3: recorded unavailability reads as unavailable and is visibly different from a booking, not by colour alone |
| Pre-conditions | Maintenance recorded on the Grand Auditorium, 10 Jan 2036, 1:00 pm to 5:00 pm. |
| Test Steps | 1. Open the calendar for that day. <br> 2. Compare it with a booked stretch and the legend. |
| Test Data | — |
| Expected Result | "Unavailable (maintenance) 1:00 pm to 5:00 pm", with a wrench icon and a striped bar. A booking has a calendar icon, the word "Booked" and a solid bar. They differ in label, icon and pattern, as well as colour. |

**Automated by:** `tests/unit/venue-availability.test.ts` › "SCRUM-36 [AC3] TC-36-02: recorded maintenance reads as unavailable and stays distinguishable from a booking"; `e2e/availability.spec.ts` › journey

### TC-36-03

| Item | Content |
|---|---|
| Test Case ID | TC-36-03 |
| Test Scenario | [Boundary] AC 5: where one unavailable period ends exactly as another begins, no gap is shown and no time is counted twice |
| Pre-conditions | The booking from TC-36-01 and the maintenance from TC-36-02: 9:00 am to 1:00 pm, then 1:00 pm to 5:00 pm. |
| Test Steps | 1. Open the calendar for 10 Jan 2036. |
| Test Data | — |
| Expected Result | The day lists, in order: Available midnight to 9:00 am, Booked 9:00 am to 1:00 pm, Unavailable (maintenance) 1:00 pm to 5:00 pm, Available 5:00 pm to midnight. There is no "Available" between the two, and each stretch starts where the last ended. A period crossing midnight splits between the two days; one ending at midnight does not spill into the next. |

**Automated by:** `tests/unit/venue-availability.test.ts` › "SCRUM-36 [AC5] TC-36-03: two periods meeting at an endpoint show no gap, and no moment is counted twice" and "SCRUM-36 — a period across midnight is split between the two days; one ending at midnight does not spill over"; `e2e/availability.spec.ts` › journey

### TC-36-04

| Item | Content |
|---|---|
| Test Case ID | TC-36-04 |
| Test Scenario | [Positive] AC 6: a venue with nothing in the week shows as available throughout, not as an empty view |
| Pre-conditions | Nothing on the Executive Boardroom in the week of 2 to 8 Jun 2036. |
| Test Steps | 1. Open the calendar for the Executive Boardroom and go to 4 Jun 2036. |
| Test Data | — |
| Expected Result | Seven days, Monday 2 Jun to Sunday 8 Jun, each with "Available all day" at the top of its column (pinned there while the grid scrolls), and each read to a screen reader as "Available all day". |

**Automated by:** `tests/unit/venue-availability.test.ts` › "SCRUM-36 [AC6] TC-36-04: a venue with nothing in the range is free across every day of it, not empty"; `e2e/availability.spec.ts` › "SCRUM-36 [AC6] TC-36-04: a venue with nothing in the week reads as available throughout, not blank"

### TC-36-05

| Item | Content |
|---|---|
| Test Case ID | TC-36-05 |
| Test Scenario | [Positive, Boundary] AC 1: the view shows one calendar for a chosen venue and date range; a week at a time, and any week can be shown |
| Pre-conditions | — |
| Test Steps | 1. Open **Availability**. <br> 2. With **Go to date**, pick 1 Feb 2036 (a Friday). <br> 3. Click the next-week arrow, then the previous-week arrow twice. <br> 4. With **Go to date**, pick 20 Feb 2036 (a Wednesday). |
| Test Data | — |
| Expected Result | Step 1: this week, Monday to Sunday, today's column shaded. Step 2: "28 Jan – 3 Feb 2036" between the arrows, and seven days. Step 3: "4 – 10 Feb 2036", then "21 – 27 Jan 2036". Step 4: "18 – 24 Feb 2036". The venue, week and Go to date sit on one row. The week is in the address, so the view can be shared. |

**Automated by:** `tests/unit/availability-week.test.ts` › the three "SCRUM-36 [AC1] TC-36-05: …" cases, "SCRUM-36 [AC1] TC-36-05: walks back across a month and year end" and "SCRUM-36 [AC1] TC-36-05: ignores a malformed or impossible date"; `e2e/availability.spec.ts` › "SCRUM-36 [AC1] TC-36-05: the calendar shows a week, Monday to Sunday, and moves between weeks"

### TC-36-06

| Item | Content |
|---|---|
| Test Case ID | TC-36-06 |
| Test Scenario | [Positive] The calendar works with a screen reader and on a phone |
| Pre-conditions | — |
| Test Steps | 1. With a screen reader, move through the days. <br> 2. Open the calendar at 390 pixels wide. |
| Test Data | — |
| Expected Result | Step 1: each day is announced with the venue and date (e.g. "Exhibition Hall, Fri, 1 Feb 2036"), then each stretch as words ("Available midnight to 9:00 am"); a booking or unavailability also reads its details as its description. The coloured blocks and hour marks are hidden from screen readers. Step 2: the week becomes a list of seven days instead of seven columns, and nothing is wider than the screen. |

**Automated by:** `e2e/availability.spec.ts` › "SCRUM-36 TC-36-06: a screen reader hears the venue and date for each day" and "SCRUM-36 TC-36-06: the calendar works at phone width". Listening with a real screen reader is **Manual**.

### TC-36-07

| Item | Content |
|---|---|
| Test Case ID | TC-36-07 |
| Test Scenario | [Negative] AC 7: only Coordinators and Venue Staff can view the calendar |
| Pre-conditions | — |
| Test Steps | 1. As an Organiser, then as Technical Support, open `/venues/availability`. |
| Test Data | `organiser@test.local`, `techsupport@test.local` |
| Expected Result | "Access denied", and no Availability link in their navigation. |

**Automated by:** `tests/unit/auth.test.ts` › both "SCRUM-36 [AC7] TC-36-07: …" cases; `e2e/availability.spec.ts` › "SCRUM-36 [AC7] TC-36-07, SCRUM-37 [AC1, AC6] TC-37-03: who can see the calendar and record unavailability"; `e2e/access-control.spec.ts` › each role's navigation

### TC-36-08

| Item | Content |
|---|---|
| Test Case ID | TC-36-08 |
| Test Scenario | [Positive] Each booking or unavailability shows its key facts on the calendar, and hovering (or focusing, or tapping on a phone) it shows the rest |
| Pre-conditions | The booking and maintenance from TC-36-03. |
| Test Steps | 1. Hover the booked block. <br> 2. Hover the maintenance block. <br> 3. Tab to the booked block with the keyboard. |
| Test Data | — |
| Expected Result | On the calendar, the booking is a card showing "9:00 am – 1:00 pm", the event, the requester's initials and the attendance; the maintenance is a striped card showing "1:00 pm – 5:00 pm", "Maintenance" and its note. Step 1: a card with the event ("Approved — Research Symposium"), "Booked", the whole period, "Requested by Cody Coordinator", the expected attendance and the layout. Step 2: a card with the reason ("Maintenance"), "Unavailable", the whole period, the note and "Recorded by Vera Venue"; the booking's card closes. Step 3: the same card as step 1, and a screen reader reads it as the block's description. A period that crosses midnight shows its whole span, not just that day's part. The calendar is for internal staff only, so the event is named. |

**Automated by:** `e2e/availability.spec.ts` › "SCRUM-37 [AC1, AC2, AC5], SCRUM-36 [AC2, AC3, AC5]: maintenance is recorded, seen, refused over, and sat flush against a booking" (hover steps); `tests/unit/venue-availability.test.ts` › "SCRUM-36 — carries what a hover shows: the booking's event, requester and needs; the unavailability's note and recorder" and "SCRUM-36 — a stretch clipped to one day keeps the whole period in its details"

### TC-36-09

| Item | Content |
|---|---|
| Test Case ID | TC-36-09 |
| Test Scenario | [Positive] AC 2: a newly approved booking makes the venue read as unavailable on the calendar, and an open calendar picks it up |
| Pre-conditions | A Coordinator has a pending request for the Grand Auditorium, 10 Jan 2036, 9:00 am to 1:00 pm. |
| Test Steps | 1. Approve the request in **Bookings**. <br> 2. As the Coordinator, open **Availability** for the Grand Auditorium on 10 Jan 2036. <br> 3. Leave a calendar open while someone else approves a request; wait 15 seconds. |
| Test Data | As above |
| Expected Result | Step 2 shows "Booked 9:00 am to 1:00 pm" straight away. Approving refreshes the calendar page on the server. Step 3: the open calendar picks the change up within 15 seconds without a reload. |

**Automated by:** `e2e/availability.spec.ts` › "SCRUM-37 [AC1, AC2, AC5], SCRUM-36 [AC2, AC3, AC5]: maintenance is recorded, seen, refused over, and sat flush against a booking" (approval step); `tests/unit/bookings.test.ts` › "SCRUM-36 [AC2] TC-36-09: approving refreshes the availability calendar; rejecting does not need to"; `e2e/availability.spec.ts` › "SCRUM-36 [AC2] TC-36-09: an open calendar picks up a booking approved elsewhere, without a reload" (step 3).

Moved here from TC-37-01 on 2026-10-09.
