# SCRUM-163 — Hold a venue tentatively until a deadline: test cases

Story and acceptance criteria: [docs/backlog/SCRUM-163.md](../backlog/SCRUM-163.md).
Format and conventions: [README.md](README.md). The database rules a hold
relies on (a live hold blocks like an approval, a lapsed one doesn't, and a
lapsed one can't be confirmed) are SCRUM-172's, tested in
[SCRUM-172.md](SCRUM-172.md) (TC-172-09, TC-172-13), and explained in
[ADR 0010's 2026-10-08 addendum](../adr/0010-database-prevents-venue-double-booking.md).

**Shared pre-conditions for every case:** a local PostgreSQL migrated with
`npm run db:deploy` and seeded with `npm run db:seed`. Accounts use the
password `Password123!`. Each automated case makes its own Planning event,
venue and pending request, so the seeded bookings are untouched. Times are
shown in Singapore time and stored in UTC.

| ID | Type | Criterion | Automated |
|---|---|---|---|
| [TC-163-01](#tc-163-01) | Positive | AC 1 | Unit, integration, e2e |
| [TC-163-02](#tc-163-02) | Boundary, Negative | AC 1 | Unit, integration, e2e |
| [TC-163-03](#tc-163-03) | Negative | AC 1 | Unit |
| [TC-163-04](#tc-163-04) | Positive, Negative | AC 2 | Unit, integration |
| [TC-163-05](#tc-163-05) | Concurrency | AC 2 | Unit, integration |
| [TC-163-06](#tc-163-06) | Positive | AC 3 | Unit, integration, e2e |
| [TC-163-07](#tc-163-07) | Positive | AC 3 | Unit, integration, e2e |
| [TC-163-08](#tc-163-08) | Boundary, Negative | AC 4 | Unit, integration |
| [TC-163-09](#tc-163-09) | Positive, Boundary | AC 5 | Unit, integration |
| [TC-163-10](#tc-163-10) | Positive | AC 5 | Unit, integration |
| [TC-163-11](#tc-163-11) | Positive | AC 6 | Unit, integration, e2e |
| [TC-163-12](#tc-163-12) | Positive, Negative | AC 7 | Unit, integration, e2e |
| [TC-163-13](#tc-163-13) | Positive | AC 9 | Unit, integration; partly blocked |
| [TC-163-14](#tc-163-14) | Concurrency | AC 8 | Unit, integration |
| [TC-163-15](#tc-163-15) | Negative | AC 3 | Unit |
| [TC-163-16](#tc-163-16) | Negative | AC 3 | Unit, integration, e2e |
| [TC-163-17](#tc-163-17) | Positive, Negative, Concurrency | AC 7 | Unit, integration, e2e |

---

### TC-163-01

| Item | Content |
|---|---|
| Test Case ID | TC-163-01 |
| Test Scenario | [Positive] AC 1: Venue Staff hold a pending request until a deadline, with a note |
| Pre-conditions | Signed in as `venuestaff@test.local`. A pending request for a Planning event on 1 Jul 2031, 9:00 am to 5:00 pm. |
| Test Steps | 1. Open Bookings. <br> 2. On the request, choose Hold. <br> 3. Set the expiry to 30 Jun 2031, 10:00 am and the note to "Confirm the final headcount." <br> 4. Choose Hold venue. |
| Test Data | `venuestaff@test.local` |
| Expected Result | The request reads "Held until 30 Jun 2031, 10:00 am SGT" with the note, and offers Approve and Reject but not Hold. The booking is `HELD` with that expiry, the note and `heldAt`; the history records a `HELD` entry by the Venue Staff member. |

**Automated by:** `e2e/holds.spec.ts` › "SCRUM-163 [AC1, AC3, AC6, AC7] TC-163-01, TC-163-06, TC-163-11, TC-163-12, TC-163-16, TC-163-17: Venue Staff hold a request and approve the hold, and only then its Coordinator confirms it"; `tests/integration/holds.test.ts` › "SCRUM-163 [AC1, AC5] TC-163-01, TC-163-09: holding a pending request saves its expiry and note, and writes the Coordinator's three notices"; `tests/unit/booking-holds.test.ts` › "SCRUM-163 [AC1, AC5] TC-163-01, TC-163-09: holds a pending request and writes the Coordinator's three notices with their show-from times"

### TC-163-02

| Item | Content |
|---|---|
| Test Case ID | TC-163-02 |
| Test Scenario | [Boundary, Negative] AC 1: the expiry must be later than now and earlier than the booking's start |
| Pre-conditions | As TC-163-01. |
| Test Steps | 1. Hold with an expiry of now, an hour ago, exactly the booking's start, or after it. <br> 2. Hold with an expiry one millisecond before the start. |
| Test Data | Expiry 2 Jul 2031, 10:00 am in the browser |
| Expected Result | Step 1: "The hold must expire after now and before the booking starts (1 Jul 2031, 9:00 am SGT).", shown by the expiry field; the request stays Pending and no notice or history is written. Step 2: the hold is placed. |

**Automated by:** `e2e/holds.spec.ts` › "SCRUM-163 [AC1] TC-163-02: a hold expiring after the booking starts is refused, and the request stays pending"; `tests/integration/holds.test.ts` › "SCRUM-163 [AC1] TC-163-02: an expiry at or after the booking's start is refused, and nothing is written"; `tests/unit/booking-holds.test.ts` › "SCRUM-163 [AC1] TC-163-02: an expiry at %s is refused, and nothing is written" and "… one millisecond before the booking starts is accepted"

### TC-163-03

| Item | Content |
|---|---|
| Test Case ID | TC-163-03 |
| Test Scenario | [Negative] AC 1: a hold that is invalid, by the wrong role, or on a request that isn't pending is refused, and nothing is written |
| Pre-conditions | — |
| Test Steps | 1. Hold with no expiry, an unreadable expiry, a blank note, or no booking. <br> 2. Hold as a Coordinator, Technical Support or Organiser. <br> 3. Hold a request that doesn't exist, is already held, has an expired hold, or was approved or rejected. <br> 4. Hold a request that someone else decides in the same moment. |
| Test Data | — |
| Expected Result | Step 1: "Choose when the hold expires.", "Say what the Coordinator must finalise." or "Please provide a valid hold.", before anything is read. Step 2: "You do not have permission to do that." Step 3: "Booking request not found.", "This request is already held for its Coordinator. You can approve or reject the hold until it expires.", "This hold expired at …" or "This request has already been approved; the original decision stands." Step 4: the first decision stands. Nothing is written in any case. |

**Automated by:** `tests/unit/booking-holds.test.ts` › every "SCRUM-163 [AC1] TC-163-03: …" and "SCRUM-163 [AC1, AC7] TC-163-03: …" test

### TC-163-04

| Item | Content |
|---|---|
| Test Case ID | TC-163-04 |
| Test Scenario | [Positive, Negative] AC 2: a held booking reserves its period like an approved one, and only the availability calendar shows "Held until [expiry]" |
| Pre-conditions | Two pending requests for overlapping periods at one venue; the first is held. |
| Test Steps | 1. Approve the second. <br> 2. Hold the second. <br> 3. Open Bookings. <br> 4. Open the venue's availability calendar for that week. |
| Test Data | — |
| Expected Result | Steps 1 and 2: "Conflicting: … is held from … to …. This request is still pending.", with no expiry; it stays Pending. Step 3: the held request shows its expiry and is free of clashes; the second lists the hold as its clash. Step 4: the period reads "Held until …", not "Booked". |

**Automated by:** `tests/integration/holds.test.ts` › "SCRUM-163 [AC2, AC7] TC-163-04, TC-163-12: a live hold blocks overlapping approvals and holds, stays in the queue with its expiry, and shows on the calendar as held"; `tests/unit/availability-calendar.test.tsx` › "SCRUM-163 [AC2] TC-163-04: a held booking reads as held until its expiry, in its words and its details, and an approved one as booked"; `tests/unit/venue-availability.test.ts` › the "TC-163-04" tests; `tests/unit/booking-holds.test.ts` › "SCRUM-163 [AC2, AC4] TC-163-04: a hold reserves its venue until, but not at, its expiry" and "SCRUM-163 [AC2] TC-163-04: a venue already approved or held for the period refuses the hold and names the clash"

### TC-163-05

| Item | Content |
|---|---|
| Test Case ID | TC-163-05 |
| Test Scenario | [Concurrency] AC 2: two overlapping requests held at the same moment |
| Pre-conditions | Two pending requests for overlapping periods at one venue. |
| Test Steps | 1. Hold both at the same instant. |
| Test Data | — |
| Expected Result | Exactly one is Held; the other gets "Conflicting: …" and stays Pending. |

**Automated by:** `tests/integration/holds.test.ts` › "SCRUM-163 [AC2] TC-163-05: two overlapping requests held at the same moment: exactly one is held"; `tests/unit/booking-holds.test.ts` › "SCRUM-163 [AC2] TC-163-05: the database refusing the hold as %s is reported as a conflict"

### TC-163-06

| Item | Content |
|---|---|
| Test Case ID | TC-163-06 |
| Test Scenario | [Positive] AC 3: the Coordinator confirms a hold Venue Staff have approved, before it expires |
| Pre-conditions | As TC-163-01, after the hold, and Venue Staff have approved it (TC-163-17). Signed in as `coordinator@test.local`, the event's Coordinator. |
| Test Steps | 1. Open Events and view the event's details. <br> 2. In the readiness checklist, choose Confirm hold. |
| Test Data | `coordinator@test.local` |
| Expected Result | Before step 2 the venue item reads "Held until 30 Jun 2031, 10:00 am SGT – confirm to secure" and "Approved by Venue Staff – awaiting confirmation.", and Confirm hold is enabled. After it, the item reads "Approved", and is complete. The booking is `APPROVED`, decided by the Coordinator, with a `HOLD_CONFIRMED` history entry. |

**Automated by:** `e2e/holds.spec.ts` › "SCRUM-163 [AC1, AC3, AC6, AC7] TC-163-01, TC-163-06, TC-163-11, TC-163-12, TC-163-16, TC-163-17: Venue Staff hold a request and approve the hold, and only then its Coordinator confirms it"; `tests/integration/holds.test.ts` › "SCRUM-163 [AC3, AC5, AC7] TC-163-06, TC-163-10, TC-163-12, TC-163-16: a hold is confirmed only once Venue Staff approve it, and only once, and confirming withdraws only its notices not yet shown"; `tests/unit/booking-holds.test.ts` › "SCRUM-163 [AC3, AC5] TC-163-06, TC-163-10: …"

### TC-163-07

| Item | Content |
|---|---|
| Test Case ID | TC-163-07 |
| Test Scenario | [Positive] AC 3: the Coordinator releases a hold, freeing the period |
| Pre-conditions | A held request and another pending request for an overlapping period. Signed in as the event's Coordinator. |
| Test Steps | 1. Choose Release hold. <br> 2. Release it again. <br> 3. As Venue Staff, approve the other request. |
| Test Data | — |
| Expected Result | Step 1: the booking is `CANCELLED`. Step 2: "This hold has already been released." Step 3: approved. |

**Automated by:** `e2e/holds.spec.ts` › "SCRUM-163 [AC3] TC-163-07: the Coordinator releases a hold, and the venue is free again"; `tests/integration/holds.test.ts` › "SCRUM-163 [AC3] TC-163-07: releasing a hold cancels it and frees the period for another request"; `tests/unit/booking-holds.test.ts` › "SCRUM-163 [AC3, AC5] TC-163-07, TC-163-10: …"

### TC-163-08

| Item | Content |
|---|---|
| Test Case ID | TC-163-08 |
| Test Scenario | [Boundary, Negative] AC 4: from its expiry, a hold no longer reserves the venue, reads Expired and can't be confirmed, with nobody acting at that time |
| Pre-conditions | A hold whose expiry was an hour ago; nothing has written to it since, so the row still says `HELD`. Another pending request for the same period. |
| Test Steps | 1. As the Coordinator, confirm it. <br> 2. Read the event's checklist and the Venue Staff queue. <br> 3. As Venue Staff, approve the other request. <br> 4. On another run, as the Coordinator, request the same venue for the same event again. <br> 5. Check the status one millisecond before and at the expiry. |
| Test Data | — |
| Expected Result | Step 1: "This hold expired at … so the venue is free for other requests. Make a new request if you still need it." Release, and Venue Staff's approve or reject, get the same answer. Step 2: "Hold expired"; the hold isn't in the queue. Step 3: approved, and the hold is now stored `EXPIRED`. Step 4: a new request is created (a lapsed hold isn't the event's booking any more), and the hold is stored `EXPIRED`; a hold that hasn't expired is returned as the event's booking instead. Step 5: Held, then Expired. |

**Automated by:** `tests/integration/holds.test.ts` › "SCRUM-163 [AC4] TC-163-08: from its expiry, a hold no longer reserves the venue, leaves the queue, reads Expired and can't be confirmed", "… after its hold lapses, the event can request the same venue again, even before anything marks it Expired" and "… a live hold is still the event's booking when it asks again"; `tests/unit/booking-holds.test.ts` › the "TC-163-08" tests; `tests/unit/bookings.test.ts` › "SCRUM-162 [AC2] TC-162-02, SCRUM-163 [AC4] TC-163-08: an event that already has a pending, approved or unexpired held booking at this venue is shown it and nothing is created"

### TC-163-09

| Item | Content |
|---|---|
| Test Case ID | TC-163-09 |
| Test Scenario | [Positive, Boundary] AC 5: the Coordinator is notified when the hold is placed, 24 hours before it expires, and when it expires |
| Pre-conditions | A pending request; the event's Coordinator is `usr_coordinator` (or none yet). |
| Test Steps | 1. Hold it with an expiry 48 hours away. <br> 2. On another request, hold with an expiry 2 hours away. |
| Test Data | — |
| Expected Result | Step 1: three notifications for the Coordinator, about the event and the booking: "A venue is held for your event" (with the deadline and the note) showing now, "A venue hold expires soon" showing 24 hours before the expiry, and "A venue hold expired" showing at the expiry. They appear in the notification list at those times with no job running (SCRUM-48 AC8). Step 2: the reminder shows straight away. With no Coordinator assigned, the notices go to whoever requested the venue. |

**Automated by:** `tests/integration/holds.test.ts` › "SCRUM-163 [AC1, AC5] TC-163-01, TC-163-09: …"; `tests/unit/booking-holds.test.ts` › the "TC-163-09" tests

### TC-163-10

| Item | Content |
|---|---|
| Test Case ID | TC-163-10 |
| Test Scenario | [Positive] AC 5: settling a hold withdraws its notices that haven't shown yet |
| Pre-conditions | A hold with an expiry 48 hours away (so its reminder and expiry notice are still to come). |
| Test Steps | 1. Confirm, release or reject it. |
| Test Data | — |
| Expected Result | The reminder and expiry notice are withdrawn and never appear; the "held" notice, already shown, stays. |

**Automated by:** `tests/integration/holds.test.ts` › "SCRUM-163 [AC3, AC5, AC7] TC-163-06, TC-163-10, TC-163-12, TC-163-16: …", "SCRUM-163 [AC5, AC7] TC-163-10, TC-163-12: …" and "SCRUM-163 [AC9] TC-163-13: …"; `tests/unit/booking-holds.test.ts` › the "TC-163-10" tests

### TC-163-11

| Item | Content |
|---|---|
| Test Case ID | TC-163-11 |
| Test Scenario | [Positive] AC 6: a Held or Expired booking never counts as Approved on the readiness checklist |
| Pre-conditions | A Planning event whose bookings are, in turn: a live hold; a lapsed hold (stored `HELD` or `EXPIRED`); a rejection then an expired hold, and the reverse; an expired hold then a pending request; a hold and an approval covering the event. |
| Test Steps | 1. Read the readiness checklist. |
| Test Data | Expiry 25 May 2031, 6:00 pm |
| Expected Result | "Held until 25 May 2031, 6:00 pm SGT – confirm to secure", incomplete; "Hold expired", incomplete; the newer of the two ("Hold expired", or "Rejected" with its reason); "Pending"; "Approved", ready. |

**Automated by:** `tests/unit/booking-holds.test.ts` › the "TC-163-11" tests; `tests/integration/holds.test.ts` › "SCRUM-163 [AC4] TC-163-08: from its expiry, …"; `e2e/holds.spec.ts` › "SCRUM-163 [AC1, AC3, AC6, AC7] …"

### TC-163-12

| Item | Content |
|---|---|
| Test Case ID | TC-163-12 |
| Test Scenario | [Positive, Negative] AC 7: held bookings stay in the queue; Venue Staff can reject one; settling twice changes nothing |
| Pre-conditions | A held request. |
| Test Steps | 1. As Venue Staff, open Bookings. <br> 2. Reject it with the reason "Roof repairs." <br> 3. As the Coordinator, confirm it. <br> 4. On another hold Venue Staff have approved, confirm twice, or at the same moment as a second click. |
| Test Data | — |
| Expected Result | Step 1: it is listed with its expiry and note, offering Approve and Reject (approving is TC-163-17). Step 2: `REJECTED` with the reason; its notices still to come are withdrawn. Step 3: "Venue Staff rejected this hold." Step 4: "This hold has already been confirmed."; one history entry. |

**Automated by:** `tests/integration/holds.test.ts` › "SCRUM-163 [AC5, AC7] TC-163-10, TC-163-12: Venue Staff reject a live hold with a reason, which withdraws its notices still to come" and "SCRUM-163 [AC2, AC7] TC-163-04, TC-163-12: …"; `tests/unit/booking-holds.test.ts` › the "TC-163-12" tests; `e2e/holds.spec.ts` › "SCRUM-163 [AC1, AC3, AC6, AC7] …" (step 1)

### TC-163-13

| Item | Content |
|---|---|
| Test Case ID | TC-163-13 |
| Test Scenario | [Positive] AC 9: rejecting the event releases its holds |
| Pre-conditions | A Planning event with a live hold. Signed in as its Coordinator. |
| Test Steps | 1. Reject the event (SCRUM-117). |
| Test Data | Reason "The venue can't be secured.", outcome Amend and resubmit |
| Expected Result | The hold is `CANCELLED` and its notices still to come are withdrawn. A lapsed hold is left Expired. |

**Automated by:** `tests/integration/holds.test.ts` › "SCRUM-163 [AC9] TC-163-13: rejecting the event releases its live hold and withdraws its notices still to come"; `tests/unit/reject-planning.test.ts` › "SCRUM-117 [AC3] TC-117-03: …". Unavailability recorded over a hold flags it, and it stays Held (`tests/integration/unavailability.test.ts` › "SCRUM-161 [AC3] TC-161-04: pending, held and approved bookings are all flagged, and their status, times and events don't change"). Cancelling the event releases its holds too (SCRUM-82): `tests/integration/close-event.test.ts` › "SCRUM-82 [AC3, AC6] TC-82-04: cancelling releases the booking, the hold, the reservation and its stock, the equipment request, the registration, the awaiting safety check and the change request together, and withdraws the notices written ahead".

### TC-163-14

| Item | Content |
|---|---|
| Test Case ID | TC-163-14 |
| Test Scenario | [Concurrency] AC 8: a confirmation at the moment the hold expires ends Approved or Expired, never both |
| Pre-conditions | A hold whose confirmation reaches the database at or after its expiry. |
| Test Steps | 1. Confirm it. |
| Test Data | — |
| Expected Result | The database refuses it (`booking_hold_expired`), and the Coordinator gets "This hold expired at …"; the booking is not Approved. A different database refusal is not reported as an expiry. |

**Automated by:** `tests/integration/holds.test.ts` › "SCRUM-163 [AC8] TC-163-14: a confirmation the database receives after the expiry is refused there, so the booking is never Approved" (the application's clock is set an hour behind, so only the database's guard refuses it); `tests/unit/booking-holds.test.ts` › "SCRUM-163 [AC8] TC-163-14: a confirmation the database judges to be at or after the expiry is refused as expired" and "… a different database failure is not mistaken for an expiry". The database rule itself: `tests/integration/week7-rules.test.ts` › TC-172-13.

### TC-163-15

| Item | Content |
|---|---|
| Test Case ID | TC-163-15 |
| Test Scenario | [Negative] AC 3: only the event's assigned Coordinator can confirm or release its hold |
| Pre-conditions | A held request for an event assigned to `usr_cody`. |
| Test Steps | 1. Confirm as another Coordinator. <br> 2. Confirm a hold on an event no Coordinator is assigned to. <br> 3. Confirm or release as Venue Staff, an Organiser or an Attendee. <br> 4. Release a booking id that doesn't exist, or none. |
| Test Data | — |
| Expected Result | Steps 1, 2 and 4: "Venue hold not found." Step 3: "You do not have permission to do that." Nothing is written. |

**Automated by:** `tests/unit/booking-holds.test.ts` › the "TC-163-15" tests

### TC-163-16

| Item | Content |
|---|---|
| Test Case ID | TC-163-16 |
| Test Scenario | [Negative] AC 3: a hold Venue Staff haven't approved can't be confirmed; it can still be released |
| Pre-conditions | As TC-163-01, after the hold, before Venue Staff approve it. Signed in as `coordinator@test.local`, the event's Coordinator. |
| Test Steps | 1. Open Events and view the event's details. <br> 2. Send a confirmation for the hold directly. <br> 3. On another run, choose Release hold. |
| Test Data | `coordinator@test.local` |
| Expected Result | Step 1: the venue item reads "Held until 30 Jun 2031, 10:00 am SGT – confirm to secure" and "Waiting for Venue Staff to approve the hold before it can be confirmed.", and Confirm hold is disabled. Step 2: "Venue Staff haven't approved this hold yet. You can confirm it once they have."; the booking stays `HELD`, and no history or notice is written. Step 3: the booking is `CANCELLED`. Once Venue Staff approve the hold, the item reads "Approved by Venue Staff – awaiting confirmation." and stays incomplete until it is confirmed (TC-163-06). |

**Automated by:** `tests/unit/booking-holds.test.ts` › "SCRUM-163 [AC3] TC-163-16: a hold Venue Staff haven't approved can't be confirmed, and nothing is written", "SCRUM-163 [AC3] TC-163-16: a confirmation that finds the hold still unapproved under the lock changes nothing", "SCRUM-163 [AC3, AC6, AC7] TC-163-16: a hold Venue Staff approved still keeps the venue incomplete until confirmed, and says it may now be confirmed" and "SCRUM-163 [AC3, AC5] TC-163-07, TC-163-10: releasing a live hold cancels it, approved by Venue Staff or not, and withdraws its notices still to come"; `tests/integration/holds.test.ts` › "SCRUM-163 [AC3, AC5, AC7] TC-163-06, TC-163-10, TC-163-12, TC-163-16: …"; `e2e/holds.spec.ts` › "SCRUM-163 [AC1, AC3, AC6, AC7] TC-163-01, TC-163-06, TC-163-11, TC-163-12, TC-163-16, TC-163-17: Venue Staff hold a request and approve the hold, and only then its Coordinator confirms it"

### TC-163-17

| Item | Content |
|---|---|
| Test Case ID | TC-163-17 |
| Test Scenario | [Positive, Negative, Concurrency] AC 7: Venue Staff approve a Held booking, which stays Held and shows "Approved by Venue Staff – awaiting confirmation"; approving it a second time changes nothing |
| Pre-conditions | As TC-163-01, after the hold, with its expiry 48 hours away. Signed in as `venuestaff@test.local`. |
| Test Steps | 1. On Bookings, choose Approve on the held request. <br> 2. Approve it again from another tab, or twice at the same moment. <br> 3. On other runs, approve a hold whose expiry has passed, or one its Coordinator confirmed or released a moment earlier. |
| Test Data | `venuestaff@test.local` |
| Expected Result | Step 1: the request stays `HELD` and in the queue, reads "Held until …" and "Approved by Venue Staff – awaiting confirmation", and offers Reject but no longer Approve. The booking records who approved it and when, the history has a `HOLD_APPROVED` entry, and the Coordinator is told "Venue Staff approved your hold" with the deadline (SCRUM-124 AC4, TC-124-04). Its reminder and expiry notice still stand. Step 2: "Venue Staff have already approved this hold. It is waiting for its Coordinator to confirm it."; one history entry and one notice in all. Step 3: "This hold expired at …", "This request has already been approved; the original decision stands." or "… cancelled …"; nothing is written. |

**Automated by:** `tests/unit/booking-holds.test.ts` › "SCRUM-163 [AC7] TC-163-17, SCRUM-124 [AC4] TC-124-04: Venue Staff approve a live hold: it stays Held, records who and when, and tells its Coordinator", "SCRUM-163 [AC7] TC-163-17: approving locks the event before the booking, the order holding a request uses", "SCRUM-163 [AC7] TC-163-17: approving a hold a second time changes nothing" and "SCRUM-163 [AC7] TC-163-17: a hold %s at the same moment is approved once, with no second notice or history entry"; `tests/unit/booking-queue.test.tsx` › "SCRUM-163 [AC7] TC-163-17: a hold Venue Staff haven't approved offers Approve and Reject; once approved it reads 'Approved by Venue Staff – awaiting confirmation' and offers Reject only"; `tests/integration/holds.test.ts` › "SCRUM-163 [AC7] TC-163-17, SCRUM-124 [AC4, AC14] TC-124-04: Venue Staff approve a hold: it stays Held and in the queue as approved, its Coordinator is told once, and approving again changes nothing" and "SCRUM-163 [AC7] TC-163-17, SCRUM-124 [AC14] TC-124-04: one hold approved twice at the same moment is approved once, with one notice and one history entry"; `e2e/holds.spec.ts` › "SCRUM-163 [AC1, AC3, AC6, AC7] TC-163-01, TC-163-06, TC-163-11, TC-163-12, TC-163-16, TC-163-17: Venue Staff hold a request and approve the hold, and only then its Coordinator confirms it"
