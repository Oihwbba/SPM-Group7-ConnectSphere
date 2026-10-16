# SCRUM-34 — Browse and maintain the venue catalogue

Test cases for [docs/backlog/SCRUM-34.md](../backlog/SCRUM-34.md). Format:
[README](README.md). Seeded accounts share the password `Password123!`.

Opening hours are an opening and a closing time per day in SGT, or Closed
(AC3). The seeded venues' hours: Grand Auditorium 07:00–23:00 every day,
Exhibition Hall 06:00–22:00 every day, Seminar Room 2.1 08:00–20:00 and
Executive Boardroom 09:00–18:00 on weekdays, both Closed at weekends.

**Not yet delivered, on purpose:** AC10 judges a booking's attendance, facilities, layout and period;
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
| Expected Result | 1 is accepted: exactly at opening and closing is within. 2 is refused with that day's hours, e.g. "Executive Boardroom is open 09:00–18:00 on Tuesdays. The booking must start and end within those hours on the same day." or "Executive Boardroom is closed on Saturdays, so it can't be booked then."; no booking is written, and the form's availability check says the same, with Submit disabled. 3 is accepted. Every seeded Pending, Held or Approved booking is within its venue's hours, whatever day the seed runs. |

**Automated by:** `tests/unit/venue-hours.test.ts` › "SCRUM-34 [AC7] TC-34-08: …"; `tests/integration/venue-catalogue.test.ts` › "SCRUM-34 [AC7] TC-34-08: …"; `e2e/venue-catalogue.spec.ts` › "SCRUM-34 [AC7] TC-34-08: the request form refuses a period outside the venue's opening hours, naming them, and accepts one exactly within them"

### TC-34-09

| Item | Content |
|---|---|
| Test Case ID | TC-34-09 |
| Test Scenario | [Negative] [Boundary] AC 7: holding or approving a request, or approving or confirming a hold, outside opening hours |
| Pre-conditions | A Pending request, a hold and a hold Venue Staff have approved at the Executive Boardroom on a Saturday (made before its hours were recorded). |
| Test Steps | 1. As Venue Staff, open Bookings. <br> 2. Hold the request, then approve it. <br> 3. Approve the hold. <br> 4. As its Coordinator, confirm the approved hold. <br> 5. Repeat 3 and 4 for a hold exactly within the hours. |
| Test Data | `venuestaff@test.local`, `coordinator@test.local` |
| Expected Result | 1: the request's card doesn't say "Free for this period"; it shows "Executive Boardroom is closed on Saturdays, so it can't be booked then." 2: both refused with that, then "This request is still pending."; it stays Pending. 3: refused, "… This hold is still awaiting approval."; it stays Held and unapproved. 4: refused, "… This hold is unchanged; you can still release it."; it stays Held. Nothing is audited. 5: approved, then confirmed, so it is Approved. |

**Automated by:** `tests/integration/venue-catalogue.test.ts` › "SCRUM-34 [AC7] TC-34-09: …"; `tests/unit/booking-queue.test.tsx` › "SCRUM-34 [AC7] TC-34-09: a request outside the venue's opening hours isn't shown as free, and says why"

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
| Test Scenario | [Negative] [Positive] AC 10: an edit that would stop a future booking fitting warns, then flags it |
| Pre-conditions | Signed in as Venue Staff; a venue with a future Approved booking for 100 people that asked for a projector and a theatre layout, Tuesday 10:00–14:00. |
| Test Steps | 1. Lower capacity to 80, and save. <br> 2. Remove the projector or theatre, and save. <br> 3. Change Tuesday's hours to 11:00–18:00, and save. <br> 4. After any of them, choose Save and flag 1 booking. <br> 5. Repeat 1 and 4 while a second booking is made at the venue in between. |
| Test Data | — |
| Expected Result | 1–3: a warning, "This change would leave the future bookings below no longer fitting the venue. Nothing is saved yet: …", listing the booking with why, e.g. "Capacity 80 < attendance 100" or "Outside opening hours (Tuesday 11:00–18:00)". The venue and its hours are unchanged. 4: "Venue saved. 1 booking flagged Needs Reconsideration." The change is saved, and the booking is flagged with the reason, e.g. "… changed: Capacity 80 < attendance 100", still Approved, for its Coordinator to decide (SCRUM-26). 5: the warning again, listing both, and nothing is saved. Pending and live Held bookings count the same way. |

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
| Test Scenario | [Negative] [Positive] AC 11: retiring a venue with future bookings warns, then flags them |
| Pre-conditions | Signed in as Venue Staff; a venue with a future Pending booking. |
| Test Steps | 1. Retire it. <br> 2. Choose Retire and flag 1 booking. |
| Test Data | — |
| Expected Result | 1: "This venue has the future bookings below. Nothing is retired yet: …", listing the booking. The venue stays active and the booking is unflagged. 2: the venue is retired, and the booking is flagged "… has been retired.", still Pending; nothing is cancelled. A booking made between the warning and the confirmation warns again. |

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

### TC-34-18

| Item | Content |
|---|---|
| Test Case ID | TC-34-18 |
| Test Scenario | [Positive] AC 3, AC 6: facilities, accessibility features and layouts are picked from lists, and ones Venue Staff add are offered from then on |
| Pre-conditions | Signed in as `venuestaff@test.local`. |
| Test Steps | 1. Add a venue: pick Projector and Sound system, Wheelchair access, and Theatre; add "Rooftop bar", "Tactile paving" and "Garden party". Save. <br> 2. Open Add venue again. <br> 3. As `organiser@test.local`, start an event request and reach Venue, Layout & Accessibility. |
| Test Data | — |
| Expected Result | 1: the venue is saved with the tags `projector`, `sound-system`, `rooftop-bar`; `wheelchair-access`, `tactile-paving`; `theatre`, `garden-party`, each once however it was typed, and its details show them. 2: Rooftop bar, Tactile paving and Garden party are offered, not selected, after the predefined options. 3: Garden party is a layout preset, and Tactile paving an accessibility quick-pick (SCRUM-13). The options come from active venues only, so a retired venue's own values drop out. |

**Automated by:** `tests/unit/venue-options.test.ts` › "SCRUM-34 [AC3, AC6] TC-34-18: …", "SCRUM-34 [AC3] TC-34-18: …", "SCRUM-34 [AC6, AC8] TC-34-18: …", "SCRUM-34 [AC1] TC-34-18: …"; `tests/unit/venue-catalogue.test.ts` › "SCRUM-34 [AC3, AC6] TC-34-18: …"; `e2e/venue-catalogue.spec.ts` › "SCRUM-34 [AC1, AC2, AC3, AC4, AC6, AC9] …", "SCRUM-34 [AC6] TC-34-18: …"

### TC-34-19

| Item | Content |
|---|---|
| Test Case ID | TC-34-19 |
| Test Scenario | [Boundary] AC 3: how long an added option may be |
| Pre-conditions | As TC-34-18. |
| Test Steps | 1. Add a facility of 60 characters. Save. <br> 2. Add an accessibility feature of 61 characters. Save. |
| Test Data | — |
| Expected Result | 1 saves. 2 is refused against Accessibility features with "Keep each one under 60 characters.", and nothing is written. |

**Automated by:** `tests/unit/venue-catalogue.test.ts` › "SCRUM-34 [AC3] TC-34-19: …"

### TC-34-20

| Item | Content |
|---|---|
| Test Case ID | TC-34-20 |
| Test Scenario | [Negative] AC 3: editing a venue whose opening hours were never recorded |
| Pre-conditions | Signed in as Venue Staff; a venue added before SCRUM-34, with no opening hours. |
| Test Steps | 1. Open it and choose Edit venue. <br> 2. Change only its capacity. Save. |
| Test Data | `venuestaff@test.local` |
| Expected Result | 1: the dialog says "This venue's opening hours aren't recorded yet. Enter them for each day, or mark the day Closed.", and every day is blank, not 09:00–18:00. 2: refused against each day with "Enter an opening and a closing time, or mark the day Closed."; the capacity and the hours are unchanged, so no hours anyone didn't choose start refusing bookings (AC7). |

**Automated by:** `e2e/venue-catalogue.spec.ts` › "SCRUM-34 [AC3] TC-34-20: editing a venue whose hours were never recorded asks for them instead of saving 09:00–18:00"

### TC-34-21

| Item | Content |
|---|---|
| Test Case ID | TC-34-21 |
| Test Scenario | [Negative] AC 8: a request that slipped in while its venue was being retired can't be held, approved or confirmed |
| Pre-conditions | A venue with a Pending request, an unapproved hold and a hold Venue Staff approved, none flagged, all within opening hours; the venue is then retired. |
| Test Steps | 1. As Venue Staff, hold the request, then approve it. <br> 2. Approve the unapproved hold. <br> 3. As the Coordinator, confirm the approved hold. <br> 4. As Venue Staff, reject another request at the venue. |
| Test Data | — |
| Expected Result | 1–3: each refused with "… has been retired, so it can't be booked." and the step's usual ending ("This request is still pending.", "This hold is still awaiting approval.", "This hold is unchanged; you can still release it."); no status, approval or audit entry changes. 4: rejected as usual. |

**Automated by:** `tests/integration/venue-catalogue.test.ts` › "SCRUM-34 [AC8] TC-34-21: at a venue retired after its requests were made, nothing can be held, approved or confirmed; a request can still be rejected"

### TC-34-22

| Item | Content |
|---|---|
| Test Case ID | TC-34-22 |
| Test Scenario | [Negative] AC 2: a venue that doesn't exist |
| Pre-conditions | Signed in as a Coordinator. |
| Test Steps | 1. Open `/venues/ven_does_not_exist`. <br> 2. Open `/venues/ven_hall`. |
| Test Data | `coordinator@test.local` |
| Expected Result | 1: Not found, with HTTP status 404 (not a streamed 200). 2: the Exhibition Hall's details, with status 200. |

**Automated by:** `e2e/venue-catalogue.spec.ts` › "SCRUM-34 [AC2] TC-34-22: a venue that doesn't exist answers 404; a real one opens"
