# SCRUM-161 — Mark a venue unavailable over existing bookings and find a replacement venue: test cases

Story and acceptance criteria: [docs/backlog/SCRUM-161.md](../backlog/SCRUM-161.md).
Format and conventions: [README.md](README.md). Why recording unavailability
locks the affected events and bookings before the venue:
[ADR 0010, 2026-10-14 addendum](../adr/0010-database-prevents-venue-double-booking.md).

SCRUM-161 supersedes SCRUM-37 AC1 (the reason list), AC3 (refused over an
Approved booking) and the booking half of AC4. The SCRUM-37 cases that tested
those ([TC-37-05](SCRUM-37.md#tc-37-05), [TC-37-06](SCRUM-37.md#tc-37-06)) now
test only what is left of them: unavailability over unavailability is still
refused.

**Shared pre-conditions for every case:** the database is migrated and seeded,
the app is running, and the tester signs in as Venue Staff
(`venuestaff@test.local` / `Password123!`) unless the case says otherwise.
Cases use the Grand Auditorium on 12 Jan 2036, clear of anything seeded. Times
are Singapore time. "Booking" means a venue booking of any status unless the
case names one.

| ID | Type | Criterion | Automated |
|---|---|---|---|
| [TC-161-01](#tc-161-01) | Positive | AC 1, AC 2 | Unit, integration, e2e |
| [TC-161-02](#tc-161-02) | Positive | AC 1 | Unit, integration |
| [TC-161-03](#tc-161-03) | Negative | AC 1 | Unit, integration |
| [TC-161-04](#tc-161-04) | Positive | AC 3 | Unit, integration, e2e |
| [TC-161-05](#tc-161-05) | Boundary | AC 3 | Unit, integration |
| [TC-161-06](#tc-161-06) | Positive | AC 4 | Unit, integration, e2e |
| [TC-161-07](#tc-161-07) | Negative | AC 2 | Unit, integration |
| [TC-161-08](#tc-161-08) | Positive | AC 5 | Manual (blocked: SCRUM-38) |
| [TC-161-09](#tc-161-09) | Negative | AC 5 | Integration |
| [TC-161-10](#tc-161-10) | Negative | AC 6 | Unit, integration |
| [TC-161-11](#tc-161-11) | Positive | AC 6 | Manual (blocked: SCRUM-26) |
| [TC-161-12](#tc-161-12) | Concurrency | AC 7 | Unit, integration |
| [TC-161-13](#tc-161-13) | Negative | AC 8 | Unit, integration |
| [TC-161-14](#tc-161-14) | Negative | AC 1 (Venue Staff only, SCRUM-37 AC6) | Unit |
| [TC-161-15](#tc-161-15) | Positive | AC 3, AC 4 | Unit, integration |
| [TC-161-16](#tc-161-16) | Boundary | AC 1 (start and end on quarter hours) | Unit, e2e |

---

### TC-161-01

| Item | Content |
|---|---|
| Test Case ID | TC-161-01 |
| Test Scenario | [Positive] AC 1, AC 2: unavailability over a booking is shown with each affected booking first, then saved once confirmed |
| Pre-conditions | An Approved booking of the Grand Auditorium, 12 Jan 2036, 9:00 am to 1:00 pm, for an event assigned to Cody Coordinator. |
| Test Steps | 1. Open **Availability**, choose the Grand Auditorium and 12 Jan 2036. <br> 2. Click **Record unavailability**, enter the period and reason, and click **Record unavailability**. <br> 3. Read the list shown. <br> 4. Click **Record and flag 1 booking**. |
| Test Data | Start 12 Jan 2036 10:00 am, End 12:00 pm, Reason Equipment failure, Note "Projector rig down" |
| Expected Result | Step 3: nothing is saved yet; "This period overlaps 1 booking" lists the event's name, "Coordinator: Cody Coordinator", "Approved" and its period. Step 4: "Recorded: Grand Auditorium is unavailable for that period. 1 booking flagged for their Coordinators." The calendar shows the unavailability. One unavailability row is stored, with the reason, the note and who recorded it. |

**Automated by:** `tests/unit/unavailability.test.ts` › "SCRUM-161 [AC1, AC2] TC-161-01: a period over a booking saves nothing until each affected booking is confirmed" and "SCRUM-161 [AC1, AC2] TC-161-01: once every affected booking is confirmed, the period is saved over it"; `tests/integration/unavailability.test.ts` › "SCRUM-161 [AC1, AC2] TC-161-01: over an approved booking, the booking is shown first and the period saved once confirmed"; `e2e/availability.spec.ts` › "SCRUM-161 [AC1-AC4] TC-161-01, TC-161-04, TC-161-06, TC-161-16: unavailability over an approved booking, on quarter hours, is confirmed, saved, flags the booking and tells its Coordinator"

### TC-161-02

| Item | Content |
|---|---|
| Test Case ID | TC-161-02 |
| Test Scenario | [Positive] AC 1: each reason can be recorded, with or without a note; with nothing booked, no confirmation is asked |
| Pre-conditions | Nothing booked or recorded on the Grand Auditorium on 12 Jan 2036. |
| Test Steps | 1. Record each of Maintenance, Equipment failure, Renovation, Safety concern and Other, on separate non-overlapping periods, the first with a note and the rest without. |
| Test Data | Five one-hour periods on 12 Jan 2036 |
| Expected Result | Each is saved at once with "Recorded: Grand Auditorium is unavailable for that period." A blank note is stored as none. No booking is flagged and no notification is written. |

**Automated by:** `tests/unit/unavailability.test.ts` › "SCRUM-37 [AC1, AC2] TC-37-02: …", "SCRUM-37 [AC1] TC-37-02: a blank note is stored as none" and "SCRUM-172 [AC5] TC-172-05: …"; `tests/integration/unavailability.test.ts` › "SCRUM-37 [AC1] TC-37-02: venue staff record a period and a reason, and it is saved"

### TC-161-03

| Item | Content |
|---|---|
| Test Case ID | TC-161-03 |
| Test Scenario | [Negative] AC 1: the end must be after the start, and unavailability over unavailability already recorded is refused |
| Pre-conditions | Maintenance recorded 12 Jan 2036, 1:00 pm to 5:00 pm. An Approved booking 3:00 pm to 6:00 pm. |
| Test Steps | 1. Record with the end equal to the start. <br> 2. Record Renovation 4:00 pm to 7:00 pm. |
| Test Data | As above |
| Expected Result | Step 1: "The requested period is invalid: the end must be after the start." Step 2: "Not recorded: Grand Auditorium is unavailable (maintenance) from 12 Jan 2036, 1:00 pm SGT to 12 Jan 2036, 5:00 pm SGT." No affected bookings are listed. Nothing is saved and nothing is flagged in either step. |

**Automated by:** `tests/unit/unavailability.test.ts` › "SCRUM-37 [AC1] TC-37-03: an end at or before the start is refused as an invalid period" and "SCRUM-161 [AC1] TC-161-03: unavailability over unavailability already recorded is refused, and nothing is flagged"; `tests/integration/unavailability.test.ts` › "SCRUM-161 [AC1] TC-161-03: over unavailability already recorded, nothing is saved or flagged, even with a booking under both"

### TC-161-04

| Item | Content |
|---|---|
| Test Case ID | TC-161-04 |
| Test Scenario | [Positive] AC 3: every Pending, Held or Approved booking it overlaps is flagged with the reason and period, and nothing else about it changes |
| Pre-conditions | Three events, each with one booking of the Grand Auditorium on 12 Jan 2036: Pending 9:00 to 11:00 am, Held (expiring in two days) 11:00 am to 1:00 pm, Approved 1:00 to 3:00 pm. |
| Test Steps | 1. Record Safety concern 10:00 am to 2:00 pm with the note "Fire exit blocked", and confirm. <br> 2. Look at each booking and its event. |
| Test Data | As above |
| Expected Result | All three are flagged Needs Reconsideration with the reason "Grand Auditorium is unavailable: Safety concern from 12 Jan 2036, 10:00 am SGT to 12 Jan 2036, 2:00 pm SGT. Note: Fire exit blocked" and when it was raised. Each keeps its status (Pending, Held, Approved), its times and its hold expiry; each event keeps its status and details. Each flag is in the audit log. |

**Automated by:** `tests/unit/unavailability.test.ts` › "SCRUM-161 [AC3] TC-161-04: only the flag is written, with the reason and period"; `tests/integration/unavailability.test.ts` › "SCRUM-161 [AC3] TC-161-04: pending, held and approved bookings are all flagged, and their status, times and events don't change"; `e2e/availability.spec.ts` › journey

### TC-161-05

| Item | Content |
|---|---|
| Test Case ID | TC-161-05 |
| Test Scenario | [Boundary] AC 3: a booking whose occupied period only touches the unavailability isn't flagged; one whose setup or turnaround reaches into it is |
| Pre-conditions | On 12 Jan 2036: an Approved booking 9:00 to 11:00 am and another 3:00 to 5:00 pm; a Rejected, a Cancelled and a lapsed Held booking (expiry passed) inside 11:00 am to 3:00 pm. Separately, the venue's setup time set to 30 minutes and a Pending request 5:00 to 7:00 pm. |
| Test Steps | 1. Record Maintenance 11:00 am to 3:00 pm. <br> 2. Record Maintenance 3:00 to 5:00 pm on the day with the Pending request. |
| Test Data | As above |
| Expected Result | Step 1 is saved without a confirmation and flags nothing: the two Approved bookings only touch it, and the others don't occupy the venue. Step 2 lists the Pending request before saving: it starts as the period ends, but would occupy the venue from 4:30 pm with the venue's setup time (SCRUM-159). A booking whose turnaround makes its occupied period only touch the period is not listed; one minute more and it is. |

**Automated by:** `tests/unit/unavailability.test.ts` › "SCRUM-161 [AC3] TC-161-05: …" cases; `tests/integration/unavailability.test.ts` › "SCRUM-161 [AC3] TC-161-05: bookings that only touch it, and ones that don't occupy the venue, are not flagged" and "SCRUM-161 [AC3] TC-161-05: a booking whose setup time reaches into the period is affected"

### TC-161-06

| Item | Content |
|---|---|
| Test Case ID | TC-161-06 |
| Test Scenario | [Positive] AC 4: each affected event's assigned Coordinator is told alternative arrangements are required, with the venue, reason and period |
| Pre-conditions | As TC-161-01, after step 4. |
| Test Steps | 1. Sign in as `coordinator@test.local` and open **Notifications**. <br> 2. Sign in as Venue Staff and open **Notifications**. |
| Test Data | — |
| Expected Result | Step 1: "Alternative venue arrangements required": `"<event>": Grand Auditorium is unavailable (Equipment failure from 12 Jan 2036, 10:00 am SGT to 12 Jan 2036, 12:00 pm SGT), which overlaps your approved booking there. Alternative arrangements are required: find a replacement venue, then cancel this booking.` It links to the event. Step 2: every Venue Staff member has "Booking needs reconsideration" for that booking (SCRUM-124 AC8). One notice per booking for each recipient. |

**Automated by:** `tests/unit/unavailability.test.ts` › "SCRUM-161 [AC4] TC-161-06: the assigned Coordinator is told alternative arrangements are required, with venue, reason and period"; `tests/integration/unavailability.test.ts` › "SCRUM-161 [AC4] TC-161-06: each affected event's Coordinator, and every Venue Staff member, is notified once"; `e2e/availability.spec.ts` › journey

### TC-161-07

| Item | Content |
|---|---|
| Test Case ID | TC-161-07 |
| Test Scenario | [Negative] AC 2: a booking that became affected after Venue Staff were shown the list is shown before anything is saved |
| Pre-conditions | An Approved booking 9:00 to 11:00 am on 12 Jan 2036. |
| Test Steps | 1. Record Maintenance 10:00 am to 2:00 pm; the booking is listed. <br> 2. Meanwhile, another event's request for 12:00 to 1:00 pm is submitted. <br> 3. Click **Record and flag 1 booking**. |
| Test Data | As above |
| Expected Result | Step 3 saves nothing and lists both bookings. Nothing is flagged until Venue Staff confirm the new list. |

**Automated by:** `tests/unit/unavailability.test.ts` › "SCRUM-161 [AC2] TC-161-07: a booking not among those confirmed is shown again, and nothing is saved"; `tests/integration/unavailability.test.ts` › "SCRUM-161 [AC2] TC-161-07: a booking that became affected since is shown before anything is saved"

### TC-161-08

| Item | Content |
|---|---|
| Test Case ID | TC-161-08 |
| Test Scenario | [Positive] AC 5: from a flagged booking, Find a replacement venue opens venue search pre-filled from it, without the unavailable venue |
| Pre-conditions | A booking flagged by TC-161-01. Venue search (SCRUM-38) and the Coordinator's view of flagged bookings (SCRUM-26) exist. |
| Test Steps | 1. As the Coordinator, open the event. <br> 2. On the flagged booking, click **Find a replacement venue**. |
| Test Data | — |
| Expected Result | Venue search opens with the event's date and time fixed, and the attendance, facilities and layout from the booking (SCRUM-38 AC1). The Grand Auditorium is not among the results (SCRUM-38 AC3). The flagged booking stays on the event, still flagged. |

**Automated by:** Manual. Blocked: venue search is SCRUM-38 (To Do), and the Coordinator's panel of flagged bookings is SCRUM-26 (in review, #172).

### TC-161-09

| Item | Content |
|---|---|
| Test Case ID | TC-161-09 |
| Test Scenario | [Negative] AC 5: a replacement can't be requested while the flagged booking is live |
| Pre-conditions | A booking flagged by TC-161-01, still Approved. |
| Test Steps | 1. As the Coordinator, request a different venue for the same event. |
| Test Data | The Exhibition Hall |
| Expected Result | No request is created; the existing, flagged booking is shown. (Today this is SCRUM-50 AC8's one-venue rule; with several venues per event, SCRUM-162 must keep refusing it while the flagged booking is live.) |

**Automated by:** `tests/integration/unavailability.test.ts` › "SCRUM-161 [AC5] TC-161-09: no replacement can be requested while the flagged booking is live"

### TC-161-10

| Item | Content |
|---|---|
| Test Case ID | TC-161-10 |
| Test Scenario | [Negative] AC 6: while the unavailability overlaps it, a flagged booking can't be approved, held or confirmed |
| Pre-conditions | Maintenance recorded over three flagged bookings: one Pending, one Pending, one Held. |
| Test Steps | 1. As Venue Staff, approve the first. <br> 2. Hold the second. <br> 3. As the Coordinator, confirm the hold. |
| Test Data | — |
| Expected Result | Step 1 and 2: "Conflicting: Grand Auditorium is unavailable (maintenance) from … This request is still pending." Step 3: "This hold can't be confirmed: the venue is now unavailable for part of its period. Release it and arrange another venue." No status changes. |

**Automated by:** `tests/unit/booking-holds.test.ts` › "SCRUM-161 [AC6] TC-161-10: confirming a hold the database refuses over unavailability says so"; `tests/integration/unavailability.test.ts` › "SCRUM-161 [AC6] TC-161-10: a flagged booking can't be approved, held or confirmed over the unavailability"

### TC-161-11

| Item | Content |
|---|---|
| Test Case ID | TC-161-11 |
| Test Scenario | [Positive] AC 6: the Coordinator can't keep the flagged booking as Still stands, and cancels it, leaving the event's other bookings unchanged |
| Pre-conditions | A flagged Approved booking (TC-161-01) and the Coordinator's Still stands and Cancel arrangement choices (SCRUM-26). |
| Test Steps | 1. As the Coordinator, choose **Still stands**. <br> 2. Choose **Cancel arrangement**. |
| Test Data | — |
| Expected Result | Step 1 is refused with the unavailability as the reason (SCRUM-26 AC8). Step 2 cancels it and releases the venue; the event's other bookings don't change. |

**Automated by:** Manual. Blocked: Still stands and Cancel arrangement are SCRUM-26 (in review, #172). A flagged Pending request can already be withdrawn (SCRUM-142) and a flagged hold released (SCRUM-163).

### TC-161-12

| Item | Content |
|---|---|
| Test Case ID | TC-161-12 |
| Test Scenario | [Concurrency] AC 7: an approval and an unavailability for overlapping periods saved at the same moment |
| Pre-conditions | A Pending request overlapping the period. |
| Test Steps | 1. Venue Staff approve the request while another member of Venue Staff records (and confirms) unavailability over it, both past their own checks before either writes. |
| Test Data | — |
| Expected Result | The unavailability is saved. The booking is either still Pending and its approval refused, or Approved and flagged; never Approved without a flag. |

**Automated by:** `tests/unit/unavailability.test.ts` › "SCRUM-161 [AC7] TC-161-12: the affected events, then the bookings, then the venue are locked before anything is decided"; `tests/integration/concurrency.test.ts` › "SCRUM-161 [AC7] TC-161-12: …" cases

### TC-161-13

| Item | Content |
|---|---|
| Test Case ID | TC-161-13 |
| Test Scenario | [Negative] AC 8: recording the same unavailability twice saves it once and flags nothing new |
| Pre-conditions | TC-161-01 done. |
| Test Steps | 1. Record the same venue, period and reason again, and confirm. |
| Test Data | As TC-161-01 |
| Expected Result | "Already recorded: Grand Auditorium is unavailable for that period." Still one unavailability row; no new flag, audit entry or notification. |

**Automated by:** `tests/unit/unavailability.test.ts` › "SCRUM-161 [AC8] TC-161-13: the same unavailability again saves nothing and flags nothing"; `tests/integration/unavailability.test.ts` › "SCRUM-161 [AC8] TC-161-13: recording the same unavailability twice saves it once and flags nothing new"

### TC-161-14

| Item | Content |
|---|---|
| Test Case ID | TC-161-14 |
| Test Scenario | [Negative] AC 1: only Venue Staff can record unavailability (SCRUM-37 AC6, SCRUM-67) |
| Pre-conditions | — |
| Test Steps | 1. Call the record action as every other role. |
| Test Data | — |
| Expected Result | "You do not have permission to do that." Nothing is saved or flagged. |

**Automated by:** `tests/unit/unavailability.test.ts` › "SCRUM-37 [AC6] TC-37-03: only venue staff may record unavailability"

### TC-161-15

| Item | Content |
|---|---|
| Test Case ID | TC-161-15 |
| Test Scenario | [Positive] AC 3, AC 4: a booking already flagged for another reason keeps that reason, and its Coordinator is still told |
| Pre-conditions | An Approved booking already flagged "Event date changed" (SCRUM-26). |
| Test Steps | 1. Record maintenance over it, and confirm. |
| Test Data | — |
| Expected Result | The flag keeps its first reason and time (SCRUM-26: one flag, its first reason). The Coordinator gets "Alternative venue arrangements required". No second audit entry and no Venue Staff notice. |

**Automated by:** `tests/unit/unavailability.test.ts` › "SCRUM-161 [AC3, AC4] TC-161-15: a booking already flagged keeps its first reason, and its Coordinator is still told"; `tests/integration/unavailability.test.ts` › "SCRUM-161 [AC3, AC4] TC-161-15: a booking already flagged keeps its first reason, and its Coordinator is still told"

### TC-161-16

| Item | Content |
|---|---|
| Test Case ID | TC-161-16 |
| Test Scenario | [Boundary] AC 1: the start and end can be any quarter hour, not only the half hour that booking requests use |
| Pre-conditions | As TC-161-01. |
| Test Steps | 1. Open **Record unavailability** and open the Start time list. <br> 2. Record 10:15 am to 11:45 am over the approved booking, and confirm. |
| Test Data | Start 12 Jan 2036 10:15 am, End 11:45 am, Equipment failure |
| Expected Result | Step 1: the list offers every 15 minutes (… 9:45 am, 10:00 am, 10:15 am …) and nothing in between. Step 2: saved for exactly 10:15 to 11:45, and the booking's flag reason names those times. A booking request's and a hold expiry's time lists still offer half hours only (SCRUM-50 AC1, SCRUM-163). |

**Automated by:** `tests/unit/request-form.test.tsx` › "SCRUM-161 [AC1] TC-161-16: unavailability can start and end on any quarter hour, and nothing in between"; `e2e/availability.spec.ts` › "SCRUM-161 [AC1-AC4] TC-161-01, TC-161-04, TC-161-06, TC-161-16: …"
