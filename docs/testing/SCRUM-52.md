# SCRUM-52 — Review Pending Booking Requests: test cases

Story and acceptance criteria: [docs/backlog/SCRUM-52.md](../backlog/SCRUM-52.md).
Format and conventions: [README.md](README.md).

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

**Automated by:** `tests/integration/bookings.test.ts` › "SCRUM-52 AC1 & AC2 — the queue lists pending requests with venue, timing, attendance, needs and the requesting coordinator"; `e2e/bookings.spec.ts` › "SCRUM-50 AC2, SCRUM-52 AC1-3, SCRUM-53 AC1 & AC3 — …"

### TC-52-02

| Item | Content |
|---|---|
| Test Case ID | TC-52-02 |
| Test Scenario | [Positive] AC 3: each request can be cross-checked against the venue's availability and details |
| Pre-conditions | One pending request on a free period; another pending request whose period an approved booking now overlaps. |
| Test Steps | 1. Open **Bookings** and compare the two cards. |
| Test Data | — |
| Expected Result | The free request shows "Free for this period". The other lists the clash ("already booked from … to …"). Attendance, each facility and the layout carry a tick when the venue meets them and a cross when it does not. There is no overall suitability verdict; that is SCRUM-40. |

**Automated by:** `tests/integration/bookings.test.ts` › "SCRUM-52 AC3 — each request carries the venue's current availability for its period"; `e2e/bookings.spec.ts` › journey ("Free for this period", capacity line)

### TC-52-03

| Item | Content |
|---|---|
| Test Case ID | TC-52-03 |
| Test Scenario | [Positive] AC 1: only pending requests are in the queue |
| Pre-conditions | A request has been approved or rejected. |
| Test Steps | 1. Decide a request. <br> 2. Look at the queue. |
| Test Data | — |
| Expected Result | The decided request is no longer listed. |

**Automated by:** `tests/integration/bookings.test.ts` › "SCRUM-52 AC1 — decided requests leave the queue"; `e2e/bookings.spec.ts` › journey and "SCRUM-53 AC2 — …" (card count drops to 0)

### TC-52-04

| Item | Content |
|---|---|
| Test Case ID | TC-52-04 |
| Test Scenario | [Negative] A Coordinator cannot reach the queue, including by typing its address |
| Pre-conditions | Signed in as a Coordinator. |
| Test Steps | 1. Check the navigation. <br> 2. Type `/bookings` into the address bar. |
| Test Data | `coordinator@test.local` |
| Expected Result | No Bookings link. The server renders "Access denied" rather than the queue. |

**Automated by:** `e2e/bookings.spec.ts` › "SCRUM-52 — a coordinator typing the queue's address is refused by the server"; `tests/unit/auth.test.ts` › "SCRUM-52 — only venue staff may read the pending-request queue"; `e2e/access-control.spec.ts` › "Coordinator sees only …"

### TC-52-05

| Item | Content |
|---|---|
| Test Case ID | TC-52-05 |
| Test Scenario | [Positive] AC 1: Venue Staff search the queue to find a request |
| Pre-conditions | Several pending requests. |
| Test Steps | 1. Type a word from a request (event, venue, location, coordinator, email, facility, layout, notes or a date such as "10 Mar 2035") into **Search pending requests**. <br> 2. Add a second word that no request has. <br> 3. Click **Clear search**. |
| Test Data | "seminar"; "seminar boardroom" |
| Expected Result | Step 1: only matching requests are listed, with "Showing N of M requests". Step 2: "No requests match …" with a **Clear search** button, because every word must match. Step 3: the full queue returns. Case does not matter. |

**Automated by:** `tests/unit/booking-queue.test.tsx` › the three "SCRUM-52 — …" matchesSearch cases; `e2e/bookings.spec.ts` › "SCRUM-53 AC2 — rejecting needs a written reason, and the reason is saved" (search step)
