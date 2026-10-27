# SCRUM-188 — Request a venue for exactly the event's period: test cases

Story and acceptance criteria: [docs/backlog/SCRUM-188.md](../backlog/SCRUM-188.md).
Format and conventions: [README.md](README.md). It supersedes SCRUM-50 AC1's
rounding ("start rounded down and end rounded up to the half hour"), so
[TC-50-15](SCRUM-50.md#tc-50-15)'s rounding is replaced by TC-188-01 to
TC-188-03. SCRUM-162 AC4 still holds: the period may be longer than the
event's but must cover it.

**Shared pre-conditions for every case:** the database is migrated and seeded
and the app is running. The tester signs in as the event's assigned
Coordinator (`coordinator@test.local` / `Password123!`). The event is in
Planning, with times off the half hour. Times are Singapore time.

| ID | Type | Criterion | Automated |
|---|---|---|---|
| [TC-188-01](#tc-188-01) | Positive | AC 1 | Unit, e2e |
| [TC-188-02](#tc-188-02) | Positive | AC 1 | Unit |
| [TC-188-03](#tc-188-03) | Negative, Boundary | AC 1 | Unit, e2e |
| [TC-188-04](#tc-188-04) | Positive, Boundary | AC 1, AC 2 | Integration |
| [TC-188-05](#tc-188-05) | Negative, Boundary | AC 2 | Integration |
| [TC-188-06](#tc-188-06) | Positive | AC 1, AC 2 | e2e |

---

### TC-188-01

| Item | Content |
|---|---|
| Test Case ID | TC-188-01 |
| Test Scenario | [Positive] AC 1: choosing an event on the request form fills in its start and end exactly, not rounded |
| Pre-conditions | A Planning event running 09:10–12:45 on 10 Mar 2035. |
| Test Steps | 1. Open **Request Venue**. <br> 2. Choose the event. <br> 3. Read **Start** and **End**. |
| Test Data | E2E Hall — Morning Lecture (10 Mar 2035, 09:10–12:45, 120 expected) |
| Expected Result | Start reads 10 Mar 2035, 09:10 and End 10 Mar 2035, 12:45 (not 09:00 and 13:00). Both fields accept any minute. The note under the period says it starts from the event's "exactly as the event has them". An event ending at 23:59 keeps 23:59 rather than rolling into the next day. |

**Automated by:** `tests/unit/request-form.test.tsx` › "SCRUM-188 [AC1] TC-188-01: the period is exactly the event's start and end, not rounded to the half hour", "SCRUM-188 [AC1] TC-188-01: an event's times given as ISO strings come back as the same instants" and "SCRUM-188 [AC1] TC-188-01: choosing an event fills in its start and end to the minute"; `e2e/bookings.spec.ts` › "SCRUM-188 [AC1] TC-188-01, SCRUM-162 [AC4] TC-162-05, TC-162-06, TC-162-07: the period and attendance start from the event's, the period exactly as the event has it; a shorter period or a larger attendance disables Submit" (which also picks an end of 12:44, so the fields take any minute); `e2e/venue-search.spec.ts` › "SCRUM-188 [AC1, AC2] TC-188-01, TC-188-06: …" (opened from venue search)

### TC-188-02

| Item | Content |
|---|---|
| Test Case ID | TC-188-02 |
| Test Scenario | [Positive] AC 1: a request for exactly the event's period is accepted and stored to the minute |
| Pre-conditions | A Planning event running 2:10 pm–3:45 pm on 1 Jun 2030, expecting 40. |
| Test Steps | 1. Send a request for 2:10 pm–3:45 pm directly to the server. |
| Test Data | Start 2030-06-01 14:10, End 2030-06-01 15:45 |
| Expected Result | The request is created Pending with start 2:10 pm and end 3:45 pm. Before SCRUM-188 this was refused, because the event's period was taken as 2:00 pm–4:00 pm. |

**Automated by:** `tests/unit/bookings.test.ts` › "SCRUM-188 [AC1] TC-188-02: a request for exactly the event's period is accepted and stored to the minute"

### TC-188-03

| Item | Content |
|---|---|
| Test Case ID | TC-188-03 |
| Test Scenario | [Negative, Boundary] AC 1: one minute short of the event at either end is refused, and the message names the event's own times |
| Pre-conditions | As TC-188-02; and, in the form, as TC-188-01. |
| Test Steps | 1. Send a request starting at 2:11 pm directly to the server. <br> 2. Send one ending at 3:44 pm. <br> 3. In the form, change End to 12:44. |
| Test Data | — |
| Expected Result | Steps 1 and 2: "The requested period must cover the event's whole period: 1 Jun 2030, 2:10 pm SGT to 1 Jun 2030, 3:45 pm SGT." against the start field; nothing is read or written. Step 3: "The requested period must cover the event's whole period: 10 Mar 2035, 9:10 am SGT to 10 Mar 2035, 12:45 pm SGT." and **Submit request** is disabled. Exactly the event's period is the boundary that is accepted (TC-188-02). |

**Automated by:** `tests/unit/bookings.test.ts` › "SCRUM-188 [AC1] TC-188-03: one minute short of the event at either end is refused, naming the event's own times, and nothing is written"; `e2e/bookings.spec.ts` › "SCRUM-188 [AC1] TC-188-01, SCRUM-162 [AC4] TC-162-05, TC-162-06, TC-162-07: …" (step 3)

### TC-188-04

| Item | Content |
|---|---|
| Test Case ID | TC-188-04 |
| Test Scenario | [Positive, Boundary] AC 1, AC 2: a venue that search lists as free for the event is free when the request form checks it and when it is submitted, and is booked for exactly the event's period |
| Pre-conditions | A venue with no setup or turnaround time. The event runs 10:10–11:50. Other events have Approved bookings of the venue from 08:00 to 10:10 and from 11:50 to 13:00, touching the event at both ends. |
| Test Steps | 1. Open venue search from the event. <br> 2. Choose **Request this venue** on that venue; read the period and the availability line. <br> 3. Submit. |
| Test Data | IT-188 Room, 12 Apr 2033 |
| Expected Result | Step 1: the venue is listed. Step 2: the period is 10:10–11:50, and the venue reads available. Step 3: one Pending booking from 10:10 to 11:50. Rounded to 10:00–12:00, the request overlapped both bookings and was refused. |

**Automated by:** `tests/integration/request-event-period.test.ts` › "SCRUM-188 [AC1, AC2] TC-188-04: a venue search lists as free for the event, between bookings that touch the event's start and end, is free when checked and requested, and is booked for exactly the event's period"

### TC-188-05

| Item | Content |
|---|---|
| Test Case ID | TC-188-05 |
| Test Scenario | [Negative, Boundary] AC 2: a booking that overlaps the event by one minute takes the venue out of the search, and the request is refused too |
| Pre-conditions | As TC-188-04, with one Approved booking: 08:00–10:11, or 11:49–13:00. |
| Test Steps | 1. Open venue search from the event. <br> 2. Ask the form's live check about the venue for the event's period. <br> 3. Send the request directly to the server. |
| Test Data | — |
| Expected Result | Step 1: the venue is not listed. Step 2: it reads unavailable. Step 3: "…is unavailable for that period: …", and no booking is written. Search and the request agree in both directions. |

**Automated by:** `tests/integration/request-event-period.test.ts` › "SCRUM-188 [AC2] TC-188-05: a booking that %s takes the venue out of the search, and requesting it is refused too, writing nothing" (ends one minute into the event; begins one minute before it ends)

### TC-188-06

| Item | Content |
|---|---|
| Test Case ID | TC-188-06 |
| Test Scenario | [Positive] AC 1, AC 2: in the browser, from venue search to a submitted request, for an event off the half hour |
| Pre-conditions | A Planning event running 10:15–11:45 on 20 Nov 2034. Another event's Approved booking of the Exhibition Hall from 08:00 to 10:15. |
| Test Steps | 1. Open the event's details, go to **Arrangements** and choose **Find a venue**. <br> 2. Choose **Request this venue** on the Exhibition Hall. <br> 3. Read Start, End and the availability line, and click **Submit request**. |
| Test Data | `coordinator@test.local`; Exhibition Hall |
| Expected Result | Step 1: the locked period reads **Event date** 20 Nov 2034, **Event start** 10:15 am SGT and **Event end** 11:45 am SGT, the end a time like the start, with no second date; the Exhibition Hall is listed. Step 3: Start 10:15, End 11:45, "Exhibition Hall is available for this period.", then back on the event's Arrangements, "Venue requested: Exhibition Hall. It is pending Venue Staff approval." (SCRUM-209). One Pending booking from 10:15 to 11:45. |

**Automated by:** `e2e/venue-search.spec.ts` › "SCRUM-188 [AC1, AC2] TC-188-01, TC-188-06: a venue search lists as free is requested for exactly the event's period, and is free when requested"
