# SCRUM-38 — Search and filter venues by criteria and requirements

Test cases for [docs/backlog/SCRUM-38.md](../backlog/SCRUM-38.md). Format:
[README](README.md). Seeded accounts share the password `Password123!`.

Venue search is at `/venues/search`. Its criteria and filters are sent as one
GET, so they live in the URL. A venue is free when no Approved booking, live
hold or recorded unavailability overlaps the occupied period a booking for the
searched period would have there (SCRUM-159): the same check the request form
and Venue Staff's approval use (`findVenueBlockers` in
`lib/venue-availability.ts`). A date without times is searched as that whole
day, so a venue must be free for all of it.

Each result also has **See availability**, which opens that venue's calendar
(SCRUM-36) on the week searched, so a Coordinator who has found a candidate
can see the rest of its week before requesting it. It isn't an acceptance
criterion; TC-38-09's e2e test checks the link.

**Opening hours (AC4, AC15)** use SCRUM-34's hours, read the way booking
does (`dayOutsideOpeningHours` in `lib/venue-hours.ts`). A search opened from
an event, or with a start and an end time, is the booking period a request
would have, so a venue closed for any of it is excluded; setup and turnaround
never exclude one. A date searched without both times isn't a booking period:
as the whole day it would fall outside every venue's hours, so it excludes only
a venue Closed on a day searched (TC-38-20). That reading of AC4 is proposed
to the PO (2026-10-17) with SCRUM-190.

**Filters or suitability (AC8, AC11).** The attendance, facilities,
accessibility features and layout entered are the needs SCRUM-40 compares
each venue with. **Only show venues that fit** (on until the Coordinator
unticks it) applies them as filters, so every venue listed is Suitable;
unticked, every free venue is listed, each marked Suitable or Not suitable with
SCRUM-40's reasons. Opened from an event, the Coordinator's own judgement
(SCRUM-40 AC8) shows beside the automatic result.

| ID | Type | Criterion | Automated |
|---|---|---|---|
| [TC-38-01](#tc-38-01) | Positive | AC 1, AC 2 | Unit, e2e |
| [TC-38-02](#tc-38-02) | Positive | AC 1 | Unit, integration, e2e |
| [TC-38-03](#tc-38-03) | Negative | AC 1 | Unit |
| [TC-38-04](#tc-38-04) | Positive | AC 2 | Unit, integration |
| [TC-38-05](#tc-38-05) | Negative | AC 3 | Unit, integration |
| [TC-38-06](#tc-38-06) | Boundary | AC 5 | Integration |
| [TC-38-07](#tc-38-07) | Negative, Boundary | AC 6 | Unit, e2e |
| [TC-38-08](#tc-38-08) | Negative | AC 7 | Unit, integration |
| [TC-38-09](#tc-38-09) | Positive | AC 8 | Unit, e2e |
| [TC-38-10](#tc-38-10) | Positive | AC 9 | Unit, integration, e2e |
| [TC-38-11](#tc-38-11) | Positive | AC 10 | e2e |
| [TC-38-12](#tc-38-12) | Positive | AC 11, AC 13 | Unit, integration |
| [TC-38-13](#tc-38-13) | Boundary | AC 12 | Unit |
| [TC-38-14](#tc-38-14) | Positive | AC 14 | e2e |
| [TC-38-15](#tc-38-15) | Negative, Boundary | AC 4 | Unit, integration, e2e |
| [TC-38-16](#tc-38-16) | Boundary | AC 15 | Unit, integration |
| [TC-38-17](#tc-38-17) | Negative | AC 1, AC 2 | Unit, e2e |
| [TC-38-18](#tc-38-18) | Positive | AC 1 | Unit, e2e |
| [TC-38-20](#tc-38-20) | Negative | AC 4 | Unit, integration, e2e |

### TC-38-01

| Item | Content |
|---|---|
| Test Case ID | TC-38-01 |
| Test Scenario | [Positive] AC 1, AC 2: opened from an event, the period is fixed to the event's and the attendance starts as the event's |
| Pre-conditions | Signed in as the assigned Coordinator of a Planning event from 10:15 to 11:45, expecting 40. |
| Test Steps | 1. Open the event and choose **Find a venue**. <br> 2. Add `&date=…&from=…&endDate=…&to=…` to the address and open it. <br> 3. Change the attendance to 20 and search. |
| Test Data | `coordinator@test.local` |
| Expected Result | 1: the search shows exactly the event's period, 10:15 to 11:45, not rounded, with no start or end date or time fields; only Location can be added. Attendance is 40; no facility, accessibility feature or layout is chosen. The Organiser's venue requirements, preferred room layout and accessibility needs are shown read-only, exactly as entered (SCRUM-170 AC6). 2: the period and results are still the event's 10:15 to 11:45: dates in the address are ignored. 3: the attendance stays 20: the event's figure applies only when search is opened. |

**Automated by:** `tests/unit/venue-search-queries.test.ts` › "SCRUM-38 [AC1, AC2] TC-38-01: …"; `e2e/venue-search.spec.ts` › "SCRUM-38 [AC1, AC2, AC8, AC9, AC14] …" and "SCRUM-38 [AC1, AC8, AC11, AC14] TC-38-01, TC-38-09, TC-38-12: …"

### TC-38-02

| Item | Content |
|---|---|
| Test Case ID | TC-38-02 |
| Test Scenario | [Positive] AC 1: Find a replacement venue starts from the flagged booking request |
| Pre-conditions | A Planning event whose Approved booking at the Exhibition Hall, for 150 people with sound-system and banquet, is flagged Needs Reconsideration. |
| Test Steps | 1. Open the event; on the flagged booking choose **Find a replacement venue**. <br> 2. Untick sound-system and search. |
| Test Data | — |
| Expected Result | 1: "Finding a replacement for Exhibition Hall"; the period is the event's; attendance 150, sound-system ticked, banquet chosen. 2: sound-system stays unticked. |

**Automated by:** `tests/unit/venue-search-queries.test.ts` › "SCRUM-38 [AC1] TC-38-02: …"; `tests/integration/venue-search.test.ts` › "SCRUM-38 [AC1] TC-38-02: …"; `e2e/venue-search.spec.ts` › "SCRUM-38 [AC1] TC-38-02: …"

### TC-38-03

| Item | Content |
|---|---|
| Test Case ID | TC-38-03 |
| Test Scenario | [Negative] AC 1: search can't be opened for an event the Coordinator can't request a venue for |
| Pre-conditions | Various. |
| Test Steps | 1. Open search for another Coordinator's event, or an event that doesn't exist. <br> 2. For an Under Review event. <br> 3. For a Planning event with no dates. <br> 4. With a booking that isn't flagged, or belongs to another event. |
| Test Data | — |
| Expected Result | 1: "Event not found.", the same for both. 2: "Venues can be searched for an event once it has been approved." 3: "This event has no dates yet. Set them on the event before searching for a venue." 4: "That booking isn't flagged for reconsideration, so there is nothing to replace." No results are shown in any case. |

**Automated by:** `tests/unit/venue-search-queries.test.ts` › "SCRUM-38 [AC1] TC-38-03: …"

### TC-38-04

| Item | Content |
|---|---|
| Test Case ID | TC-38-04 |
| Test Scenario | [Positive] AC 2: on its own, date, time range and location work alone or together |
| Pre-conditions | Signed in as Coordinator; open **Venue Search** from the menu. |
| Test Steps | 1. Search with only a start date. <br> 2. Only a start and end time. <br> 3. Only a location, picked from the list: "Level 1, Block A". <br> 4. All three. <br> 5. Start 3 June 18:00, end 5 June 12:00. <br> 6. Start date 3 June and end date 5 June, no times. |
| Test Data | — |
| Expected Result | 1: free for that whole day. 2: free for that time today. 3: every venue at Level 1, Block A, without checking availability. 4: the venues there free for that time on that date. 5: free for the whole of 3 June 18:00 to 5 June 12:00. 6: free from the start of 3 June to the end of 5 June. The location list offers each active venue's location once, so a location can't be mistyped. |

**Automated by:** `tests/unit/venue-search-schema.test.ts` › "SCRUM-38 [AC2] TC-38-04: …"; `tests/integration/venue-search.test.ts` › "SCRUM-38 [AC2, AC7] TC-38-04, TC-38-08: …"

### TC-38-05

| Item | Content |
|---|---|
| Test Case ID | TC-38-05 |
| Test Scenario | [Negative] AC 3: a venue taken for the occupied period is excluded |
| Pre-conditions | A venue with 30 minutes' setup and 30 minutes' turnaround. |
| Test Steps | 1. Approve a booking there from 14:00 to 16:00, then search 16:15 to 17:00. <br> 2. Hold it instead. <br> 3. Record unavailability over the period instead. <br> 4. Leave it Pending, or let the hold expire. |
| Test Data | — |
| Expected Result | 1–3: the venue is excluded: the booking occupies it until 16:30, and a search from 16:15 would occupy it from 15:45. 4: the venue is included: a Pending request or an expired hold blocks nobody. |

**Automated by:** `tests/unit/venue-search.test.ts` › "SCRUM-38 [AC3] TC-38-05: …"; `tests/integration/venue-search.test.ts` › "SCRUM-38 [AC3] TC-38-05: …"

### TC-38-06

| Item | Content |
|---|---|
| Test Case ID | TC-38-06 |
| Test Scenario | [Boundary] AC 5: occupied periods that only touch don't overlap |
| Pre-conditions | As TC-38-05, with the booking from 14:00 to 16:00 (occupying 13:30 to 16:30). |
| Test Steps | 1. Search 17:00 to 18:00 (occupying 16:30 to 18:30). <br> 2. Search 16:59 to 18:00. |
| Test Data | — |
| Expected Result | 1: included: the two occupied periods touch at 16:30. 2: excluded: they overlap by a minute. |

**Automated by:** `tests/integration/venue-search.test.ts` › "SCRUM-38 [AC5] TC-38-06: …"

### TC-38-07

| Item | Content |
|---|---|
| Test Case ID | TC-38-07 |
| Test Scenario | [Negative] [Boundary] AC 6: an end not after the start is refused |
| Pre-conditions | Venue search on its own. |
| Test Steps | 1. Search 15:00 to 15:00 on one day. <br> 2. 15:00 to 14:00 on one day. <br> 3. 15:00 to 15:01 on one day. <br> 4. End date before the start date. <br> 5. 18:00 one day to 09:00 the next. |
| Test Data | — |
| Expected Result | 1, 2, 4: "The time range is invalid: the end must be after the start." beside the end time, or the end date when no end time was entered, and no results. 3, 5: searched, not refused as invalid. 5 lists no venue, because a booking period running past midnight is outside every venue's opening hours (AC4, SCRUM-34 AC7). |

**Automated by:** `tests/unit/venue-search-schema.test.ts` › "SCRUM-38 [AC6] TC-38-07: …"; `e2e/venue-search.spec.ts` › "SCRUM-38 [AC6, AC10] TC-38-07, TC-38-11: …"

### TC-38-08

| Item | Content |
|---|---|
| Test Case ID | TC-38-08 |
| Test Scenario | [Negative] AC 7: retired venues never appear |
| Pre-conditions | A retired venue that would otherwise match. |
| Test Steps | 1. Search with no criteria. <br> 2. Search for its location, where an active venue also is. |
| Test Data | — |
| Expected Result | It appears in neither. |

**Automated by:** `tests/unit/venue-search.test.ts` › "SCRUM-38 [AC7] TC-38-08: …"; `tests/integration/venue-search.test.ts` › "SCRUM-38 [AC2, AC7] TC-38-04, TC-38-08: …"

### TC-38-09

| Item | Content |
|---|---|
| Test Case ID | TC-38-09 |
| Test Scenario | [Positive] AC 8: each result shows name, location, capacity and SCRUM-40's suitability indicator |
| Pre-conditions | Seeded venues; a Planning event expecting 40. |
| Test Steps | 1. Search for location "Level 1, Block A". <br> 2. Open search from the event. <br> 3. Untick **Only show venues that fit** and search. <br> 4. With the filters off, enter attendance 100, facility stage, accessibility hearing-loop and layout banquet for a 60-seat room with a projector, wheelchair access and classroom and theatre layouts. |
| Test Data | `coordinator@test.local` |
| Expected Result | 1: Grand Auditorium, Level 1, Block A, Capacity 500. 2: every venue listed is Suitable, with no reasons. 3: the Executive Boardroom is listed too, Not suitable: "Capacity 14 < attendance 40". 4: Not suitable, with "Capacity 60 < attendance 100", "Missing facility: stage", "No hearing loop; event needs hearing loop" and "Banquet layout not supported" (SCRUM-40 AC6). |

**Automated by:** `tests/unit/venue-search.test.ts` › "SCRUM-38 [AC8] TC-38-09: …"; `e2e/venue-search.spec.ts` › "SCRUM-38 [AC1, AC2, AC8, AC9, AC14] …" and "SCRUM-38 [AC1, AC8, AC11, AC14] TC-38-01, TC-38-09, TC-38-12: …"

### TC-38-10

| Item | Content |
|---|---|
| Test Case ID | TC-38-10 |
| Test Scenario | [Positive] AC 9: Request this venue opens the booking form; a venue already requested offers no second request |
| Pre-conditions | As TC-38-01; the event has a Pending request at Seminar Room 2.1. |
| Test Steps | 1. Search. <br> 2. Choose **Request this venue** on the Exhibition Hall. |
| Test Data | — |
| Expected Result | 1: Seminar Room 2.1 reads "Already requested for this event", with no button; a rejected, cancelled or expired booking doesn't count. 2: the request form opens with the event and the Exhibition Hall chosen. |

**Automated by:** `tests/unit/venue-search.test.ts` › "SCRUM-38 [AC9] TC-38-10: …"; `tests/integration/venue-search.test.ts` › "SCRUM-38 [AC9] TC-38-10: …"; `e2e/venue-search.spec.ts` › "SCRUM-38 [AC1, AC2, AC8, AC9, AC14] …"

### TC-38-11

| Item | Content |
|---|---|
| Test Case ID | TC-38-11 |
| Test Scenario | [Positive] AC 10: nothing matches |
| Pre-conditions | Venue search on its own. |
| Test Steps | 1. Search for location "Level 12, Block A" with attendance 100. |
| Test Data | — |
| Expected Result | "No venues match", not an empty list: the only venue there, the Executive Boardroom, holds 14. |

**Automated by:** `e2e/venue-search.spec.ts` › "SCRUM-38 [AC6, AC10] TC-38-07, TC-38-11: …"

### TC-38-12

| Item | Content |
|---|---|
| Test Case ID | TC-38-12 |
| Test Scenario | [Positive] AC 11, AC 13: filters apply alone or together; several facilities or features must all be there |
| Pre-conditions | Seeded venues. |
| Test Steps | 1. Filter by facility projector. <br> 2. Projector and stage. <br> 3. Accessibility wheelchair-access and hearing-loop. <br> 4. Layout banquet. <br> 5. Projector with location "Level 2, Block B". <br> 6. Untick **Only show venues that fit** and search again. |
| Test Data | — |
| Expected Result | 1: Grand Auditorium, Seminar Room 2.1. 2: Grand Auditorium. 3: Grand Auditorium. 4: Exhibition Hall. 5: Seminar Room 2.1. 6: the venues the filters left out are listed too, each Not suitable with the reason (TC-38-09); the box stays unticked when the search changes (AC14). |

**Automated by:** `tests/unit/venue-search.test.ts` › "SCRUM-38 [AC11] TC-38-12: …" and "SCRUM-38 [AC13] TC-38-12: …"; `tests/unit/venue-search-schema.test.ts` › "SCRUM-38 [AC11] TC-38-12: …"; `tests/integration/venue-search.test.ts` › "SCRUM-38 [AC11, AC13] TC-38-12: …"; `e2e/venue-search.spec.ts` › "SCRUM-38 [AC1, AC8, AC11, AC14] TC-38-01, TC-38-09, TC-38-12: …"

### TC-38-13

| Item | Content |
|---|---|
| Test Case ID | TC-38-13 |
| Test Scenario | [Boundary] AC 12: capacity equal to the attendance fits; below it doesn't |
| Pre-conditions | A venue holding 60. |
| Test Steps | 1. Attendance 60. <br> 2. Attendance 61. <br> 3. Attendance 61 lowered to 60. |
| Test Data | — |
| Expected Result | 1, 3: included. 2: excluded. |

**Automated by:** `tests/unit/venue-search.test.ts` › "SCRUM-38 [AC12] TC-38-13: …"

### TC-38-14

| Item | Content |
|---|---|
| Test Case ID | TC-38-14 |
| Test Scenario | [Positive] AC 14: filters stay applied when the criteria change |
| Pre-conditions | As TC-38-01. |
| Test Steps | 1. Tick a facility and search. <br> 2. Change the location and search again. |
| Test Data | — |
| Expected Result | The facility is still ticked and still filters the results. |

**Automated by:** `e2e/venue-search.spec.ts` › "SCRUM-38 [AC1, AC2, AC8, AC9, AC14] …"

### TC-38-15

| Item | Content |
|---|---|
| Test Case ID | TC-38-15 |
| Test Scenario | [Negative] [Boundary] AC 4: a venue closed for part of the booking period is excluded; one open for all of it is kept |
| Pre-conditions | SCRUM-34's opening hours; a venue open 09:00 to 18:00 on weekdays and Closed at weekends; seeded venues. |
| Test Steps | 1. Search a Tuesday 15:00 to 18:01. <br> 2. 08:59 to 12:00. <br> 3. 09:00 to 18:00. <br> 4. A Saturday 10:00 to 12:00. <br> 5. Seeded venues, a Tuesday 07:30 to 09:00. |
| Test Data | — |
| Expected Result | 1, 2, 4: excluded. 3: included: exactly at opening and closing is within (SCRUM-34 AC7). A venue with no hours recorded is included in every case. 5: Exhibition Hall (opens 06:00) and Grand Auditorium (07:00); not Seminar Room 2.1 (08:00) or the Executive Boardroom (09:00). |

**Automated by:** `tests/unit/venue-search.test.ts` › "SCRUM-38 [AC4] TC-38-15: …"; `tests/integration/venue-search.test.ts` › "SCRUM-38 [AC4, AC15] TC-38-15, TC-38-16: …"; `e2e/venue-search.spec.ts` › "SCRUM-38 [AC4, AC15] TC-38-15, TC-38-20: …"

### TC-38-16

| Item | Content |
|---|---|
| Test Case ID | TC-38-16 |
| Test Scenario | [Boundary] AC 15: only setup or turnaround outside opening hours keeps the venue |
| Pre-conditions | As TC-38-15, with 60 minutes' setup and turnaround. |
| Test Steps | 1. Search a Tuesday 09:00 to 18:00. |
| Test Data | — |
| Expected Result | Included: the booking period is within the hours; only its setup and turnaround aren't, which Venue Staff decide (SCRUM-159 AC9). Availability is still checked over 08:00 to 19:00 (AC3). |

**Automated by:** `tests/unit/venue-search.test.ts` › "SCRUM-38 [AC15] TC-38-16: …"; `tests/integration/venue-search.test.ts` › "SCRUM-38 [AC4, AC15] TC-38-15, TC-38-16: …"

### TC-38-17

| Item | Content |
|---|---|
| Test Case ID | TC-38-17 |
| Test Scenario | [Negative] AC 1, AC 2: only Coordinators can search venues |
| Pre-conditions | — |
| Test Steps | 1. Open `/venues/search` as the Organiser, Venue Staff, Technical Support and an Attendee. |
| Test Data | `organiser@test.local`, `venuestaff@test.local`, `techsupport@test.local`, `attendee@test.local` |
| Expected Result | Refused, and **Venue Search** isn't in their menus. A Coordinator sees it. |

**Automated by:** `tests/unit/nav.test.ts` (the `/venues/search` route); `e2e/access-control.spec.ts` › "organiser is refused the Coordinator-only venue search (/venues/search)" and "SCRUM-66 — each role's navigation shows only its own links"

### TC-38-18

| Item | Content |
|---|---|
| Test Case ID | TC-38-18 |
| Test Scenario | [Positive] AC 1: opened from the menu, choosing one of my events in the search opens it for that event |
| Pre-conditions | Signed in as the assigned Coordinator of a Planning event with dates, expecting 40; open **Venue Search** from the menu. |
| Test Steps | 1. In **For event**, choose the event. <br> 2. Choose **None: search any period**. <br> 3. From a flagged booking's Find a replacement venue, choose another event. |
| Test Data | `coordinator@test.local` |
| Expected Result | 1: as TC-38-01: the event's period, attendance 40, and Request this venue on each result. The list offers only events the Coordinator can request a venue for that have dates. 2: back to the search on its own, with date and time fields. 3: the search is for the other event, starting from its values; the replacement is left behind. |

**Automated by:** `tests/unit/venue-search-schema.test.ts` › "SCRUM-38 [AC1] TC-38-18: …"; `e2e/venue-search.spec.ts` › "SCRUM-38 [AC1] TC-38-18: …"

### TC-38-19

Retired on 2026-10-16, before it was merged: a date-only search listing venues free at some point went beyond AC3, so a date alone is searched as that whole day (TC-38-04).

### TC-38-20

| Item | Content |
|---|---|
| Test Case ID | TC-38-20 |
| Test Scenario | [Negative] AC 4: a date searched without times excludes only a venue Closed on a day searched |
| Pre-conditions | As TC-38-15; seeded venues. |
| Test Steps | 1. Search a Tuesday, no times. <br> 2. A Saturday, no times. <br> 3. A Friday to the Saturday, no times. <br> 4. Seeded venues, a Saturday, no times. <br> 5. Seeded venues, a Tuesday, no times. |
| Test Data | — |
| Expected Result | 1: included, though the venue isn't open all day. 2, 3: excluded. 4: Exhibition Hall and Grand Auditorium only; Seminar Room 2.1 and the Executive Boardroom are Closed at weekends. 5: all four. |

**Automated by:** `tests/unit/venue-hours.test.ts` › "SCRUM-38 [AC4] TC-38-20: …"; `tests/unit/venue-search.test.ts` › "SCRUM-38 [AC4] TC-38-20: …"; `tests/integration/venue-search.test.ts` › "SCRUM-38 [AC4] TC-38-20: …"; `e2e/venue-search.spec.ts` › "SCRUM-38 [AC4, AC15] TC-38-15, TC-38-20: …"
