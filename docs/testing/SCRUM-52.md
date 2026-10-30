# SCRUM-52 — Review Pending Booking Requests: test cases

Story and acceptance criteria: [docs/backlog/SCRUM-52.md](../backlog/SCRUM-52.md).
Format and conventions: [README.md](README.md).

> **Week 7 (SCRUM-158).** AC 1 shows Pending requests only, and AC 3 shows overlaps against bare periods. SCRUM-163 adds Held requests to the queue and their expiry; SCRUM-159 compares AC 3's overlaps against occupied periods. The cases below test the behaviour as built before those stories land.

**Shared pre-conditions for every case:** the database is migrated and seeded,
the app is running, and the tester signs in as Venue Staff
(`venuestaff@test.local` / `Password123!`) unless the case says otherwise. The
seed holds one pending request (`bkg_pending`, Seminar Room 2.1).

| ID | Type | Criterion | Automated |
|---|---|---|---|
| [TC-52-01](#tc-52-01) | Positive | AC 1, AC 2 | Integration, e2e |
| [TC-52-02](#tc-52-02) | Positive | AC 3 | Integration, e2e |
| [TC-52-03](#tc-52-03) | Positive | AC 1 | Integration, e2e |
| [TC-52-04](#tc-52-04) | Negative | Venue Staff only | Unit, e2e |
| [TC-52-05](#tc-52-05) | Positive | AC 1 (finding a request in the queue) | Unit, e2e |
| [TC-52-06](#tc-52-06) | Positive | AC 4 | Unit |

---

### TC-52-01

| Item | Content |
|---|---|
| Test Case ID | TC-52-01 |
| Test Scenario | [Positive] AC 1, AC 2: the queue lists each pending request with venue, timing, attendance, facilities/layout and the coordinator |
| Pre-conditions | A Coordinator has submitted TC-50-01. |
| Test Steps | 1. Open **Bookings**. <br> 2. Find the Exhibition Hall request. |
| Test Data | As TC-50-01 |
| Expected Result | The card shows the event, "10 Mar 2035, 9:00 am to 10 Mar 2035, 1:00 pm", "Requested by Cody Coordinator" with "coordinator@test.local", Exhibition Hall and its location, "120 expected · venue holds 200", the facilities (as green or red pills) and layout asked for, and the notes, each fact led by its own icon. Soonest request first. |

**Automated by:** `tests/integration/bookings.test.ts` › "SCRUM-52 [AC1, AC2] TC-52-01: the queue lists pending requests with venue, timing, attendance, needs and the requesting coordinator"; `e2e/bookings.spec.ts` › "SCRUM-50 [AC1, AC2] TC-50-01, SCRUM-52 [AC1, AC2] TC-52-01, SCRUM-53 [AC1, AC4] TC-53-01, SCRUM-162 [AC2] TC-162-02, SCRUM-207 [AC3, AC4] TC-207-06, TC-207-08: a coordinator requests, staff approve, and the venue becomes unavailable"

### TC-52-02

| Item | Content |
|---|---|
| Test Case ID | TC-52-02 |
| Test Scenario | [Positive] AC 3: each request can be cross-checked against the venue's availability and details |
| Pre-conditions | One pending request on a free period; another pending request whose period an approved booking now overlaps. |
| Test Steps | 1. Open **Bookings** and compare the two cards. |
| Test Data | — |
| Expected Result | The free request shows "Free for this period". The other lists the clash ("already booked from … to …"). Attendance, each facility and the layout carry a tick when the venue meets them and a cross when it does not. There is no overall suitability verdict; that is SCRUM-40. |

**Automated by:** `tests/integration/bookings.test.ts` › "SCRUM-52 [AC3] TC-52-02: each request carries the venue's current availability for its period"; `e2e/bookings.spec.ts` › journey ("Free for this period", capacity line)

### TC-52-03

| Item | Content |
|---|---|
| Test Case ID | TC-52-03 |
| Test Scenario | [Positive] AC 1: only pending requests are in the queue |
| Pre-conditions | A request has been approved or rejected. |
| Test Steps | 1. Decide a request. <br> 2. Look at the queue. |
| Test Data | — |
| Expected Result | The decided request is no longer listed. |

**Automated by:** `tests/integration/bookings.test.ts` › "SCRUM-52 [AC1] TC-52-03: decided requests leave the queue"; `e2e/bookings.spec.ts` › journey and "SCRUM-53 [AC2] TC-53-02, TC-53-03: …" (card count drops to 0)

### TC-52-04

| Item | Content |
|---|---|
| Test Case ID | TC-52-04 |
| Test Scenario | [Negative] A Coordinator cannot reach the queue, including by typing its address |
| Pre-conditions | Signed in as a Coordinator. |
| Test Steps | 1. Check the navigation. <br> 2. Type `/bookings` into the address bar. |
| Test Data | `coordinator@test.local` |
| Expected Result | No Bookings link. The server renders "Access denied" rather than the queue. |

**Automated by:** `e2e/bookings.spec.ts` › "SCRUM-52 TC-52-04: a coordinator typing the queue's address is refused by the server"; `tests/unit/auth.test.ts` › "SCRUM-52 TC-52-04: only venue staff may read the pending-request queue"; `e2e/access-control.spec.ts` › "SCRUM-65 [AC1, AC3] TC-65-01, SCRUM-66 [AC1, AC2, AC3] TC-66-01: ${role} sees only …" (the Coordinator case)

### TC-52-05

| Item | Content |
|---|---|
| Test Case ID | TC-52-05 |
| Test Scenario | [Positive] AC 1: Venue Staff search the queue to find a request |
| Pre-conditions | Several pending requests. |
| Test Steps | 1. Type a word from a request (event, venue, location, coordinator, email, facility, layout, notes or a date such as "10 Mar 2035") into **Search by event, venue or coordinator**. <br> 2. Add a second word that no request has. <br> 3. Click **Clear search**. |
| Test Data | "seminar"; "seminar boardroom" |
| Expected Result | Step 1: only matching requests are listed. Step 2: "No requests match …" with a **Clear search** button, because every word must match. Step 3: the full queue returns. Case does not matter. The box is the one every queue shares (SCRUM-211 AC2). |

**Automated by:** `tests/unit/booking-search.test.ts` › the four "SCRUM-52 [AC1] TC-52-05: …" cases; `e2e/bookings.spec.ts` › "SCRUM-53 [AC2] TC-53-02, TC-53-03: rejecting needs a written reason, and the reason is saved" (search step); `e2e/work-queues.spec.ts` › "SCRUM-211 [AC2] TC-211-15, SCRUM-52 [AC1] TC-52-05: the one search box finds a request by its venue and by its Coordinator"

### TC-52-06

| Item | Content |
|---|---|
| Test Case ID | TC-52-06 |
| Test Scenario | [Positive] AC 4: with no pending requests, the queue shows an empty-state message rather than nothing |
| Pre-conditions | No booking request is Pending. |
| Test Steps | 1. Open **Bookings**. |
| Test Data | — |
| Expected Result | "Nothing waiting. You're all caught up." is shown (the empty state every queue shares, SCRUM-211), and no request is offered to **Approve**. |

**Automated by:** `tests/unit/booking-queue.test.tsx` › "SCRUM-52 [AC4] TC-52-06, SCRUM-211 [AC2] TC-211-05: …"
