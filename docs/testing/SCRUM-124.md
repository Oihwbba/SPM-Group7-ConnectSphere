# SCRUM-124 — Staff and arrangement notifications: test cases

Story and acceptance criteria: [docs/backlog/SCRUM-124.md](../backlog/SCRUM-124.md).
Format and conventions: [README.md](README.md).

**Status:** SCRUM-124 is a list of triggers. Every trigger whose step is
built writes its notice, in the same transaction as the step, so a step that
is refused or loses a race tells nobody (AC 14). Every trigger is built: AC 10
comes with SCRUM-165's Unassigned queue, and AC 11's notices are sent by
SCRUM-166's safety check itself.

How each notice reaches its reader (AC 12, AC 15): every notice names the
event and the arrangement and says what happened, and appears in the
reader's own notification list (SCRUM-48). A Coordinator's notice opens the
event; a Venue Staff notice opens the Bookings queue, a Technical Support
notice the Equipment or Equipment Requests page. Staff notices go to
everyone with the role (AC 13).

**Shared pre-conditions for every case:** the database is migrated and
seeded, so `venuestaff@test.local` and `techsupport@test.local` exist. A
Planning event is assigned to `coordinator@test.local` unless the case says
otherwise. Times are shown in Singapore time.

| ID                      | Type                       | Criterion                    | Automated                    |
| ----------------------- | -------------------------- | ---------------------------- | ---------------------------- |
| [TC-124-01](#tc-124-01) | Positive, Negative         | AC 1, AC 12–15               | Unit, integration, e2e       |
| [TC-124-02](#tc-124-02) | Positive, Negative         | AC 2, AC 12–14               | Unit, integration            |
| [TC-124-03](#tc-124-03) | Positive                   | AC 3, AC 13                  | Integration |
| [TC-124-04](#tc-124-04) | Positive, Negative         | AC 4, AC 12, AC 14, AC 15    | Unit, integration, e2e       |
| [TC-124-05](#tc-124-05) | Positive, Boundary         | AC 5                         | Unit, integration            |
| [TC-124-06](#tc-124-06) | Positive, Negative         | AC 6, AC 12–14               | Unit, integration            |
| [TC-124-07](#tc-124-07) | Positive                   | AC 7, AC 12, AC 14           | Unit, integration            |
| [TC-124-08](#tc-124-08) | Positive, Negative         | AC 8, AC 12–14               | Unit, integration               |
| [TC-124-09](#tc-124-09) | Positive, Negative         | AC 9, AC 12–14               | Unit, integration            |
| [TC-124-10](#tc-124-10) | Positive                   | AC 10                        | Unit, integration            |
| [TC-124-11](#tc-124-11) | Positive                   | AC 11                        | Integration                  |

---

### TC-124-01

| Item | Content |
|---|---|
| Test Case ID | TC-124-01 |
| Test Scenario | [Positive, Negative] AC 1, AC 12–15: every Venue Staff member is told, once, when a venue is requested |
| Pre-conditions | Signed in as `coordinator@test.local`. The event has no venue request. |
| Test Steps | 1. Request the Exhibition Hall for the event. <br> 2. As `venuestaff@test.local`, open Notifications and the new notice. <br> 3. Send the same request again, or twice at the same moment. <br> 4. Send a request that is refused (over the venue's capacity). |
| Test Data | The event's period and expected attendance |
| Expected Result | 1–2: one notice per Venue Staff member, "A venue was requested": 'The Coordinator requested [venue] for "[event]", [start] to [end], for [n] attendees.' It is in their own list and opens Bookings. 3: one booking, and still one notice each. 4: no notice. |

**Automated by:** `tests/unit/bookings.test.ts` › the four "SCRUM-124 … TC-124-01" tests; `tests/integration/staff-notifications.test.ts` › "SCRUM-124 [AC1, AC13, AC15] TC-124-01: a venue request tells every Venue Staff member once, in their own notification list" and "SCRUM-124 [AC1, AC14] TC-124-01: the same request sent twice at the same moment makes one booking and tells each Venue Staff member once"; `e2e/staff-notifications.spec.ts` › "SCRUM-124 [AC1, AC4, AC12, AC15] TC-124-01, TC-124-04: Venue Staff learn of a request from their notifications, and the Coordinator learns it was approved from theirs"

### TC-124-02

| Item | Content |
|---|---|
| Test Case ID | TC-124-02 |
| Test Scenario | [Positive, Negative] AC 2, AC 12–14: every Technical Support member is told, once, when an equipment request is submitted or its lines change |
| Pre-conditions | Signed in as `coordinator@test.local`. The event has no open equipment request. |
| Test Steps | 1. Submit a request for 2 Projectors and 4 Wireless Microphones. <br> 2. Submit again while it is open, or twice at the same moment. <br> 3. Submit a request with an unknown equipment type. <br> 4. Change the open request's lines (SCRUM-142). |
| Test Data | Projector × 2, Wireless Microphone × 4 |
| Expected Result | 1: one notice per Technical Support member, "An equipment request was submitted": 'The Coordinator requested equipment for "[event]": Projector × 2, Wireless Microphone × 4.', opening Equipment Requests. 2: one request, and still one notice each. 3: refused, no notice. 4: "An equipment request changed", to each of them. |

**Automated by:** `tests/unit/equipment-request.test.ts` › the three "SCRUM-124 … TC-124-02" tests; `tests/integration/staff-notifications.test.ts` › "SCRUM-124 [AC2, AC14] TC-124-02: the same equipment request sent twice at the same moment tells each Technical Support member once"; line changes: `tests/integration/change-or-withdraw.test.ts` › "SCRUM-142 [AC1, AC2, AC7] TC-142-01, TC-142-02: changing lines sends the request back to Pending Review, releases what changed lines had reserved, records it and tells Technical Support"

### TC-124-03

| Item | Content |
|---|---|
| Test Case ID | TC-124-03 |
| Test Scenario | [Positive] AC 3, AC 13: withdrawing a pending venue request tells every Venue Staff member; withdrawing a whole equipment request tells every Technical Support member |
| Pre-conditions | A pending venue request and an open equipment request for the event. |
| Test Steps | 1. As the Coordinator, withdraw the venue request. <br> 2. Withdraw the equipment request. |
| Test Data | — |
| Expected Result | 1: "A venue request was withdrawn", to each Venue Staff member. 2: "An equipment request was withdrawn", to each Technical Support member. A held request is released instead, and Venue Staff are told so (TC-124-06). |

**Automated by:** `tests/integration/change-or-withdraw.test.ts` › "SCRUM-142 [AC4, AC7, AC8] TC-142-07: withdrawing a pending venue request cancels only it, tells Venue Staff, and lets the event request the venue again" and "SCRUM-142 [AC3, AC7, AC8] TC-142-05: withdrawing the whole request cancels it and returns all its reserved equipment, once"

### TC-124-04

| Item | Content |
|---|---|
| Test Case ID | TC-124-04 |
| Test Scenario | [Positive, Negative] AC 4, AC 12, AC 14, AC 15: the event's assigned Coordinator is told, once, when Venue Staff approve, hold or reject its venue request, or approve its hold |
| Pre-conditions | Signed in as `venuestaff@test.local`. A pending request for a Planning event assigned to `coordinator@test.local`. |
| Test Steps | 1. Approve it. <br> 2. On another request, reject it with a reason. <br> 3. Hold another until a deadline, with a note; approve the hold; then, on another, reject a live hold with a reason. <br> 4. Approve the same request twice at the same moment, or after someone else decided it. <br> 5. On an event with no Coordinator yet, decide its request. |
| Test Data | Reasons "The hall is closed for repairs." and "Roof repairs."; note "Confirm the final headcount." |
| Expected Result | 1: "Your venue request was approved": 'Venue Staff approved [venue] for "[event]", [start] to [end].' 2: "Your venue request was rejected": '… Their reason: The hall is closed for repairs.' 3: "A venue is held for your event" with the deadline and note; "Venue Staff approved your hold" with the deadline; "Venue Staff rejected your hold" with the reason. Each opens the event. 4: one decision, one notice. 5: the notice goes to whoever requested the venue. |

**Automated by:** `tests/unit/bookings.test.ts` › the seven "SCRUM-124 … TC-124-04" tests; `tests/unit/booking-holds.test.ts` › "SCRUM-124 [AC4, AC12] TC-124-04: rejecting a live hold tells the event's Coordinator the reason", "SCRUM-163 [AC1, AC5] TC-163-01, TC-163-09: holds a pending request and writes the Coordinator's three notices with their show-from times", "SCRUM-163 [AC7] TC-163-17, SCRUM-124 [AC4] TC-124-04: Venue Staff approve a live hold: it stays Held, records who and when, and tells its Coordinator" and "SCRUM-124 [AC4] TC-124-04: an event with no Coordinator yet tells whoever requested the venue"; `tests/integration/staff-notifications.test.ts` › "SCRUM-124 [AC4, AC14] TC-124-04: two approvals of the same request at the same moment tell the Coordinator once"; `tests/integration/holds.test.ts` › "SCRUM-163 [AC7] TC-163-17, SCRUM-124 [AC4, AC14] TC-124-04: …" and "SCRUM-163 [AC7] TC-163-17, SCRUM-124 [AC14] TC-124-04: …"; `e2e/staff-notifications.spec.ts` › "SCRUM-124 [AC1, AC4, AC12, AC15] TC-124-01, TC-124-04: Venue Staff learn of a request from their notifications, and the Coordinator learns it was approved from theirs" and "SCRUM-124 [AC4, AC12] TC-124-04: rejecting a request in the queue tells the Coordinator the reason"

### TC-124-05

| Item | Content |
|---|---|
| Test Case ID | TC-124-05 |
| Test Scenario | [Positive, Boundary] AC 5: a hold writes its reminder and expiry notice ahead, shown from 24 hours before the expiry and from the expiry, and withdraws them if it is settled first |
| Pre-conditions | A pending request; Venue Staff hold it. |
| Test Steps | 1. Hold it until 48 hours from now. <br> 2. Hold another until 12 hours from now. <br> 3. Confirm, release or reject a hold before its expiry. |
| Test Data | — |
| Expected Result | 1: the reminder shows from 24 hours before the expiry, the expiry notice from the expiry; neither shows before then. 2: the reminder shows at once. 3: both are withdrawn and never appear; the notice of the hold itself stays. |

**Automated by:** `tests/unit/booking-holds.test.ts` › the "TC-163-09" and "TC-163-10" tests; `tests/integration/holds.test.ts` › "SCRUM-163 [AC1, AC5] TC-163-01, TC-163-09: holding a pending request saves its expiry and note, and writes the Coordinator's three notices" and "SCRUM-163 [AC3, AC5, AC7] TC-163-06, TC-163-10, TC-163-12, TC-163-16: a hold is confirmed only once Venue Staff approve it, and only once, and confirming withdraws only its notices not yet shown"

### TC-124-06

| Item | Content |
|---|---|
| Test Case ID | TC-124-06 |
| Test Scenario | [Positive, Negative] AC 6, AC 12–14: every Venue Staff member is told, once, when the Coordinator confirms or releases a hold |
| Pre-conditions | A live hold Venue Staff have approved. Signed in as `coordinator@test.local`. |
| Test Steps | 1. Confirm the hold. <br> 2. On another, release it (or withdraw the held request, SCRUM-142). <br> 3. Confirm a hold that was confirmed a moment earlier. |
| Test Data | — |
| Expected Result | 1: "A hold was confirmed": 'The Coordinator confirmed the hold on [venue] for "[event]", so it is now booked.', to each Venue Staff member, opening Bookings. 2: "A hold was released": '… so its period is free again.' 3: "This hold has already been confirmed.", and no notice. |

**Automated by:** `tests/unit/booking-holds.test.ts` › the four "SCRUM-124 … TC-124-06" tests; `tests/integration/staff-notifications.test.ts` › "SCRUM-124 [AC6, AC13] TC-124-06: confirming a hold tells every Venue Staff member once, linking to their queue"

### TC-124-07

| Item | Content |
|---|---|
| Test Case ID | TC-124-07 |
| Test Scenario | [Positive] AC 7, AC 12, AC 14: the event's assigned Coordinator is notified, once, when the Organiser raises a change request |
| Pre-conditions | Signed in as `organiser2@test.local`. The event is in Planning, assigned to `coordinator2@test.local`. |
| Test Steps | 1. Raise a change request to Expected attendance and Venue requirements. <br> 2. Raise the same request again. <br> 3. Separately, raise a cancellation request. <br> 4. As the Coordinator, raise a request on the Organiser's behalf. |
| Test Data | Attendance 60; Venue requirements "Two halls"; cancellation reason "The sponsor withdrew." |
| Expected Result | 1: the Coordinator has one notice, "Change request raised": 'The organiser asked to change "[event]": Expected attendance, Venue requirements.', linked to the event. 2: refused (SCRUM-41 AC 7), and no second notice. 3: "Cancellation requested": 'The organiser asked to cancel "[event]". Their reason: The sponsor withdrew.' 4: no notice to the Coordinator who raised it. |

**Automated by:** `tests/unit/change-requests.test.ts` › the four "SCRUM-124 … TC-124-07" tests; `tests/integration/change-requests.test.ts` › "SCRUM-124 [AC7, AC14] TC-124-07: the assigned Coordinator gets exactly one notice of the Organiser's request"

### TC-124-08

| Item | Content |
|---|---|
| Test Case ID | TC-124-08 |
| Test Scenario | [Positive, Negative] AC 8, AC 12–14: when arrangements are flagged Needs Reconsideration, the event's Coordinator is told with the reason, every Venue Staff member about its bookings, and every Technical Support member about its reservations |
| Pre-conditions | The event has an Approved booking at Hall A, a Pending one at Hall B and a reservation of 2 Projectors. |
| Test Steps | 1. Flag the event's arrangements because its expected attendance changed. <br> 2. Flag them again. <br> 3. As the Coordinator, change the event's attendance yourself (SCRUM-25), which flags them. <br> 4. On an event with no Coordinator, flag its reservation. <br> 5. Flag bookings of two events at once. |
| Test Data | Reason "The event's expected attendance changed." |
| Expected Result | 1: the Coordinator: "Arrangements flagged for reconsideration": 'Hall A (Approved), Hall B (Pending) and Projector × 2 for "[event]" need reconsideration. The event's expected attendance changed.' Each Venue Staff member: "Bookings flagged for reconsideration", naming the two bookings, '… and wait for the event's Coordinator to decide', opening Bookings. Each Technical Support member: "Reservations flagged for reconsideration", naming the projectors, opening Equipment. 2: nobody is told again. 3: Venue Staff and Technical Support are told; the Coordinator who made the change isn't. 4: only Technical Support are told. 5: each event's Coordinator is told only about their own. |

**Automated by:** `tests/unit/reconsideration.test.ts` › the seven "SCRUM-124 … TC-124-08" tests; `tests/integration/staff-notifications.test.ts` › "SCRUM-124 [AC8, AC14] TC-124-08: flagging an arrangement twice tells its Coordinator and each Venue Staff member once". When the flag comes from venue unavailability, SCRUM-161 sends its own notices instead: the Coordinator's, "Alternative venue arrangements required", gives the venue, the reason and the period, and every Venue Staff member is told, each once (`tests/integration/unavailability.test.ts` › "SCRUM-161 [AC4] TC-161-06: each affected event's Coordinator, and every Venue Staff member, is notified once"). Flags from a safety check outcome (SCRUM-166) and from setup or turnaround changes (SCRUM-160) go through the same function, so they notify the same way: `tests/integration/staff-notifications.test.ts` › "SCRUM-124 [AC8, AC11, AC14] TC-124-08, TC-124-11: a safety check's Changes requested flags the booking, and tells its Coordinator and each Venue Staff member once".

### TC-124-09

| Item | Content |
|---|---|
| Test Case ID | TC-124-09 |
| Test Scenario | [Positive, Negative] AC 9, AC 12–14: when the Coordinator resolves a flag, every Venue Staff member is told for a booking, and every Technical Support member for a reservation |
| Pre-conditions | A flagged Approved booking at the Exhibition Hall and a flagged reservation of 2 Projectors. Signed in as the event's Coordinator. |
| Test Steps | 1. Choose Still stands on the booking. <br> 2. On another, choose Cancel arrangement. <br> 3. Do the same for the reservation. <br> 4. Choose Still stands where it can't stand. <br> 5. Cancel the same booking twice at the same moment. |
| Test Data | — |
| Expected Result | 1: "A flagged booking still stands": 'The Coordinator kept Exhibition Hall (Approved) for "[event]": it no longer needs reconsideration.', opening Bookings. 2: "A flagged booking was cancelled": '… so its period is free again.' 3: "A flagged reservation still stands" or "… was cancelled": '… so it is back in the pool.', to Technical Support, opening Equipment. 4: refused, no notice. 5: cancelled once, one notice each. |

**Automated by:** `tests/unit/reconsideration-actions.test.ts` › the six "SCRUM-124 … TC-124-09" tests; `tests/integration/staff-notifications.test.ts` › "SCRUM-124 [AC9, AC14] TC-124-09: two cancellations of a flagged booking at the same moment tell each Venue Staff member once"

### TC-124-10

| Item | Content |
|---|---|
| Test Case ID | TC-124-10 |
| Test Scenario | [Positive] AC 10: every Lead is told when a request is waiting in the Unassigned queue |
| Pre-conditions | A Lead account; requests go to the Unassigned queue (SCRUM-165). |
| Test Steps | 1. As an Organiser, submit a request. |
| Test Data | — |
| Expected Result | Each Lead has one notice, "A request is waiting to be assigned", that opens the request in the Unassigned queue. A resubmission that returns to the queue tells them too; one that goes back to its Coordinator, or a refused submission, tells no Lead. |

**Automated by:** `tests/unit/submission-queue.test.ts` › "SCRUM-124 [AC10, AC12, AC14] TC-124-10: every Lead is told once that the request is waiting in the Unassigned queue, and the notice opens it there" and "SCRUM-124 [AC10] TC-124-10: a refused submission tells no Lead"; `tests/unit/clarification-and-amend.test.ts` › "SCRUM-108 [AC14] TC-108-14, SCRUM-165 [AC9] TC-165-12: …" (a resubmission back in the queue); `tests/integration/staff-notifications.test.ts` › "SCRUM-124 [AC10, AC12, AC14] TC-124-10: a submitted request tells every Lead once that it waits in the Unassigned queue, and opens it there"; `tests/integration/concurrency.test.ts` › "SCRUM-124 [AC10] TC-124-10, SCRUM-14 [AC3] TC-14-05, SCRUM-45 [AC1] TC-45-01: SCRUM-14 AC: two simultaneous submissions of one draft succeed once and notify once" (each Lead once)

### TC-124-11

| Item | Content |
|---|---|
| Test Case ID | TC-124-11 |
| Test Scenario | [Positive] AC 11: every Safety Officer is told when a safety check is requested, and the Coordinator when its outcome is recorded, with the note |
| Pre-conditions | A Safety Officer account; safety checks exist (SCRUM-166). |
| Test Steps | 1. As the Coordinator, request a safety check. <br> 2. As a Safety Officer, record the outcome with a note. |
| Test Data | — |
| Expected Result | 1: each Safety Officer has one notice. 2: the Coordinator has one notice with the note. |

**Automated by:** `tests/integration/staff-notifications.test.ts` › "SCRUM-124 [AC8, AC11, AC14] TC-124-08, TC-124-11: a safety check's Changes requested flags the booking, and tells its Coordinator and each Venue Staff member once"; SCRUM-166's own `tests/integration/safety-check.test.ts` › "SCRUM-166 [AC1, AC9] TC-166-01: once the venue is arranged, a requested check awaits review, every Safety Officer is notified, and Confirm waits for it" and "SCRUM-166 [AC3, AC10] TC-166-05: Changes requested keeps the picked booking, flags it with the note, and the event stays in Planning". SCRUM-166 sends both notices; a Safety Officer who organises or coordinates the event isn't told (SCRUM-166 AC6).
