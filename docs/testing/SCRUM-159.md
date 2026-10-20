# SCRUM-159 — Include setup and turnaround time when checking venue availability: test cases

Story and acceptance criteria: [docs/backlog/SCRUM-159.md](../backlog/SCRUM-159.md).
Format and conventions: [README.md](README.md). The database rules (occupied
periods, the minutes stored on a booking) came with SCRUM-172; why the
application and the database compare the same periods:
[ADR 0010, 2026-10-08 and 2026-10-12 addenda](../adr/0010-database-prevents-venue-double-booking.md).

**Shared pre-conditions for every case:** the database is migrated and seeded
and the app is running. Unless the case says otherwise, the venue has 30
minutes' setup and 45 minutes' turnaround, and an approved booking from
10:00 to 12:00 (occupying 09:30 to 12:45). Times are Singapore time. Requests
are signed in as `coordinator@test.local`, approvals as
`venuestaff@test.local` (both `Password123!`).

**What this story doesn't cover:**

- **AC6** was removed on 2026-10-09: refusing a request, hold or approval
  outside opening hours is SCRUM-34 AC7.
- **AC1's form** is SCRUM-34's venue edit, which uses the shared rule
  `venueTimesSchema` (lib/schemas/venue.ts) tested here; the database refuses
  the same values.
- **AC3's search:** venue search is SCRUM-38's. It uses the same
  lookup (`findVenueBlockers`) and database constraint, so it inherits the
  occupied period without a second rule. Placing a hold (SCRUM-163) checks the
  occupied period and keeps the venue's minutes (TC-159-17), and a live hold
  blocks like an approval (TC-159-15, TC-159-16).
- A request's period is its event's, rounded out to the half hour (SCRUM-50
  AC1), so a request for 13:15 can't be made in the app. The criterion's
  exact 13:15 example is proven in unit tests; the integration and e2e tests
  use half-hour equivalents.

| ID | Type | Criterion | Automated |
|---|---|---|---|
| [TC-159-01](#tc-159-01) | Positive | AC 1 | Unit |
| [TC-159-02](#tc-159-02) | Negative | AC 1 | Unit, integration |
| [TC-159-03](#tc-159-03) | Positive | AC 1 | Integration |
| [TC-159-04](#tc-159-04) | Positive | AC 2 | Unit |
| [TC-159-05](#tc-159-05) | Negative | AC 3 | Unit, integration, e2e |
| [TC-159-06](#tc-159-06) | Negative | AC 3 | Unit, integration, e2e |
| [TC-159-07](#tc-159-07) | Negative | AC 3 | Unit, integration |
| [TC-159-08](#tc-159-08) | Boundary | AC 4 | Unit, integration |
| [TC-159-09](#tc-159-09) | Concurrency | AC 5 | Integration |
| [TC-159-10](#tc-159-10) | Positive | AC 7 | Unit, integration, e2e |
| [TC-159-11](#tc-159-11) | Boundary | AC 7 | Unit |
| [TC-159-12](#tc-159-12) | Positive | AC 8 | Unit, integration |
| [TC-159-13](#tc-159-13) | Boundary | AC 8 | Integration |
| [TC-159-14](#tc-159-14) | Positive | AC 3 | Unit |
| [TC-159-15](#tc-159-15) | Negative | AC 3 | Unit, integration |
| [TC-159-16](#tc-159-16) | Boundary | AC 3 | Integration |
| [TC-159-17](#tc-159-17) | Negative, Positive | AC 3, AC 8 | Unit |
| [TC-159-18](#tc-159-18) | Positive | AC 9 | Unit, integration, e2e |
| [TC-159-19](#tc-159-19) | Boundary, Negative | AC 9 | Unit |

---

### TC-159-01

| Item | Content |
|---|---|
| Test Case ID | TC-159-01 |
| Test Scenario | [Positive] AC 1: setup and turnaround times that are whole numbers of minutes from 0 to 1,440 are accepted |
| Pre-conditions | — |
| Test Steps | 1. Validate each pair below with the shared venue-times rule. |
| Test Data | 0 and 0; 30 and 45; 1440 and 1440; "30" and "45" (as a form sends them) |
| Expected Result | Each is accepted, as numbers. |

**Automated by:** `tests/unit/venue-times.test.ts` › "SCRUM-159 [AC1] TC-159-01: whole minutes from 0 to 1,440 are accepted, including both ends and form strings"

### TC-159-02

| Item | Content |
|---|---|
| Test Case ID | TC-159-02 |
| Test Scenario | [Negative] AC 1: any other value is refused and the field is named |
| Pre-conditions | — |
| Test Steps | 1. Validate each setup time below with a valid turnaround time. <br> 2. Validate a turnaround time of 1441. <br> 3. Write each value to a venue directly in the database. |
| Test Data | Setup -1, 1441, 30.5, blank, "abc", missing; turnaround 1441 |
| Expected Result | Each is refused against its own field only: "Setup time must be a whole number of minutes from 0 to 1,440." or "Turnaround time must be a whole number of minutes from 0 to 1,440." The database refuses -1 and 1441 (`venue_setup_turnaround_range`) and accepts 0 and 1440. |

**Automated by:** `tests/unit/venue-times.test.ts` › "SCRUM-159 [AC1] TC-159-02: a negative, too-large, fractional, blank or non-numeric setup time is refused against the setup field only" and "SCRUM-159 [AC1] TC-159-02: a turnaround time out of range is refused against the turnaround field, with its own name"; `tests/integration/setup-turnaround.test.ts` › "SCRUM-159 [AC1] TC-159-02: the database refuses setup or turnaround time outside 0 to 1,440 minutes"

### TC-159-03

| Item | Content |
|---|---|
| Test Case ID | TC-159-03 |
| Test Scenario | [Positive] AC 1: venues that existed before this story start at 0 and 0 |
| Pre-conditions | The seeded venues (Grand Auditorium, Seminar Room 2.1, Exhibition Hall, Executive Boardroom). |
| Test Steps | 1. Read each seeded venue's setup and turnaround time. |
| Test Data | — |
| Expected Result | All four have 0 minutes' setup and 0 minutes' turnaround. |

**Automated by:** `tests/integration/setup-turnaround.test.ts` › "SCRUM-159 [AC1] TC-159-03: venues that existed before this story start with no setup or turnaround time"

### TC-159-04

| Item | Content |
|---|---|
| Test Case ID | TC-159-04 |
| Test Scenario | [Positive] AC 2: a booking's occupied period runs from its start minus the setup time to its end plus the turnaround time |
| Pre-conditions | — |
| Test Steps | 1. Compute the occupied period of each booking below. |
| Test Data | 10:00–12:00 with 30 and 45 minutes; 10:00–12:00 with 0 and 0 |
| Expected Result | 09:30–12:45; 10:00–12:00. |

**Automated by:** `tests/unit/venue-availability.test.ts` › "SCRUM-159 [AC2] TC-159-04: a booking occupies its venue from its start minus the setup time to its end plus the turnaround time"

### TC-159-05

| Item | Content |
|---|---|
| Test Case ID | TC-159-05 |
| Test Scenario | [Negative] AC 3: a request whose occupied period overlaps an approved booking's occupied period is refused, though the booked periods don't overlap, and nothing is written |
| Pre-conditions | The 10:00–12:00 booking is approved. An event 12:30–14:30 assigned to the Coordinator. |
| Test Steps | 1. Open **Request Venue**, choose the 12:30–14:30 event and the venue. <br> 2. Try to submit. |
| Test Data | — |
| Expected Result | The live check says the venue "is unavailable for this period: already booked from 9:30 am … to 12:45 pm …, including setup and turnaround." Submit is disabled; a request sent directly is refused and no booking row is written. |

**Automated by:** `tests/unit/venue-availability.test.ts` › "SCRUM-159 [AC3] TC-159-05: an approved booking blocks where its turnaround overlaps the asked-for occupied period, though the booked periods don't overlap" and "… where its setup overlaps the asked-for occupied period"; `tests/unit/bookings.test.ts` › "SCRUM-159 [AC3] TC-159-05: a request whose setup time reaches into an approved booking is refused, though its event times are clear, and nothing is written"; `tests/integration/setup-turnaround.test.ts` › "SCRUM-159 [AC3, AC4] TC-159-05, TC-159-08: …"; `e2e/setup-turnaround.spec.ts` › "SCRUM-159 [AC3] TC-159-05, TC-159-06: …"

### TC-159-06

| Item | Content |
|---|---|
| Test Case ID | TC-159-06 |
| Test Scenario | [Negative] AC 3: the live check on the request form and Venue Staff's approval refuse the same occupied-period clash |
| Pre-conditions | As TC-159-05, plus a pending 12:30–14:30 request made before the venue's times were set. |
| Test Steps | 1. As the Coordinator, check the venue for 12:30–14:30 on the request form. <br> 2. As Venue Staff, approve the pending request on **Bookings**. |
| Test Data | — |
| Expected Result | 1. The venue is reported unavailable. 2. "Conflicting: … is already booked from … to …, including setup and turnaround. This request is still pending." The request stays Pending. |

**Automated by:** `tests/unit/bookings.test.ts` › "SCRUM-159 [AC3] TC-159-06: the live check counts the venue's setup and turnaround, as submitting does" and "SCRUM-159 [AC3] TC-159-06: approving is refused as conflicting where the request's turnaround reaches an approved booking, and nothing is written"; `tests/integration/setup-turnaround.test.ts` › "SCRUM-159 [AC3] TC-159-06: the live check and an approval refuse the same occupied-period clash"; `e2e/setup-turnaround.spec.ts` › "SCRUM-159 [AC3] TC-159-05, TC-159-06: …"

### TC-159-07

| Item | Content |
|---|---|
| Test Case ID | TC-159-07 |
| Test Scenario | [Negative] AC 3: recorded unavailability counts against a request's whole occupied period, and unavailability over only a booking's turnaround is not recorded |
| Pre-conditions | As TC-159-05. Signed in as Venue Staff for step 2. |
| Test Steps | 1. Request the venue for a period whose setup or turnaround (not its event times) overlaps recorded unavailability. <br> 2. On **Availability**, record maintenance 12:30–13:00. |
| Test Data | Reason Maintenance |
| Expected Result | 1. Refused, naming the unavailability. 2. Nothing is saved yet: the approved booking is shown as affected, because its turnaround runs to 12:45 pm, and the period is saved only once Venue Staff confirm it (SCRUM-161 replaced the refusal: [TC-161-01](SCRUM-161.md#tc-161-01)). |

**Automated by:** `tests/unit/venue-availability.test.ts` › "SCRUM-159 [AC3] TC-159-07: recorded unavailability is compared with the asked-for occupied period, setup and turnaround included"; `tests/unit/bookings.test.ts` › "SCRUM-159 [AC3] TC-159-07: recorded unavailability is checked against the request's whole occupied period"; `tests/unit/unavailability.test.ts` › "SCRUM-161 [AC3] TC-161-05: an approved booking's own turnaround reaching into the period makes it affected, and one only touching it doesn't"; `tests/integration/setup-turnaround.test.ts` › "SCRUM-159 [AC3] TC-159-07: unavailability over only an approved booking's turnaround is not recorded until that booking is confirmed"

### TC-159-08

| Item | Content |
|---|---|
| Test Case ID | TC-159-08 |
| Test Scenario | [Boundary] AC 4: occupied periods that only touch don't conflict |
| Pre-conditions | The 10:00–12:00 booking is approved (30 and 45 minutes). |
| Test Steps | 1. Ask about 13:15–15:00. <br> 2. Ask about 13:00–15:00. |
| Test Data | In the app, half-hour equivalent: a venue with 15 and 45 minutes, so 10:00–12:00 occupies to 12:45; 13:00–15:00 (setup from 12:45) and 12:30–14:30 (setup from 12:15) |
| Expected Result | 13:15–15:00 is free (its occupied period starts at 12:45, where the booking's ends); 13:00–15:00 is refused (it starts at 12:30). In the app, 13:00–15:00 is accepted and 12:30–14:30 refused. |

**Automated by:** `tests/unit/venue-availability.test.ts` › "SCRUM-159 [AC4] TC-159-08: occupied periods that only touch don't conflict: 13:15–15:00 is free after 10:00–12:00, but 13:00–15:00 is not"; `tests/unit/bookings.test.ts` › "SCRUM-159 [AC4] TC-159-08: the same request is accepted when its setup only touches the other booking's end"; `tests/integration/setup-turnaround.test.ts` › "SCRUM-159 [AC3, AC4] TC-159-05, TC-159-08: a request is refused where its setup reaches an approved booking's turnaround, and accepted where the two only touch"

### TC-159-09

| Item | Content |
|---|---|
| Test Case ID | TC-159-09 |
| Test Scenario | [Concurrency] AC 5: two requests whose occupied periods overlap are approved at the same moment: only one succeeds |
| Pre-conditions | Two pending requests at the venue, 10:00–12:00 and 13:00–15:00 (an hour apart as booked, overlapping by setup and turnaround). Two different Venue Staff. |
| Test Steps | 1. Both approve at the same moment, each after the application's check has passed. |
| Test Data | — |
| Expected Result | One is Approved; the other is told "Conflicting: …" and stays Pending. The venue is never double-booked. |

**Automated by:** `tests/integration/concurrency.test.ts` › "SCRUM-159 [AC5] TC-159-09: two staff approve requests whose setup and turnaround overlap at the same moment: only one succeeds, the other is returned as conflicting"

### TC-159-10

| Item | Content |
|---|---|
| Test Case ID | TC-159-10 |
| Test Scenario | [Positive] AC 7: the availability calendar shows each booking's setup and turnaround time around it, marked differently from the event itself |
| Pre-conditions | The 10:00–12:00 booking is approved (30 and 45 minutes). |
| Test Steps | 1. Open **Availability**, choose the venue and the booking's week. <br> 2. Hover over the booking. |
| Test Data | — |
| Expected Result | 1. The day reads: Available to 9:30 am; "Setup for *event* 9:30 am to 10:00 am"; "Booked 10:00 am to 12:00 pm"; "Turnaround for *event* 12:00 pm to 12:45 pm"; Available from 12:45 pm. Setup and turnaround are hatched with a dashed edge and their own icons, and the legend names them. 2. The booking's card also reads "Setup: 9:30 am SGT to 10:00 am SGT (30 min)" and "Turnaround: 12:00 pm SGT to 12:45 pm SGT (45 min)"; a booking with neither shows no such lines. |

**Automated by:** `tests/unit/venue-availability.test.ts` › "SCRUM-159 [AC7] TC-159-10: a booking with setup and turnaround brings a setup stretch before it and a turnaround stretch after it, named for its event" and "… on the day's timeline the setup, the booking and the turnaround sit flush, each its own kind of stretch"; `tests/unit/availability-calendar.test.tsx` › "SCRUM-159 [AC7] TC-159-10: a booking's setup and turnaround show around it, in words and marked as their own kinds" and "… a booking's hover card says when its setup and turnaround hold the venue, and a booking without them says nothing extra"; `tests/integration/setup-turnaround.test.ts` › "SCRUM-159 [AC7] TC-159-10: the calendar's entries carry the approved booking's setup and turnaround"; `e2e/setup-turnaround.spec.ts` › "SCRUM-159 [AC7] TC-159-10: the calendar shows the booking's setup before it and turnaround after it, as their own kinds"

### TC-159-11

| Item | Content |
|---|---|
| Test Case ID | TC-159-11 |
| Test Scenario | [Boundary] AC 7: no extra stretch without setup or turnaround; a booking just outside the week whose setup reaches into it is shown for that setup |
| Pre-conditions | — |
| Test Steps | 1. Show a week with a booking that has 0 and 0 minutes, and one with turnaround only. <br> 2. Show a week where a booking starts at 00:15 on the following Monday with 30 minutes' setup, and another starts at 09:00 that Monday. |
| Test Data | — |
| Expected Result | 1. Only the booking; then the booking and its turnaround. 2. Sunday ends with "Setup" from 23:45 to midnight; the 09:00 booking isn't loaded. |

**Automated by:** `tests/unit/venue-availability.test.ts` › "SCRUM-159 [AC7] TC-159-11: a booking with no setup or turnaround brings no extra stretch, and one with only turnaround brings only that" and "SCRUM-159 [AC7] TC-159-11: a booking just after the week whose setup reaches into it is shown for that setup; one that doesn't reach is left out"

### TC-159-12

| Item | Content |
|---|---|
| Test Case ID | TC-159-12 |
| Test Scenario | [Positive] AC 8: approving copies the venue's current setup and turnaround onto the booking; rejecting doesn't |
| Pre-conditions | A pending 10:00–12:00 request at a venue with 15 and 45 minutes (30 and 45 in the unit case). |
| Test Steps | 1. As Venue Staff, approve it. <br> 2. Reject another. |
| Test Data | — |
| Expected Result | The approved booking stores the venue's minutes; the rejected one's are left alone. |

**Automated by:** `tests/unit/bookings.test.ts` › "SCRUM-159 [AC8] TC-159-12: approving copies the venue's current setup and turnaround onto the booking" and "SCRUM-159 [AC8] TC-159-12: rejecting leaves the booking's setup and turnaround alone"; `tests/integration/setup-turnaround.test.ts` › "SCRUM-159 [AC8] TC-159-12, TC-159-13: …"

### TC-159-13

| Item | Content |
|---|---|
| Test Case ID | TC-159-13 |
| Test Scenario | [Boundary] AC 8: a later change to the venue's times doesn't move an approved booking |
| Pre-conditions | As TC-159-12, approved (occupies 09:45–12:45). |
| Test Steps | 1. Change the venue to 0 minutes' setup and 120 minutes' turnaround. <br> 2. Request 13:00–14:00. |
| Test Data | — |
| Expected Result | The request is accepted, because the approved booking still ends its occupied period at 12:45 (with the venue's new two hours it would reach 14:00). The booking still stores 15 and 45. Finding clashes a change creates is SCRUM-160. |

**Automated by:** `tests/integration/setup-turnaround.test.ts` › "SCRUM-159 [AC8] TC-159-12, TC-159-13: an approval keeps the minutes it was approved with; a later change to the venue's times doesn't move it"

### TC-159-14

| Item | Content |
|---|---|
| Test Case ID | TC-159-14 |
| Test Scenario | [Positive] AC 3: a refusal names the whole time the other booking occupies the venue, so the Coordinator can see why |
| Pre-conditions | — |
| Test Steps | 1. Describe an approved booking with setup or turnaround. <br> 2. Describe one with neither. |
| Test Data | 2:00–4:00 pm with 30 and 45 minutes; with 0 and 15; with 0 and 0 |
| Expected Result | "already booked from 1:30 pm … to 4:45 pm …, including setup and turnaround"; "… 2:00 pm … to 4:15 pm …, including setup and turnaround"; and, with neither, exactly as before: "already booked from 2:00 pm … to 4:00 pm …". The other booking's event is never named. |

**Automated by:** `tests/unit/venue-availability.test.ts` › "SCRUM-159 [AC3] TC-159-14: names a booking with setup or turnaround by the whole time it occupies the venue, so the refusal explains itself" and "SCRUM-159: a booking with no setup or turnaround reads exactly as before"

### TC-159-15

| Item | Content |
|---|---|
| Test Case ID | TC-159-15 |
| Test Scenario | [Negative] AC 3: a Held booking whose hold hasn't expired blocks a request and the live check wherever its occupied period reaches |
| Pre-conditions | A Held 10:00–12:00 booking at a venue with 15 and 45 minutes, its hold expiring tomorrow (written directly; placing holds is SCRUM-163). An event 12:30–14:30. |
| Test Steps | 1. Request the venue for the 12:30–14:30 event. <br> 2. Check the venue for that period on the request form. |
| Test Data | — |
| Expected Result | 1. Refused: "… is unavailable for that period: held from … to 12:45 pm …, including setup and turnaround." Nothing is written. 2. Reported unavailable. |

**Automated by:** `tests/unit/venue-availability.test.ts` › "SCRUM-50 [AC3, AC10] TC-50-04, SCRUM-159 [AC3] TC-159-15, SCRUM-163 [AC2, AC4] TC-163-04: asks only for APPROVED bookings and unexpired holds …" and "SCRUM-159 [AC3] TC-159-15: names a held booking as held, with its whole occupied time"; `tests/integration/setup-turnaround.test.ts` › "SCRUM-159 [AC3] TC-159-15: a hold that hasn't expired blocks a request and the live check wherever its occupied period reaches"

### TC-159-16

| Item | Content |
|---|---|
| Test Case ID | TC-159-16 |
| Test Scenario | [Boundary] AC 3: a hold whose expiry has passed blocks nothing, even before anything marks it Expired |
| Pre-conditions | As TC-159-15, but the hold expired an hour ago and the row still says Held. |
| Test Steps | 1. Check the venue for 12:30–14:30. <br> 2. Request it. |
| Test Data | — |
| Expected Result | Reported available, and the request is created (SCRUM-163 AC4: a lapsed hold no longer reserves the venue). |

**Automated by:** `tests/integration/setup-turnaround.test.ts` › "SCRUM-159 [AC3] TC-159-16: a hold whose expiry has passed blocks nothing, even before anything marks it Expired"

### TC-159-17

| Item | Content |
|---|---|
| Test Case ID | TC-159-17 |
| Test Scenario | [Negative, Positive] AC 3, AC 8: placing a hold counts setup and turnaround, and the hold keeps the venue's minutes |
| Pre-conditions | The venue has 30 minutes' setup and 45 minutes' turnaround. An approved booking ends 20 minutes before a pending request starts. Signed in as `venuestaff@test.local`. |
| Test Steps | 1. Hold the pending request. <br> 2. Remove the other booking and hold it again. |
| Test Data | Any expiry before the request starts. |
| Expected Result | 1. "Conflicting: … is already booked from …": the earlier booking ends inside the request's setup. Nothing is written. 2. The request is Held with 30 and 45 minutes saved on it. |

**Automated by:** `tests/unit/booking-holds.test.ts` › "SCRUM-159 [AC3, AC8] TC-159-17: a hold is refused where only setup or turnaround clash, and otherwise keeps the venue's minutes"

### TC-159-18

| Item | Content |
|---|---|
| Test Case ID | TC-159-18 |
| Test Scenario | [Positive] AC 9: Venue Staff are warned when a request's setup or turnaround falls outside opening hours, and can still hold or approve it |
| Pre-conditions | The venue is open 10:00–22:00 on Tuesdays, with 30 minutes' setup and 45 minutes' turnaround, and no other bookings. Pending requests for Tuesday 10:00–12:00 and 20:00–22:00. Signed in as `venuestaff@test.local`. |
| Test Steps | 1. Open **Bookings** and read each request's card. <br> 2. Click **Hold** on the first. <br> 3. Approve the first; hold the second. |
| Test Data | Any hold expiry before the request starts. |
| Expected Result | 1. The first reads "The setup time (30 minutes, from 09:30) falls outside …'s opening hours, 10:00–22:00 on Tuesdays. You can still hold or approve it."; the second names the turnaround time until 22:45. Both are still "Free for this period". A request with both outside names both. <br> 2. The Hold dialog shows the same warning. <br> 3. Both succeed: the warning never refuses. |

**Automated by:** `tests/unit/venue-hours.test.ts` › "SCRUM-159 [AC9] TC-159-18: …" (4 tests); `tests/unit/booking-queue.test.tsx` › "SCRUM-159 [AC9] TC-159-18: …"; `tests/integration/venue-catalogue.test.ts` › "SCRUM-159 [AC9] TC-159-18: setup or turnaround outside opening hours is a warning in the queue, and the request can still be approved or held"; `e2e/setup-turnaround.spec.ts` › "SCRUM-159 [AC9] TC-159-18: …"

### TC-159-19

| Item | Content |
|---|---|
| Test Case ID | TC-159-19 |
| Test Scenario | [Boundary, Negative] AC 9: no warning when setup and turnaround fit exactly, when no hours are recorded, or when the booking itself is outside the hours |
| Pre-conditions | The venue is open 09:00–18:00 on weekdays and Closed at weekends, with 30 and 45 minutes. |
| Test Steps | Read the warning for: 1. Tuesday 09:30–17:15. <br> 2. The same at a venue with no hours recorded. <br> 3. Saturday 10:00–12:00. |
| Test Data | — |
| Expected Result | No warning in each case. 1. Setup ends exactly at opening and turnaround exactly at closing. 3. The request is refused instead (SCRUM-34 AC7). |

**Automated by:** `tests/unit/venue-hours.test.ts` › "SCRUM-159 [AC9] TC-159-19: …" (2 tests)