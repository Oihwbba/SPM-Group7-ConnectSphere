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
- **AC1's form:** there is no venue edit screen yet. SCRUM-34 builds it and
  uses the shared rule `venueTimesSchema` (lib/schemas/venue.ts) tested here;
  the database refuses the same values.
- **AC3's search and hold, and Held bookings in AC3 and AC5:** venue search is
  SCRUM-38 and holds are SCRUM-163. Both use the same lookup
  (`findVenueBlockers`) and database constraint, so they inherit the occupied
  period without a second rule.
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
| Expected Result | 1. Refused, naming the unavailability. 2. "Not recorded: … is already booked from … to 12:45 pm …, including setup and turnaround." Nothing is saved. (Recording over bookings is replaced by SCRUM-161, which flags them instead.) |

**Automated by:** `tests/unit/venue-availability.test.ts` › "SCRUM-159 [AC3] TC-159-07: recorded unavailability is compared with the asked-for occupied period, setup and turnaround included"; `tests/unit/bookings.test.ts` › "SCRUM-159 [AC3] TC-159-07: recorded unavailability is checked against the request's whole occupied period"; `tests/unit/unavailability.test.ts` › "SCRUM-159 [AC3] TC-159-07: unavailability over only a booking's turnaround is refused too, naming the whole occupied time"; `tests/integration/setup-turnaround.test.ts` › "SCRUM-159 [AC3] TC-159-07: unavailability over only an approved booking's turnaround is not recorded"

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
| Test Steps | 1. Open **Availability**, choose the venue and the booking's week. |
| Test Data | — |
| Expected Result | The day reads: Available to 9:30 am; "Setup for *event* 9:30 am to 10:00 am"; "Booked 10:00 am to 12:00 pm"; "Turnaround for *event* 12:00 pm to 12:45 pm"; Available from 12:45 pm. Setup and turnaround are hatched with a dashed edge and their own icons, and the legend names them. |

**Automated by:** `tests/unit/venue-availability.test.ts` › "SCRUM-159 [AC7] TC-159-10: a booking with setup and turnaround brings a setup stretch before it and a turnaround stretch after it, named for its event" and "… on the day's timeline the setup, the booking and the turnaround sit flush, each its own kind of stretch"; `tests/unit/availability-calendar.test.tsx` › "SCRUM-159 [AC7] TC-159-10: a booking's setup and turnaround show around it, in words and marked as their own kinds"; `tests/integration/setup-turnaround.test.ts` › "SCRUM-159 [AC7] TC-159-10: the calendar's entries carry the approved booking's setup and turnaround"; `e2e/setup-turnaround.spec.ts` › "SCRUM-159 [AC7] TC-159-10: the calendar shows the booking's setup before it and turnaround after it, as their own kinds"

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
