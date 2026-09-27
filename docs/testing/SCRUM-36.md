# SCRUM-36 — View Venue Availability: test cases

Story and acceptance criteria: [docs/backlog/SCRUM-36.md](../backlog/SCRUM-36.md).
Format and conventions: [README.md](README.md). How a day is split into
stretches: `availabilityByDay` in [lib/venue-availability.ts](../../lib/venue-availability.ts),
which decides overlap with the one rule in [lib/period.ts](../../lib/period.ts).

**Shared pre-conditions for every case:** the database is migrated and seeded,
the app is running, and the tester signs in as an Event Coordinator
(`coordinator@test.local` / `Password123!`) unless the case says otherwise.
Times are Singapore time.

**AC 2 (the team's choice):** one calendar per venue, picked from a list,
rather than one grid across every venue. A single venue over a fortnight stays
readable on a phone and to a screen reader, where a grid of every venue would
not.

| ID | Type | Criterion | Automated |
|---|---|---|---|
| [TC-36-01](#tc-36-01) | Positive | AC 1, AC 3 | Unit, e2e |
| [TC-36-02](#tc-36-02) | Positive | AC 4 | Unit, e2e |
| [TC-36-03](#tc-36-03) | Boundary | AC 5 | Unit, e2e |
| [TC-36-04](#tc-36-04) | Positive | AC 6 | Unit, e2e |
| [TC-36-05](#tc-36-05) | Positive, Boundary | AC 7 | Unit, e2e |
| [TC-36-06](#tc-36-06) | Positive | Screen readers and phones | e2e |
| [TC-36-07](#tc-36-07) | Negative | Coordinators and Venue Staff only | Unit, e2e |

---

### TC-36-01

| Item | Content |
|---|---|
| Test Case ID | TC-36-01 |
| Test Scenario | [Positive] AC 1, AC 3: a venue's calendar shows available and unavailable periods; an approved booking reads as unavailable |
| Pre-conditions | An approved booking on the Grand Auditorium, 10 Jan 2036, 9:00 am to 1:00 pm. |
| Test Steps | 1. Open **Availability**. <br> 2. Choose the Grand Auditorium, From and To 10 Jan 2036. |
| Test Data | — |
| Expected Result | The day reads "Available midnight to 9:00 am", "Booked 9:00 am to 1:00 pm", "Available 1:00 pm to midnight", with a solid bar for the booking. A pending request does not appear. |

**Automated by:** `tests/unit/venue-availability.test.ts` › "SCRUM-36 AC3 — an approved booking reads as unavailable, with free time either side"; `e2e/availability.spec.ts` › "SCRUM-37 AC2-5, SCRUM-36 AC3-5 — …"

### TC-36-02

| Item | Content |
|---|---|
| Test Case ID | TC-36-02 |
| Test Scenario | [Positive] AC 4: recorded unavailability reads as unavailable and is visibly different from a booking, not by colour alone |
| Pre-conditions | Maintenance recorded on the Grand Auditorium, 10 Jan 2036, 1:00 pm to 5:00 pm. |
| Test Steps | 1. Open the calendar for that day. <br> 2. Compare it with a booked stretch and the legend. |
| Test Data | — |
| Expected Result | "Unavailable (maintenance) 1:00 pm to 5:00 pm", with a wrench icon and a striped bar. A booking has a calendar icon, the word "Booked" and a solid bar. They differ in label, icon and pattern, as well as colour. |

**Automated by:** `tests/unit/venue-availability.test.ts` › "SCRUM-36 AC4 — recorded maintenance reads as unavailable and stays distinguishable from a booking"; `e2e/availability.spec.ts` › journey

### TC-36-03

| Item | Content |
|---|---|
| Test Case ID | TC-36-03 |
| Test Scenario | [Boundary] AC 5: where one unavailable period ends exactly as another begins, no gap is shown and no time is counted twice |
| Pre-conditions | The booking from TC-36-01 and the maintenance from TC-36-02: 9:00 am to 1:00 pm, then 1:00 pm to 5:00 pm. |
| Test Steps | 1. Open the calendar for 10 Jan 2036. |
| Test Data | — |
| Expected Result | The day lists, in order: Available midnight to 9:00 am, Booked 9:00 am to 1:00 pm, Unavailable (maintenance) 1:00 pm to 5:00 pm, Available 5:00 pm to midnight. There is no "Available" between the two, and each stretch starts where the last ended. A period crossing midnight splits between the two days; one ending at midnight does not spill into the next. |

**Automated by:** `tests/unit/venue-availability.test.ts` › "SCRUM-36 AC5 — two periods meeting at an endpoint show no gap, and no moment is counted twice" and "SCRUM-36 — a period across midnight is split between the two days…"; `e2e/availability.spec.ts` › journey

### TC-36-04

| Item | Content |
|---|---|
| Test Case ID | TC-36-04 |
| Test Scenario | [Positive] AC 6: a venue with nothing in the range shows as available throughout, not as an empty view |
| Pre-conditions | Nothing on the Executive Boardroom, 1 to 7 Jun 2036. |
| Test Steps | 1. Open the calendar for the Executive Boardroom, 1 to 7 Jun 2036. |
| Test Data | — |
| Expected Result | "Executive Boardroom is available for the whole range, …", and seven days each reading "Available all day". |

**Automated by:** `tests/unit/venue-availability.test.ts` › "SCRUM-36 AC6 — a venue with nothing in the range is free across every day of it, not empty"; `e2e/availability.spec.ts` › "SCRUM-36 AC6 — a venue with nothing in the range reads as available throughout, not blank"

### TC-36-05

| Item | Content |
|---|---|
| Test Case ID | TC-36-05 |
| Test Scenario | [Positive, Boundary] AC 7: the view can be filtered by date range |
| Pre-conditions | — |
| Test Steps | 1. Open **Availability** with no range. <br> 2. Choose From 1 Feb 2036 and To 3 Feb 2036. <br> 3. Choose a To earlier than From. <br> 4. Choose a range longer than 31 days. |
| Test Data | — |
| Expected Result | Step 1: two weeks from today. Step 2: three days, headed "1 Feb 2036 to 3 Feb 2036". Step 3: the dates are swapped rather than showing nothing. Step 4: the first 31 days. The range is in the address, so the view can be shared. |

**Automated by:** `tests/unit/availability-range.test.ts` › the four "SCRUM-36 AC7 — …" cases, "swaps an end before the start…", "cuts a range longer than 31 days to 31" and "ignores a malformed or impossible date"; `e2e/availability.spec.ts` › "SCRUM-36 AC7 — the calendar can be narrowed to a date range"

### TC-36-06

| Item | Content |
|---|---|
| Test Case ID | TC-36-06 |
| Test Scenario | [Positive] The calendar works with a screen reader and on a phone |
| Pre-conditions | — |
| Test Steps | 1. With a screen reader, move through the days. <br> 2. Open the calendar at 390 pixels wide. |
| Test Data | — |
| Expected Result | Step 1: each day is announced with the venue and date (e.g. "Exhibition Hall, Fri, 1 Feb 2036"), then each stretch as words ("Available midnight to 9:00 am"). The bar itself is hidden from screen readers. Step 2: nothing is wider than the screen; days stack. |

**Automated by:** `e2e/availability.spec.ts` › "SCRUM-36 — a screen reader hears the venue and date for each day" and "SCRUM-36 — the calendar works at phone width". Listening with a real screen reader is **Manual**.

### TC-36-07

| Item | Content |
|---|---|
| Test Case ID | TC-36-07 |
| Test Scenario | [Negative] Only Coordinators and Venue Staff can view the calendar |
| Pre-conditions | — |
| Test Steps | 1. As an Organiser, then as Technical Support, open `/venues/availability`. |
| Test Data | `organiser@test.local`, `techsupport@test.local` |
| Expected Result | "Access denied", and no Availability link in their navigation. |

**Automated by:** `tests/unit/auth.test.ts` › both "SCRUM-36 AC1 — …" cases; `e2e/availability.spec.ts` › "SCRUM-36 / SCRUM-37 — who can see the calendar and record unavailability"; `e2e/access-control.spec.ts` › each role's navigation
