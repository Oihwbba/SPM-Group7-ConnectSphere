# SCRUM-34 — Browse and maintain the venue catalogue

Test cases for [docs/backlog/SCRUM-34.md](../backlog/SCRUM-34.md). Format:
[README](README.md). Seeded accounts share the password `Password123!`.

Opening hours are an opening and a closing time per day in SGT, or Closed
(AC3). The seeded venues' hours: Grand Auditorium 07:00–23:00 every day,
Exhibition Hall 06:00–22:00 every day, Seminar Room 2.1 08:00–20:00 and
Executive Boardroom 09:00–18:00 on weekdays, both Closed at weekends.

**Not yet delivered, on purpose:** AC10 and AC11 flag the affected bookings
Needs Reconsideration (SCRUM-26), which isn't merged. Until it is, an edit or
retirement that affects a future booking is refused and the bookings are
listed (TC-34-12, TC-34-14); the "once saved, flagged" half follows with
SCRUM-26. AC10 judges a booking's attendance, facilities, layout and period;
a booking doesn't record the accessibility features it needs until SCRUM-40,
which adds them to this check. AC6's search, filtering and suitability are
SCRUM-38 and SCRUM-40, not built; the request form half is covered. AC12's
warning is SCRUM-159 AC9.

### TC-34-01

| Item | Content |
|---|---|
| Test Case ID | TC-34-01 |
| Test Scenario | [Positive] AC 1, AC 2: a venue's detail view shows everything, from the latest saved record |
| Pre-conditions | Signed in as a Coordinator. A venue Venue Staff have just added or edited. |
| Test Steps | 1. Open Venues, then the venue. |
| Test Data | `coordinator@test.local` |
| Expected Result | The view shows location, capacity, facilities, accessibility features, supported layouts, opening hours for each day, setup and turnaround times and known restrictions, as last saved. |

**Automated by:** `e2e/venue-catalogue.spec.ts` › "SCRUM-34 [AC1, AC2, AC3, AC4, AC6, AC9] TC-34-01, TC-34-03, TC-34-05, TC-34-07, TC-34-11: …"

### TC-34-02

| Item | Content |
|---|---|
| Test Case ID | TC-34-02 |
| Test Scenario | [Positive] [Negative] AC 2: every internal user reads the catalogue; external users don't |
| Pre-conditions | — |
| Test Steps | 1. Check `venue:read` for each role. <br> 2. Check each role's navigation. |
| Test Data | All seven roles |
| Expected Result | Coordinator, Venue Staff, Technical Support, Lead and Safety Officer may read venues and have Venues as their last link, so no landing page moves. The Organiser and the Attendee may not, and have no Venues link. |

**Automated by:** `tests/unit/auth.test.ts` › "SCRUM-34 [AC2] TC-34-02: …"; `tests/unit/nav.test.ts` › "SCRUM-34 [AC2] TC-34-02: …"

### TC-34-03

| Item | Content |
|---|---|
| Test Case ID | TC-34-03 |
| Test Scenario | [Positive] AC 3: Venue Staff add a venue |
| Pre-conditions | Signed in as Venue Staff. |
| Test Steps | 1. Open Venues and choose Add venue. <br> 2. Enter a name, location, capacity and hours for each day (Sunday Closed); leave setup and turnaround at 0; add a known restriction. Save. |
| Test Data | `venuestaff@test.local`; "Rooftop Garden", "Level 20, Block A", 80, Mon–Sat 10:00–22:00, Sunday Closed, "Limited emergency access" |
| Expected Result | "Venue added." The venue opens with those details. It has seven opening-hours rows, Sunday with neither time; setup and turnaround are 0; an audit entry records who added it. |

**Automated by:** `tests/unit/venue-catalogue.test.ts` › "SCRUM-34 [AC3] TC-34-03: …"; `tests/integration/venue-catalogue.test.ts` › "SCRUM-34 [AC3] TC-34-03: …"; `e2e/venue-catalogue.spec.ts`

### TC-34-04

| Item | Content |
|---|---|
| Test Case ID | TC-34-04 |
| Test Scenario | [Negative] AC 3: a required field or a day's hours left out |
| Pre-conditions | As TC-34-03. |
| Test Steps | 1. Save with no name, no location, or no capacity. <br> 2. Save with a day neither Closed nor given both times. |
| Test Data | — |
| Expected Result | Refused against that field ("Give the venue a name.", "Enter the venue's location.", "Capacity must be a whole number greater than 0.", "Enter an opening and a closing time, or mark the day Closed."). Nothing is written. |

**Automated by:** `tests/unit/venue-catalogue.test.ts` › "SCRUM-34 [AC3] TC-34-04: …"

### TC-34-05

| Item | Content |
|---|---|
| Test Case ID | TC-34-05 |
| Test Scenario | [Negative] [Boundary] AC 4: capacity zero or less, or not a whole number |
| Pre-conditions | As TC-34-03. |
| Test Steps | 1. Save with capacity 0, -5, 12.5 or "many". <br> 2. Save with capacity 1. |
| Test Data | — |
| Expected Result | 1: "Capacity must be a whole number greater than 0." against capacity, and nothing is written. 2: saved. |

**Automated by:** `tests/unit/venue-catalogue.test.ts` › "SCRUM-34 [AC4] TC-34-05: …"; `e2e/venue-catalogue.spec.ts`

### TC-34-06

| Item | Content |
|---|---|
| Test Case ID | TC-34-06 |
| Test Scenario | [Negative] [Boundary] AC 5: a closing time not after the opening time |
| Pre-conditions | As TC-34-03. |
| Test Steps | 1. Save Tuesday 18:00 to 18:00. <br> 2. Save Tuesday 18:00 to 09:00. <br> 3. Save Tuesday 18:00 to 18:01. <br> 4. Write closing before opening straight into the database. |
| Test Data | — |
| Expected Result | 1, 2: "The closing time must be after the opening time." against Tuesday only; nothing is written. 3: saved. 4: refused by `venue_opening_hours_valid`. |

**Automated by:** `tests/unit/venue-catalogue.test.ts` › "SCRUM-34 [AC5] TC-34-06: …"; `tests/integration/venue-catalogue.test.ts` › "SCRUM-34 [AC5] TC-34-06: …"; `e2e/venue-catalogue.spec.ts`

### TC-34-07

| Item | Content |
|---|---|
| Test Case ID | TC-34-07 |
| Test Scenario | [Positive] AC 6: an edit shows at once in the catalogue and on the request form |
| Pre-conditions | Signed in as Venue Staff; a venue with no future bookings. |
| Test Steps | 1. Edit its capacity and facilities. Save. <br> 2. Open it again; as a Coordinator, open Request Venue. |
| Test Data | Capacity 80 → 120; add "projector" |
| Expected Result | "Venue saved." The detail view and the request form's venue list show capacity 120 and the projector. An audit entry records who changed it. |

**Automated by:** `tests/unit/venue-catalogue.test.ts` › "SCRUM-34 [AC6] TC-34-07: …"; `tests/integration/venue-catalogue.test.ts` › "SCRUM-34 [AC6] TC-34-07: …"; `e2e/venue-catalogue.spec.ts`

### TC-34-08

| Item | Content |
|---|---|
| Test Case ID | TC-34-08 |
| Test Scenario | [Negative] [Boundary] AC 7: a venue request outside opening hours |
| Pre-conditions | Signed in as a Coordinator; Executive Boardroom (09:00–18:00 weekdays, Closed weekends). |
| Test Steps | 1. Request it for a weekday 09:00–18:00. <br> 2. For 08:30–12:00, 15:00–18:30, a Saturday, or 17:00 to 01:00 the next day. <br> 3. Request a venue with no hours recorded at 03:00. |
| Test Data | — |
| Expected Result | 1 is accepted: exactly at opening and closing is within. 2 is refused with that day's hours, e.g. "Executive Boardroom is open 09:00–18:00 on Tuesdays. The booking must start and end within those hours on the same day." or "Executive Boardroom is closed on Saturdays, so it can't be booked then."; no booking is written, and the form's availability check says the same. 3 is accepted. |

**Automated by:** `tests/unit/venue-hours.test.ts` › "SCRUM-34 [AC7] TC-34-08: …"; `tests/integration/venue-catalogue.test.ts` › "SCRUM-34 [AC7] TC-34-08: …"

### TC-34-09

| Item | Content |
|---|---|
| Test Case ID | TC-34-09 |
| Test Scenario | [Negative] AC 7: holding or approving a request outside opening hours |
| Pre-conditions | Signed in as Venue Staff; a Pending request at the Executive Boardroom on a Saturday (made before its hours were recorded). |
| Test Steps | 1. Hold it. <br> 2. Approve it. |
| Test Data | `venuestaff@test.local` |
| Expected Result | Both refused: "Executive Boardroom is closed on Saturdays, so it can't be booked then. This request is still pending." The request stays Pending. |

**Automated by:** `tests/integration/venue-catalogue.test.ts` › "SCRUM-34 [AC7] TC-34-09: …"

### TC-34-10

| Item | Content |
|---|---|
| Test Case ID | TC-34-10 |
| Test Scenario | [Positive] AC 8: Venue Staff retire a venue |
| Pre-conditions | Signed in as Venue Staff; a venue with a past booking and no future ones. |
| Test Steps | 1. Open it and choose Retire venue; confirm. <br> 2. As a Coordinator, open Request Venue; request it directly. <br> 3. Open the venue and its past booking. |
| Test Data | — |
| Expected Result | "… is retired." It leaves the catalogue for everyone but Venue Staff, who see it under Retired venues, and the request form; a direct request reads "Venue not found." and writes nothing. Its detail view still opens, marked Retired, and the past booking still names it. Retiring it again changes nothing. |

**Automated by:** `tests/integration/venue-catalogue.test.ts` › "SCRUM-34 [AC8] TC-34-10: …"; `e2e/venue-catalogue.spec.ts` › "SCRUM-34 [AC8, AC10, AC11] TC-34-10, TC-34-12, TC-34-14: …"

### TC-34-11

| Item | Content |
|---|---|
| Test Case ID | TC-34-11 |
| Test Scenario | [Negative] AC 9: other roles can't change the catalogue |
| Pre-conditions | — |
| Test Steps | 1. As a Coordinator, open a venue. <br> 2. As each role other than Venue Staff, call add, edit and retire directly. |
| Test Data | — |
| Expected Result | 1: no Add venue, Edit venue or Retire venue. 2: "You do not have permission to do that." and nothing is read or written. |

**Automated by:** `tests/unit/venue-catalogue.test.ts` › "SCRUM-34 [AC9] TC-34-11: …"; `e2e/venue-catalogue.spec.ts`

### TC-34-12

| Item | Content |
|---|---|
| Test Case ID | TC-34-12 |
| Test Scenario | [Negative] AC 10: an edit that would stop a future booking fitting |
| Pre-conditions | Signed in as Venue Staff; a venue with a future Approved booking for 100 people that asked for a projector and a theatre layout, Tuesday 10:00–14:00. |
| Test Steps | 1. Lower capacity to 80. <br> 2. Remove the projector or theatre. <br> 3. Change Tuesday's hours to 11:00–18:00. |
| Test Data | — |
| Expected Result | Each is refused: "This change would leave the future bookings below no longer fitting the venue, so nothing was saved. …", listing the booking with why, e.g. "Capacity 80 < attendance 100" or "Outside opening hours (Tuesday 11:00–18:00)". The venue and its hours are unchanged. Pending and live Held bookings count the same way. |

**Automated by:** `tests/unit/venue-changes.test.ts` › "SCRUM-34 [AC10] TC-34-12: …"; `tests/unit/venue-catalogue.test.ts` › "SCRUM-34 [AC10] TC-34-12: …"; `tests/integration/venue-catalogue.test.ts` › "SCRUM-34 [AC10] TC-34-12: …"; `e2e/venue-catalogue.spec.ts`

### TC-34-13

| Item | Content |
|---|---|
| Test Case ID | TC-34-13 |
| Test Scenario | [Positive] [Boundary] AC 10: an edit that affects no future booking saves |
| Pre-conditions | As TC-34-12. |
| Test Steps | 1. Lower capacity to exactly 100. <br> 2. Change something the booking didn't ask for. <br> 3. On a venue whose booking already asked for more than it had, change its location. <br> 4. On a venue with only past, Rejected, Cancelled or lapsed Held bookings, lower its capacity. |
| Test Data | — |
| Expected Result | All save: attendance equal to capacity fits, facilities and layouts match however they were written ("Sound System" is "sound-system"), a booking that named no attendance or layout isn't judged on them, an unrequested change affects nothing, a mismatch the edit didn't cause doesn't count, and only future Pending, Approved or live Held bookings are judged. |

**Automated by:** `tests/unit/venue-changes.test.ts` › "SCRUM-34 [AC10] TC-34-13: …"; `tests/integration/venue-catalogue.test.ts` › "SCRUM-34 [AC10] TC-34-13: …"

### TC-34-14

| Item | Content |
|---|---|
| Test Case ID | TC-34-14 |
| Test Scenario | [Negative] AC 11: retiring a venue with future bookings |
| Pre-conditions | Signed in as Venue Staff; a venue with a future Pending booking. |
| Test Steps | 1. Retire it. |
| Test Data | — |
| Expected Result | "This venue has the future bookings below, so it can't be retired yet. …", listing the booking. The venue stays active and the booking is unchanged; nothing is cancelled. |

**Automated by:** `tests/unit/venue-catalogue.test.ts` › "SCRUM-34 [AC11] TC-34-14: …"; `tests/integration/venue-catalogue.test.ts` › "SCRUM-34 [AC11] TC-34-14: …"; `e2e/venue-catalogue.spec.ts`

### TC-34-15

| Item | Content |
|---|---|
| Test Case ID | TC-34-15 |
| Test Scenario | [Boundary] AC 12: new opening hours judge the booking period, not setup or turnaround |
| Pre-conditions | A venue with 30 minutes' setup and a future booking 10:00–14:00 on a Tuesday. |
| Test Steps | 1. Change Tuesday's hours to 10:00–18:00. <br> 2. Change them to 10:01–18:00. |
| Test Data | — |
| Expected Result | 1 saves: the booking period starts exactly at opening, and setup outside the hours doesn't count. 2 is refused, listing the booking as outside opening hours. |

**Automated by:** `tests/unit/venue-changes.test.ts` › "SCRUM-34 [AC12] TC-34-15: …"; `tests/integration/venue-catalogue.test.ts` › "SCRUM-34 [AC12] TC-34-15: …"

### TC-34-16

| Item | Content |
|---|---|
| Test Case ID | TC-34-16 |
| Test Scenario | [Concurrency] AC 8, AC 11: two retirements of the same venue at the same moment |
| Pre-conditions | A venue with no future bookings. |
| Test Steps | 1. Retire it twice at once. |
| Test Data | — |
| Expected Result | Exactly one succeeds; the other waits on the venue row, then reads "This venue is already retired." One audit entry is written. |

**Automated by:** `tests/integration/venue-catalogue.test.ts` › "SCRUM-34 [AC8, AC11] TC-34-16: …"

### TC-34-17

| Item | Content |
|---|---|
| Test Case ID | TC-34-17 |
| Test Scenario | [Positive] [Boundary] AC 3: existing venues' free-text hours become opening hours when the migration runs |
| Pre-conditions | A database with every migration before `20261015120000_venue_opening_hours`, and venues whose hours are "Mon–Sun 07:00–23:00", "Mon–Fri 09:00–18:00", "By arrangement" or none. |
| Test Steps | 1. Run the migration. |
| Test Data | — |
| Expected Result | The Mon–Sun venue opens 07:00–23:00 every day. The Mon–Fri venue opens 09:00–18:00 on weekdays and is Closed at weekends. The other two have no hours recorded, so no booking is refused for them. The free-text column is kept, with its text. |

**Automated by:** `tests/integration/venue-opening-hours-migration.test.ts` › "SCRUM-34 [AC3] TC-34-17: …"
