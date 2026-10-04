# SCRUM-50 — Submit Venue Booking Request: test cases

Story and acceptance criteria: [docs/backlog/SCRUM-50.md](../backlog/SCRUM-50.md).
Format and conventions: [README.md](README.md). The overlap rule itself is
[lib/period.ts](../../lib/period.ts); why the database enforces it is
[ADR 0010](../adr/0010-database-prevents-venue-double-booking.md).

**Shared pre-conditions for every case:** the database is migrated and seeded
(`npm run db:deploy && npm run db:seed`), the app is running, and the tester
signs in as an Event Coordinator (`coordinator@test.local` / `Password123!`)
unless the case says otherwise. Cases use the Exhibition Hall in 2035, so
nothing seeded overlaps them. Times are Singapore time.

Since 2026-10-04 a request is always for its event's period and expected
attendance (AC 1, TC-50-15), so a case that needs a particular period uses an
event with that period. The e2e spec creates these as PLANNING events for
`coordinator@test.local` (named "E2E Hall — …") and removes them afterwards;
a manual tester creates the same events, or edits an event's dates.

| ID | Type | Criterion | Automated |
|---|---|---|---|
| [TC-50-01](#tc-50-01) | Positive | AC 1, AC 2 | Unit, integration, e2e |
| [TC-50-02](#tc-50-02) | Negative | AC 3 | Unit, integration, e2e |
| [TC-50-03](#tc-50-03) | Negative | AC 3 (unavailability) | Integration |
| [TC-50-04](#tc-50-04) | Positive | AC 3, AC 10 (pending blocks nobody) | Unit, integration |
| [TC-50-05](#tc-50-05) | Boundary | AC 4 | Unit, integration, e2e |
| [TC-50-06](#tc-50-06) | Negative, Boundary | AC 5 | Unit, integration |
| [TC-50-07](#tc-50-07) | Negative | AC 8 (one venue per event) | Unit, integration, e2e |
| [TC-50-08](#tc-50-08) | Concurrency | AC 8 | Unit, integration |
| [TC-50-09](#tc-50-09) | Negative | Coordinators only, own events only | Unit, integration, e2e |
| [TC-50-10](#tc-50-10) | Negative, Boundary | Attendance within venue capacity | Unit, integration, e2e |
| [TC-50-11](#tc-50-11) | Negative, Boundary | No period that has already started | Unit, integration |
| [TC-50-12](#tc-50-12) | Positive | AC 1 (room layout before venue) | Unit, e2e |
| [TC-50-13](#tc-50-13) | Negative, Boundary | AC 3, AC 4, AC 5 shown live, before submitting | Unit, integration, e2e |
| [TC-50-14](#tc-50-14) | Positive | AC 9 (a new request after a rejection or cancellation) | Integration |
| [TC-50-15](#tc-50-15) | Negative, Boundary | AC 1 (period and attendance fixed to the event) | Unit, integration, e2e |

---

### TC-50-01

| Item | Content |
|---|---|
| Test Case ID | TC-50-01 |
| Test Scenario | [Positive] AC 1, AC 2: a request for a free period is created Pending, with everything Venue Staff need |
| Pre-conditions | Signed in as a Coordinator. No approved booking or unavailability on the Exhibition Hall overlaps the test period. |
| Test Steps | 1. Open **Request Venue**. <br> 2. Choose the event, the layout, the venue and notes; the period and attendance come from the event. <br> 3. Click **Submit request**. |
| Test Data | Event: E2E Hall — Morning Lecture (10 Mar 2035, 09:10–12:45, 120 expected) <br> Layout: theatre <br> Venue: Exhibition Hall |
| Expected Result | A pop-up with a green tick: "Request submitted", the venue and times (9:00 am to 1:00 pm), and "It is pending Venue Staff approval." The form is then cleared. One PENDING booking exists holding the venue, times, attendance, facilities, layout, notes and the requesting coordinator. |

**Automated by:** `tests/integration/bookings.test.ts` › "SCRUM-50 AC1 & AC2 — a request for a free period is created PENDING with everything the staff need"; `tests/unit/bookings.test.ts` › "SCRUM-50 AC2 — a request for a free period is created PENDING"; `e2e/bookings.spec.ts` › "SCRUM-50 AC2, SCRUM-52 AC1-3, SCRUM-53 AC1 & AC3 — …"

### TC-50-02

| Item | Content |
|---|---|
| Test Case ID | TC-50-02 |
| Test Scenario | [Negative] AC 3: a request overlapping an approved booking is refused and nothing is created |
| Pre-conditions | TC-50-01's request has been approved by Venue Staff (see TC-53-01). |
| Test Steps | 1. Open **Request Venue**. <br> 2. Choose an event whose period overlaps the approved booking, and the Exhibition Hall. <br> 3. Read the availability line under the period. <br> 4. Send the same request directly to the server. |
| Test Data | Event: E2E Hall — Overlapping Talk (10 Mar 2035, 11:00–15:00) |
| Expected Result | Step 3, before anything is submitted: "Exhibition Hall is unavailable for this period: already booked from 10 Mar 2035, 9:00 am SGT to 10 Mar 2035, 1:00 pm SGT." **Submit request** is disabled. Step 4: the server refuses it with "…is unavailable for that period: …". No new booking row exists. The other booking's event is not named. |

**Automated by:** `tests/integration/bookings.test.ts` › "SCRUM-50 AC3 — a request overlapping an approved booking is refused and nothing is written"; `tests/unit/bookings.test.ts` › "SCRUM-50 AC3 — a venue already booked for part of the period refuses the request and names the clash"; `tests/unit/period.test.ts` › every "SCRUM-50 AC3 — …" case (overlapping, contained, identical, shared start, one minute); `e2e/bookings.spec.ts` › journey (screenshot attached to the report)

### TC-50-03

| Item | Content |
|---|---|
| Test Case ID | TC-50-03 |
| Test Scenario | [Negative] AC 3: a request overlapping recorded unavailability (maintenance) is refused |
| Pre-conditions | Seeded maintenance on Seminar Room 2.1 (`vun_seminar_maintenance`). |
| Test Steps | 1. Request Seminar Room 2.1 for a period inside the maintenance window. |
| Test Data | The seeded maintenance period |
| Expected Result | "…is unavailable for that period: unavailable (maintenance) from … to …". Nothing is created. |

**Automated by:** `tests/integration/bookings.test.ts` › "SCRUM-50 AC3 — a request overlapping recorded unavailability (maintenance) is refused"; `tests/unit/venue-availability.test.ts` › "SCRUM-50 AC3 — merges bookings and unavailability, earliest first"

### TC-50-04

| Item | Content |
|---|---|
| Test Case ID | TC-50-04 |
| Test Scenario | [Positive] AC 3, AC 10: another event's pending request does not make the venue unavailable |
| Pre-conditions | Another event has a PENDING (not approved) request for the venue and period, by another coordinator or by this one. |
| Test Steps | 1. As the first coordinator, request the same venue and period. |
| Test Data | `coordinator2@test.local` then `coordinator@test.local`, same venue, same period |
| Expected Result | The second request is also created Pending. Staff choose between them. |

**Automated by:** `tests/integration/bookings.test.ts` › "SCRUM-50 AC3 — a PENDING request by another coordinator does not block a new request" and "SCRUM-50 AC10 — another event's pending request for the same venue and period blocks nobody"; `tests/unit/venue-availability.test.ts` › "SCRUM-50 AC3 — asks only for APPROVED bookings that overlap the period — a pending request blocks nobody"

### TC-50-05

| Item | Content |
|---|---|
| Test Case ID | TC-50-05 |
| Test Scenario | [Boundary] AC 4: periods touching at an endpoint do not overlap |
| Pre-conditions | An approved booking 09:00–13:00 (TC-50-02). |
| Test Steps | 1. Request the hall for an event running 13:00–15:00. <br> 2. Separately, for an event ending at exactly 09:00. |
| Test Data | Event: E2E Hall — Afternoon Workshop (10 Mar 2035, 13:00–15:00) |
| Expected Result | Both requests are created Pending. |

**Automated by:** `tests/integration/bookings.test.ts` › "SCRUM-50 AC4 — a period beginning exactly as an approved booking ends is accepted" and "…ending exactly as an approved booking begins is accepted"; `tests/unit/period.test.ts` › every "SCRUM-50 AC4 — …" case; `e2e/bookings.spec.ts` › journey (last step)

### TC-50-06

| Item | Content |
|---|---|
| Test Case ID | TC-50-06 |
| Test Scenario | [Negative, Boundary] AC 5: an end earlier than or equal to the start is an invalid period |
| Pre-conditions | — |
| Test Steps | 1. Send a request with an end before the start directly to the server. <br> 2. Send one with an end equal to the start. |
| Test Data | Start 2035-04-01 15:00, End 2035-04-01 09:00; then Start = End = 15:00 |
| Expected Result | "The requested period is invalid: the end must be after the start." Nothing is created, and no other check runs first. One minute after the start is valid. The form cannot produce such a period, because it uses the event's (TC-50-15); the live check reports the same message if asked. |

**Automated by:** `tests/integration/bookings.test.ts` › "SCRUM-50 AC5 — an end before the start…" and "…an end equal to the start is refused as an invalid period"; `tests/unit/bookings.test.ts` › "SCRUM-50 AC5 — an end before or equal to the start is reported as an invalid period"; `tests/unit/period.test.ts` › every "SCRUM-50 AC5 — …" case; `tests/unit/bookings.test.ts` › "SCRUM-50 AC5 — an end before or equal to the start, or a missing time, is an invalid period and nothing is read" (live check)

### TC-50-07

| Item | Content |
|---|---|
| Test Case ID | TC-50-07 |
| Test Scenario | [Negative] AC 8: each event has one venue. Given the event already has a Pending or Approved booking, for any venue, a second request creates nothing and shows the existing one. Re-keyed on 2026-10-04 after the GLM review of #128; it was keyed on the coordinator, venue and period. |
| Pre-conditions | TC-50-01 is still pending (or has been approved). |
| Test Steps | 1. Click **Submit request** again with the same details. <br> 2. Choose the same event with the Grand Auditorium instead, and submit. |
| Test Data | As TC-50-01 |
| Expected Result | "This event already has a venue request. Each event has one venue." with the existing request's venue, times and status, both times. Still one booking row for the event. The database's `booking_one_venue_per_event` constraint enforces the same rule over Pending and Approved bookings (migration `20261004120000_one_venue_per_event`). A Rejected or Cancelled one does not count (TC-50-14). |

**Automated by:** `tests/integration/bookings.test.ts` › "SCRUM-50 AC8 — submitting the same request twice leaves one request and shows the existing one", "…an event with a pending booking at another venue is shown it, and no request is created", "…an event with a approved booking at another venue…" and "…the database itself refuses a second pending or approved booking for one event, whatever the venue or period"; `tests/unit/bookings.test.ts` › "SCRUM-50 AC8 — an event that already has a pending or approved booking, for any venue, is shown it and nothing is created" and "…the event's existing booking is shown even when the request differs from it"; `e2e/bookings.spec.ts` › journey

### TC-50-08

| Item | Content |
|---|---|
| Test Case ID | TC-50-08 |
| Test Scenario | [Concurrency] AC 8: two requests for the same event submitted at the same instant leave one |
| Pre-conditions | Real PostgreSQL. |
| Test Steps | 1. Fire the same request twice in parallel. |
| Test Data | As TC-50-01 |
| Expected Result | Both calls report the same booking id and one row exists. `booking_one_venue_per_event` lets one insert in; a deadlock between the two is retried once (ADR 0010). |

**Automated by:** `tests/integration/bookings.test.ts` › "SCRUM-50 AC8 — two identical requests submitted at the same instant still leave one"; `tests/unit/bookings.test.ts` › "SCRUM-50 AC8 — a second request for the event that races past the check…" and "…a deadlock between two identical submissions is retried once and then resolved"

### TC-50-09

| Item | Content |
|---|---|
| Test Case ID | TC-50-09 |
| Test Scenario | [Negative] Only Event Coordinators may request, and only for approved events they can act on |
| Pre-conditions | — |
| Test Steps | 1. Sign in as Venue Staff and open `/bookings/new` by typing it. <br> 2. As a Coordinator, check the event list. |
| Test Data | `venuestaff@test.local`; `coordinator2@test.local` |
| Expected Result | Venue Staff see "Access denied". The event list holds only APPROVED or PLANNING events the coordinator may act on. Another coordinator's event is refused as "Event not found." |

**Automated by:** `e2e/bookings.spec.ts` › "SCRUM-50 — venue staff typing the request form's address are refused by the server"; `tests/unit/auth.test.ts` › the three "SCRUM-50 — …" cases; `tests/unit/bookings.test.ts` › "SCRUM-50 — every role except Event Coordinator is refused…", "…an event that does not exist, or is another coordinator's, reads as not found", "…a venue cannot be requested for an event that has not been approved"; `tests/integration/bookings.test.ts` › "SCRUM-50 — the form offers only approved events the coordinator may act on, exactly as can() allows"

### TC-50-10

| Item | Content |
|---|---|
| Test Case ID | TC-50-10 |
| Test Scenario | [Negative, Boundary] Expected attendance above the chosen venue's capacity is refused; exactly at capacity fits. This rule is not in the SCRUM-50 criteria; the team added it on 2026-09-27. |
| Pre-conditions | — |
| Test Steps | 1. Choose an event expecting 250, and the Exhibition Hall (holds 200). <br> 2. Change to an event expecting 200. |
| Test Data | E2E Hall — Big Concert (250); E2E Hall — Full House (200) |
| Expected Result | Step 1: "Exhibition Hall holds up to 200 people; 250 expected is over its capacity." appears under the attendance, and **Submit request** is disabled. The server refuses the same request if sent directly, and nothing is written. Step 2: the error clears and Submit is enabled. |

**Automated by:** `e2e/bookings.spec.ts` › "SCRUM-50 — an event's attendance over the chosen venue's capacity is flagged, and Submit is disabled"; `tests/unit/bookings.test.ts` › "SCRUM-50 — expected attendance above the venue's capacity is refused…" and "…exactly equal to the venue's capacity fits"; `tests/integration/bookings.test.ts` › "SCRUM-50 — attendance over the venue's capacity is refused and nothing is written; exactly at capacity is accepted"

### TC-50-11

| Item | Content |
|---|---|
| Test Case ID | TC-50-11 |
| Test Scenario | [Negative, Boundary] A period that has already started cannot be requested. This rule is not in the SCRUM-50 criteria; it was added on 2026-09-28 after the GLM review of #96, mirroring the equipment form (SCRUM-31). |
| Pre-conditions | — |
| Test Steps | 1. Pick today's date in **Start**, and open the time picker. <br> 2. Send a request whose start is in the past directly to the server. |
| Test Data | Today; a start of 1 Jan 2020 |
| Expected Result | Step 1: times earlier than now are disabled; the half hour starting at this minute and later ones can be picked; earlier days cannot be picked in the calendar. Step 2: "The start time cannot be in the past." against the start field, and nothing is written. A start less than a minute ago still counts as now. |

**Automated by:** `tests/unit/bookings.test.ts` › "SCRUM-50 — a period that has already started is refused against the start field…" and "…a start less than a minute ago still counts as now"; `tests/integration/bookings.test.ts` › "SCRUM-50 — a period that has already started is refused and nothing is written"; `tests/unit/request-form.test.tsx` › the three isPastSlot cases

### TC-50-12

| Item | Content |
|---|---|
| Test Case ID | TC-50-12 |
| Test Scenario | [Positive] AC 1: the room layout is chosen before the venue, and only venues that support it are offered. Added on 2026-10-04 at the Product Owner's request. |
| Pre-conditions | — |
| Test Steps | 1. Open **Request Venue**. <br> 2. Choose **Room layout** "classroom" and open **Venue**. <br> 3. Choose Seminar Room 2.1, then change the layout to "banquet". <br> 4. Set the layout back to "No preference" and open **Venue**. |
| Test Data | Seeded venues and their supported layouts |
| Expected Result | Room layout sits above Venue. Step 2: only Seminar Room 2.1 is offered, with "Showing venues that support the classroom layout." Step 3: the venue is cleared because Seminar Room 2.1 cannot be set up for a banquet. Step 4: every active venue is offered. Choosing an event pre-selects its preferred layout, which narrows the venues the same way. |

**Automated by:** `e2e/bookings.spec.ts` › "SCRUM-50 AC1 — the room layout is chosen first, and only venues that support it are offered"; `tests/unit/request-form.test.tsx` › "SCRUM-50 AC1 — once a layout is chosen, only venues that support it are offered", "…with no layout preference, every venue is offered" and "…the room layout is asked for before the venue"

### TC-50-13

| Item | Content |
|---|---|
| Test Case ID | TC-50-13 |
| Test Scenario | [Negative, Boundary] AC 3, AC 4, AC 5: whether the venue is free is shown live as the period is chosen, and a taken venue or an invalid period disables Submit. Added on 2026-10-04 at the Product Owner's request. |
| Pre-conditions | An approved booking on the Exhibition Hall 2035-03-10 09:00–13:00 (TC-50-02). |
| Test Steps | 1. Choose the Exhibition Hall and the event running 11:00–15:00 that day. <br> 2. Change to the event running 13:00–15:00. |
| Test Data | E2E Hall — Overlapping Talk; E2E Hall — Afternoon Workshop |
| Expected Result | While the answer is fetched, "Checking whether Exhibition Hall is free…". Step 1: "…is unavailable for this period: already booked from … to …", and Submit is disabled. Step 2: "Exhibition Hall is available for this period.", and Submit is enabled (the touching end is not an overlap). An invalid period is reported as "The requested period is invalid: the end must be after the start." and disables Submit. A pending request blocks nobody, so it still reads available. A retired venue reads "Venue not found.", as it does on submit. The check writes nothing. Submitting checks again on the server, because a booking can be approved in between. |

**Automated by:** `tests/unit/bookings.test.ts` › every "checkVenueAvailability — SCRUM-50 live check" case; `tests/integration/bookings.test.ts` › every "SCRUM-50 — the live availability check in the form" case; `e2e/bookings.spec.ts` › journey; `e2e/availability.spec.ts` › "SCRUM-37 AC2-5, …" (maintenance shown live)

### TC-50-14

| Item | Content |
|---|---|
| Test Case ID | TC-50-14 |
| Test Scenario | [Positive] AC 9: given the previous request was Rejected or Cancelled, a new request creates a new booking record, and the earlier one is kept |
| Pre-conditions | The coordinator's earlier request for the venue and period is REJECTED (with a reason), or CANCELLED. |
| Test Steps | 1. Request the same venue and period again. |
| Test Data | As TC-50-01 |
| Expected Result | A new PENDING booking is created with a new id. The earlier booking still exists with its REJECTED or CANCELLED status. Two booking rows exist. |

**Automated by:** `tests/integration/bookings.test.ts` › "SCRUM-50 AC9 — after a rejected request, a new request creates a new booking record and the earlier one is kept" and "…after a cancelled request, …"

### TC-50-15

| Item | Content |
|---|---|
| Test Case ID | TC-50-15 |
| Test Scenario | [Negative, Boundary] AC 1: the period and expected attendance are the event's and cannot be edited; the period is rounded out to the half hour. Added on 2026-10-04 after the GLM review of #128. |
| Pre-conditions | An event running 09:10–12:45 expecting 120. |
| Test Steps | 1. Choose the event and try to change Start, End and Expected attendance. <br> 2. Send a request directly to the server with a different period, or a different attendance. <br> 3. Send one for an event with no dates or no expected attendance. |
| Test Data | E2E Hall — Morning Lecture (10 Mar 2035, 09:10–12:45, 120) |
| Expected Result | Step 1: Start reads "10 Mar 2035, 9:00 am SGT", End "10 Mar 2035, 1:00 pm SGT", attendance "120"; none can be edited. Step 2: "The requested period must be the event's: … to …." or "The expected attendance must be the event's: 120.", against that field, and nothing is written. Step 3: "This event has no dates or expected attendance yet. Set them on the event before requesting a venue." |

**Automated by:** `e2e/bookings.spec.ts` › "SCRUM-50 AC1 — the period and attendance are the event's, rounded out to the half hour, and cannot be edited"; `tests/unit/bookings.test.ts` › every "SCRUM-50 AC1 — the period and attendance are the event's" case; `tests/unit/request-form.test.tsx` › every "eventBookingPeriod — SCRUM-50 AC1" case and "…the period and attendance are shown read-only, taken from the event"; `tests/integration/bookings.test.ts` › "SCRUM-50 AC1 — a period or attendance that is not the event's is refused and nothing is written"
