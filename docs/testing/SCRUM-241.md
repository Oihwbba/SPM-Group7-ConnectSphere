# SCRUM-241 — The venue availability calendar shows closed hours as available: test cases

SCRUM-241 is a Bug task in Jira, raised from a teammate's report during the
SCRUM-7 epic check (SCRUM-214). Its acceptance criteria, as filed:

1. Times outside the venue's opening hours, and days marked Closed, show as
   unavailable on the calendar.
2. Closed hours look different from bookings and from recorded unavailability.
3. Opening and closing times are boundaries: a slot that starts exactly at
   opening or ends exactly at closing shows as available.
4. A venue with no opening hours recorded still shows as available all day, as
   it does today.

Format and conventions: [README.md](README.md).

**Why it failed:** the calendar never read the venue's opening hours
(SCRUM-34), so it showed every hour as available, though a booking outside
them is refused (SCRUM-34 AC7). That went against SCRUM-36 AC1: the calendar
shows the venue's available and unavailable periods. The fix adds closed hours
to the calendar as their own kind of stretch, shown under anything else at
that time; why: [ADR 0023](../adr/0023-closed-hours-on-the-availability-calendar.md).

**Shared pre-conditions:** the unit cases build the calendar from stubbed
entries and opening hours, Mon 12 to Sun 18 Mar 2035: Mon–Fri 09:00–18:00,
Saturday marked Closed, no row for Sunday. TC-241-08 reads the seeded
Executive Boardroom (Mon–Fri 09:00–18:00, Closed at the weekend) and writes
nothing.

| ID | Type | Criterion | Automated |
|---|---|---|---|
| [TC-241-01](#tc-241-01) | Positive | AC 1 | Unit |
| [TC-241-02](#tc-241-02) | Positive | AC 1 | Unit |
| [TC-241-03](#tc-241-03) | Boundary | AC 3 | Unit |
| [TC-241-04](#tc-241-04) | Negative | AC 4 | Unit |
| [TC-241-05](#tc-241-05) | Boundary | AC 1, AC 2 | Unit |
| [TC-241-06](#tc-241-06) | Positive | AC 1 | Unit |
| [TC-241-07](#tc-241-07) | Positive | AC 2 | Unit |
| [TC-241-08](#tc-241-08) | Positive | AC 1, AC 2, AC 3 | e2e |

---

### TC-241-01

| Item | Content |
|---|---|
| Test Case ID | TC-241-01 |
| Test Scenario | [Positive] AC 1: the hours before opening and after closing show as closed, with the opening hours available between |
| Pre-conditions | The venue is open 09:00–18:00 on Mondays; nothing is booked |
| Test Steps | 1. Build Monday 12 Mar 2035 on the calendar. |
| Test Data | Opening hours Mon 09:00–18:00 |
| Expected Result | Closed midnight to 9:00 am, Available 9:00 am to 6:00 pm, Closed 6:00 pm to midnight. |

**Automated by:** `tests/unit/venue-availability.test.ts` › "SCRUM-241 [AC1] TC-241-01: before opening and after closing show as closed, with the opening hours available between"

### TC-241-02

| Item | Content |
|---|---|
| Test Case ID | TC-241-02 |
| Test Scenario | [Positive] AC 1: a day marked Closed, and a weekday with no hours once other days have them, are closed all day |
| Pre-conditions | Saturday is marked Closed; Sunday has no row |
| Test Steps | 1. Build the week of 12 to 18 Mar 2035. |
| Test Data | The shared opening hours |
| Expected Result | Saturday and Sunday are each one closed stretch from midnight to midnight; Friday is closed, available, closed. |

**Automated by:** `tests/unit/venue-availability.test.ts` › "SCRUM-241 [AC1] TC-241-02: a day marked Closed, and a weekday with no hours once others have them, are closed all day"

### TC-241-03

| Item | Content |
|---|---|
| Test Case ID | TC-241-03 |
| Test Scenario | [Boundary] AC 3: opening and closing are boundaries |
| Pre-conditions | Step 1: open 09:00–18:00 with a booking from 09:00 to 18:00. Step 2: open 00:00–23:59, nothing booked. |
| Test Steps | 1. Build Monday with the booking. <br> 2. Build Monday for the venue open from midnight. |
| Test Data | Booking 09:00–18:00; opening hours 00:00–23:59 |
| Expected Result | Step 1: closed to 9:00 am, booked 9:00 am to 6:00 pm, closed from 6:00 pm, with no available sliver between. Step 2: no closed stretch before opening; available midnight to 11:59 pm, closed for the last minute. |

**Automated by:** `tests/unit/venue-availability.test.ts` › "SCRUM-241 [AC3] TC-241-03: opening and closing are boundaries: a booking from exactly opening to exactly closing sits flush against the closed hours, with no free sliver", "SCRUM-241 [AC3] TC-241-03: a venue that opens at midnight has no closed stretch before opening, and one open until 23:59 is closed for the last minute only"

### TC-241-04

| Item | Content |
|---|---|
| Test Case ID | TC-241-04 |
| Test Scenario | [Negative] AC 4: a venue with no opening hours recorded has no closed hours |
| Pre-conditions | The venue has no opening hours (from before SCRUM-34) |
| Test Steps | 1. Build the week of 12 to 18 Mar 2035. |
| Test Data | No opening hours |
| Expected Result | No closed stretches; each day is available from midnight to midnight, as before this fix. |

**Automated by:** `tests/unit/venue-availability.test.ts` › "SCRUM-241 [AC4] TC-241-04: a venue with no opening hours recorded has no closed hours, and stays available all day"

### TC-241-05

| Item | Content |
|---|---|
| Test Case ID | TC-241-05 |
| Test Scenario | [Boundary] AC 1, AC 2: something on the calendar during closed hours shows as itself |
| Pre-conditions | Open 09:00–18:00; a booking 16:00–18:00 whose turnaround runs to 18:30 (allowed, SCRUM-159 AC9); maintenance 02:00–04:00 |
| Test Steps | 1. Build Monday. |
| Test Data | As above |
| Expected Result | Closed to 2:00 am, unavailable 2:00 to 4:00 am, closed 4:00 to 9:00 am, available 9:00 am to 4:00 pm, booked 4:00 to 6:00 pm, turnaround 6:00 to 6:30 pm, closed from 6:30 pm. |

**Automated by:** `tests/unit/venue-availability.test.ts` › "SCRUM-241 [AC1, AC2] TC-241-05: a booking's turnaround past closing, and unavailability overnight, show as themselves over the closed hours"

### TC-241-06

| Item | Content |
|---|---|
| Test Case ID | TC-241-06 |
| Test Scenario | [Positive] AC 1: the week grid and the phone list both show closed hours |
| Pre-conditions | The shared opening hours; nothing booked |
| Test Steps | 1. Render the calendar for the week. <br> 2. Read Monday on the grid and in the phone list. <br> 3. Read Saturday and Sunday. <br> 4. Check where the grid opens. |
| Test Data | — |
| Expected Result | Step 2: "Closed midnight to 9:00 am SGT", "Available 9:00 am SGT to 6:00 pm SGT", "Closed 6:00 pm SGT to midnight", in both views; Monday doesn't say "Available all day". Step 3: each says "Closed all day" at the top of its column and never "Available". Step 4: the grid still opens at 7 am, not at midnight. |

**Automated by:** `tests/unit/availability-calendar.test.tsx` › "SCRUM-241 [AC1] TC-241-06: an open day reads as closed, then available in its opening hours, then closed, on the grid and on a phone", "SCRUM-241 [AC1] TC-241-06: a Closed day says Closed all day at the top of its column, and never Available", "SCRUM-241 [AC1] TC-241-06: closed hours from midnight don't scroll the grid to midnight; it still opens at 7 am"

### TC-241-07

| Item | Content |
|---|---|
| Test Case ID | TC-241-07 |
| Test Scenario | [Positive] AC 2: closed hours look different from bookings and from unavailability |
| Pre-conditions | The shared opening hours, a booking on Monday and maintenance on Tuesday |
| Test Steps | 1. Render the calendar. <br> 2. Read the legend. |
| Test Data | — |
| Expected Result | Closed hours are their own kind, greyed out and styled differently from the booking, with nothing to hover or open. The legend lists "Closed" with its own door icon, beside "Booked" and "Unavailable". |

**Automated by:** `tests/unit/availability-calendar.test.tsx` › "SCRUM-241 [AC2] TC-241-07: closed hours are their own kind, with their own label and icon in the legend, and nothing to open"

### TC-241-08

| Item | Content |
|---|---|
| Test Case ID | TC-241-08 |
| Test Scenario | [Positive] AC 1, AC 2, AC 3: in the browser, a seeded venue's week reads as available in its opening hours and closed outside them |
| Pre-conditions | Signed in as the seeded Event Coordinator; nothing booked on the Executive Boardroom in the week of 2 to 8 Jun 2036 |
| Test Steps | 1. Open **Venue availability** for the Executive Boardroom and go to 4 Jun 2036. <br> 2. Read Monday and Friday. <br> 3. Read Saturday and Sunday. <br> 4. Read the legend. |
| Test Data | `coordinator@test.local` / `Password123!` |
| Expected Result | Step 2: Closed midnight to 9:00 am SGT, Available 9:00 am SGT to 6:00 pm SGT, Closed 6:00 pm SGT to midnight. Step 3: "Closed all day" at the top of each column. Step 4: the legend includes Closed, and the closed hours are filled grey. |

**Automated by:** `e2e/availability.spec.ts` › "SCRUM-36 [AC6] TC-36-04, SCRUM-241 [AC1, AC2, AC3] TC-241-08: a venue with nothing in the week reads as available in its opening hours and closed outside them, never blank"
