# SCRUM-26 — Flag and resolve arrangements affected by a change: test cases

Story and acceptance criteria: [docs/backlog/SCRUM-26.md](../backlog/SCRUM-26.md).
Format and conventions: [README.md](README.md). Why flags work this way:
[ADR 0017](../adr/0017-needs-reconsideration-flags.md). The flag columns and
their database rules came with SCRUM-172.

**Shared pre-conditions for every case:** the database is migrated and seeded
and the app is running. The event is in Planning, assigned to
`coordinator@test.local`, from 10:00 to 12:00 Singapore time, expecting 40
attendees, with an Approved booking of Exhibition Hall (capacity 200) for the
same period. Flagged rows are created straight in the database or with
`flagArrangements`, because the stories that raise flags aren't built yet
(see below). Every account's password is `Password123!`.

**Covered by other stories:**

- **AC1's warning screen** belongs to the Coordinator's edit form, SCRUM-25
  (TC-25-06, TC-25-13). This story provides what that form calls:
  `impactfulChanges` (which edited fields count, TC-26-01),
  `flaggableArrangements` (what the warning lists, TC-26-02) and
  `flagArrangements` (raising the flag on confirm, TC-26-03).
- **AC3's flag sources** are each another story's action, all merged:
  SCRUM-25, SCRUM-128, SCRUM-34, SCRUM-160, SCRUM-161, SCRUM-166 and SCRUM-32.
  Each calls `flagArrangements` with its own reason; TC-26-03 proves what that
  does. The last one to arrive, Technical Support reporting that reserved
  equipment can't be provided, is SCRUM-32's TC-32-01:
  `tests/unit/report-reservation.test.ts` › "SCRUM-32 [AC1, AC4] TC-32-01: a
  report flags the reservation with the reason, and changes nothing else about
  it"; `tests/integration/report-reservation.test.ts` › "SCRUM-32 [AC1, AC2,
  AC4, AC5] TC-32-01: …"; `e2e/report-reservation.spec.ts` › "SCRUM-32 [AC1,
  AC2, AC4] TC-32-01, TC-32-02: …".
- **AC14** says changing equipment lines is SCRUM-142; there is nothing to
  test here.
- **Notifications** when a flag is raised or resolved are SCRUM-124's
  TC-124-08 and TC-124-09: `tests/unit/reconsideration.test.ts` › "SCRUM-124
  [AC8, AC12] TC-124-08: the event's Coordinator is told every flagged
  arrangement and the reason" (and the rest of TC-124-08);
  `tests/unit/reconsideration-actions.test.ts` › "SCRUM-124 [AC9, AC12]
  TC-124-09: …"; `tests/integration/staff-notifications.test.ts` › "SCRUM-124
  [AC8, AC14] TC-124-08: …" and "SCRUM-124 [AC9, AC14] TC-124-09: …".

| ID | Type | Criterion | Automated |
|---|---|---|---|
| [TC-26-01](#tc-26-01) | Positive, Boundary | AC 1 | Unit |
| [TC-26-02](#tc-26-02) | Positive, Boundary | AC 1 | Unit |
| [TC-26-03](#tc-26-03) | Positive | AC 2, AC 3, AC 6 | Unit |
| [TC-26-04](#tc-26-04) | Positive | AC 4 | Integration |
| [TC-26-05](#tc-26-05) | Negative | AC 7 | Unit |
| [TC-26-06](#tc-26-06) | Positive | AC 7, AC 8 | Unit, integration |
| [TC-26-07](#tc-26-07) | Negative | AC 8 | Unit |
| [TC-26-08](#tc-26-08) | Negative, Boundary | AC 8 | Unit, integration |
| [TC-26-09](#tc-26-09) | Negative | AC 5 | Unit, integration |
| [TC-26-10](#tc-26-10) | Positive, Negative | AC 9 | Unit |
| [TC-26-11](#tc-26-11) | Positive | AC 10 | Unit, integration |
| [TC-26-12](#tc-26-12) | Positive | AC 2, AC 6, AC 11, AC 13 | Integration |
| [TC-26-13](#tc-26-13) | Negative | AC 12 | Unit, e2e |
| [TC-26-14](#tc-26-14) | Positive | AC 7, AC 8, AC 9, AC 10, AC 12 | Unit, e2e |
| [TC-26-15](#tc-26-15) | Concurrency | AC 9 | Integration |

### TC-26-01

| Item | Content |
|---|---|
| Test Case ID | TC-26-01 |
| Test Scenario | [Positive, Boundary] AC 1: only a real change to an impactful field counts |
| Pre-conditions | The event's current values. |
| Test Steps | 1. Compare the event with an edit that changes the date, time, expected attendance, venue requirement and equipment requirement. <br> 2. Compare it with an edit that sets each to what it already is, or leaves it out. |
| Test Data | 40 → 60 attendees; facilities `[stage]` → `[stage, projector]`; the same date as a new Date object; facilities in a different order. |
| Expected Result | Step 1 lists every changed field. Step 2 lists none, so the edit shows no warning. |

**Automated by:** `tests/unit/reconsideration.test.ts` › "SCRUM-26 [AC1] TC-26-01: …" (2 tests)

### TC-26-02

| Item | Content |
|---|---|
| Test Case ID | TC-26-02 |
| Test Scenario | [Positive, Boundary] AC 1: the warning lists what will be flagged, and nothing when nothing is booked |
| Pre-conditions | The event has an Approved, a Held and a Pending booking and a Confirmed reservation of 2 projectors; a second event has none. |
| Test Steps | 1. List the first event's flaggable arrangements. <br> 2. List the second event's. |
| Test Data | — |
| Expected Result | 1. "Exhibition Hall (Approved)", "… (Held)", "… (Pending)", "Projector × 2". 2. An empty list: no warning. |

**Automated by:** `tests/unit/reconsideration.test.ts` › "SCRUM-26 [AC1] TC-26-02: …" (2 tests)

### TC-26-03

| Item | Content |
|---|---|
| Test Case ID | TC-26-03 |
| Test Scenario | [Positive] AC 2, AC 3, AC 6: raising a flag records why and when, on live arrangements only, without touching status or period |
| Pre-conditions | The event has live and finished bookings and reservations. |
| Test Steps | 1. Flag every arrangement of the event with a reason. <br> 2. Flag only named arrangements (as a safety check's picks would). |
| Test Data | Reason "The event moved to 2 May." |
| Expected Result | Only Pending, Held or Approved bookings and Confirmed reservations not already flagged are written: flag on, the time, the reason, resolution cleared. No status, start or end is part of the write. |

**Automated by:** `tests/unit/reconsideration.test.ts` › "SCRUM-26 [AC2, AC3, AC6] TC-26-03: …", "SCRUM-26 [AC3] TC-26-03: …" (2 tests)

### TC-26-04

| Item | Content |
|---|---|
| Test Case ID | TC-26-04 |
| Test Scenario | [Positive] AC 4: a flagged arrangement keeps blocking until resolved |
| Pre-conditions | The Approved booking and a Confirmed reservation of 3 projectors are flagged. |
| Test Steps | 1. Ask what blocks Exhibition Hall for the event's period. <br> 2. Count the projectors still held for it. |
| Test Data | 4 Aug 2032, 10:00–12:00. |
| Expected Result | 1. The flagged booking is a blocker. 2. All 3 projectors are still held. |

**Automated by:** `tests/integration/reconsideration.test.ts` › "SCRUM-26 [AC4] TC-26-04: …"

### TC-26-05

| Item | Content |
|---|---|
| Test Case ID | TC-26-05 |
| Test Scenario | [Negative] AC 7: only the assigned Coordinator can see or resolve a flag |
| Pre-conditions | The booking is flagged. |
| Test Steps | 1. As every other role, try to resolve it. <br> 2. As another Coordinator, try to resolve it and to list the flags. <br> 3. As the assigned Coordinator, resolve it after the event was reassigned. |
| Test Data | `coordinator2@test.local`, `organiser@test.local`, `venuestaff@test.local`, and the rest. |
| Expected Result | 1. "You do not have permission to do that." 2. "Arrangement not found." / "Event not found." 3. "This event was updated by another user. Refresh and try again." Nothing is written in any case. |

**Automated by:** `tests/unit/reconsideration-actions.test.ts` › "SCRUM-26 [AC7] TC-26-05: …" (5 tests); `tests/unit/auth.test.ts` › "SCRUM-26 [AC7] TC-26-05: …"

### TC-26-06

| Item | Content |
|---|---|
| Test Case ID | TC-26-06 |
| Test Scenario | [Positive] AC 7, AC 8: Still stands keeps an arrangement that still fits |
| Pre-conditions | The flagged booking still covers the event, its venue is active, 40 attendees fit both the event and the hall, and nothing else occupies the hall. A flagged reservation still covers what the requests need. |
| Test Steps | 1. Open the event's details. <br> 2. Click **Still stands** on the booking. |
| Test Data | — |
| Expected Result | "Exhibition Hall (Approved) still stands." The booking stays Approved, its flag is off, and who resolved it and when are saved, with a "RECONSIDERATION_RESOLVED" history entry. |

**Automated by:** `tests/unit/reconsideration-actions.test.ts` › "SCRUM-26 [AC7, AC8] TC-26-06: …" (2 tests); `tests/unit/reconsideration.test.ts` › "SCRUM-26 [AC8] TC-26-06: …" (2 tests); `tests/integration/reconsideration.test.ts` › "SCRUM-26 [AC7, AC8] TC-26-06: …"

### TC-26-07

| Item | Content |
|---|---|
| Test Case ID | TC-26-07 |
| Test Scenario | [Negative] AC 8: Still stands is refused when the arrangement no longer covers the event's period |
| Pre-conditions | The event moved to 2 May; its booking and reservation are still for 1 May. |
| Test Steps | Click **Still stands**. |
| Test Data | — |
| Expected Result | "It can't stand as it is: It no longer covers the event's whole period, 2 May 2032, 10:00 am SGT to 2 May 2032, 12:00 pm SGT. Cancel the arrangement and request again." The flag stays. |

**Automated by:** `tests/unit/reconsideration.test.ts` › "SCRUM-26 [AC8] TC-26-07: …" (2 tests); `tests/unit/reconsideration-actions.test.ts` › "SCRUM-26 [AC8] TC-26-07: …"

### TC-26-08

| Item | Content |
|---|---|
| Test Case ID | TC-26-08 |
| Test Scenario | [Negative, Boundary] AC 8: each other reason Still stands is refused |
| Pre-conditions | One at a time: the hall is retired; the event now expects 30; the hall's capacity is 35; another booking starts inside this one's turnaround; maintenance was recorded over it; the reservation holds 2 projectors where the requests need 3. |
| Test Steps | Click **Still stands**. |
| Test Data | Booking with 30 minutes' setup and 45 minutes' turnaround; a Pending booking is judged with the venue's current minutes. |
| Expected Result | Refused with "Exhibition Hall has been retired.", "It is for 40 attendees, more than the event's expected 30.", "… more than Exhibition Hall's capacity of 35.", "Exhibition Hall is already booked from …" / "unavailable (maintenance) from …", or "Only 2 Projector reserved for the event's period; its requests need 3." The flag stays. |

**Automated by:** `tests/unit/reconsideration.test.ts` › "SCRUM-26 [AC8] TC-26-08: …" (7 tests); `tests/unit/reconsideration-actions.test.ts` › "SCRUM-26 [AC8] TC-26-08: …"; `tests/integration/reconsideration.test.ts` › "SCRUM-26 [AC8] TC-26-08: …"

### TC-26-09

| Item | Content |
|---|---|
| Test Case ID | TC-26-09 |
| Test Scenario | [Negative] AC 5: a flagged Pending request can't be approved or held, and a flagged hold can't be approved by Venue Staff or confirmed |
| Pre-conditions | A Pending booking request is flagged, and a Held booking is flagged. Signed in as `venuestaff@test.local`, then as `coordinator@test.local` for the hold. |
| Test Steps | 1. Approve or hold the request. <br> 2. Approve or hold one that was flagged after the page loaded. <br> 3. Reject it. <br> 4. Approve the flagged hold, including one flagged after the page loaded; then reject it. <br> 5. As the Coordinator, confirm a flagged hold, including one flagged after the page loaded. <br> 6. Release it. |
| Test Data | Reason "The event moved." |
| Expected Result | 1, 2. "This request needs reconsideration, so it can't be approved or held until its event's coordinator resolves it. It can still be rejected." It stays Pending. 3. It is rejected. 4. "This hold needs reconsideration, so it can't be approved until its event's coordinator resolves it. It can still be rejected." It stays Held and unapproved; rejecting it works. 5. "This hold needs reconsideration, so it can't be confirmed until you resolve the flag. You can still release it." It stays Held. 6. It is released. |

**Automated by:** `tests/unit/bookings.test.ts` › "SCRUM-26 [AC5] TC-26-09: …" (3 tests); `tests/unit/booking-holds.test.ts` › "SCRUM-26 [AC5] TC-26-09: …" (8 tests); `tests/integration/reconsideration.test.ts` › "SCRUM-26 [AC5] TC-26-09: …"

### TC-26-10

| Item | Content |
|---|---|
| Test Case ID | TC-26-10 |
| Test Scenario | [Positive, Negative] AC 9: Cancel arrangement releases it exactly once, and nothing else |
| Pre-conditions | A flagged booking and a flagged reservation. |
| Test Steps | 1. Click **Cancel arrangement**, then confirm. <br> 2. Try again on one already resolved or cancelled. |
| Test Data | — |
| Expected Result | 1. The booking (or reservation, with its cancelled time) is Cancelled, its flag off, who and when saved, with a status history entry; the event's other arrangements are untouched. The confirm dialog and the message say what happens next: "Request a venue again when you're ready." for a booking, "Technical Support will reserve it again." for a reservation, whose equipment request stays Approved. The readiness checklist's venue item reads "Not requested", even if an older request was rejected: the newer cancellation replaces the old reason. 2. "This arrangement no longer needs reconsideration. Refresh to see where it stands." Nothing is written. The venue item then reads by whichever booking ended last, not whichever was requested last (PO, 19 Oct): a booking cancelled after another was rejected reads "Not requested"; one rejected after another was cancelled reads "Rejected". |

**Automated by:** `tests/unit/reconsideration-actions.test.ts` › "SCRUM-26 [AC9] TC-26-10: …" (5 tests); `tests/unit/reconsideration-panel.test.tsx` › "SCRUM-26 [AC9] TC-26-10: …" (2 tests); `tests/unit/event-readiness.test.ts` › "SCRUM-110 [AC1, AC2] TC-110-05: with a rejection then a newer cancelled booking, …", "… with an older request rejected after a newer one was cancelled, …" and "… with an older request cancelled after a newer one was rejected, …"; `e2e/reconsideration.spec.ts` (TC-26-14, the booking's message)

### TC-26-11

| Item | Content |
|---|---|
| Test Case ID | TC-26-11 |
| Test Scenario | [Positive] AC 10: cancelling an arrangement of a Confirmed event returns it to Planning and outdates its safety check |
| Pre-conditions | The event is Confirmed with an Approved safety check and a flagged reservation of 2 projectors. |
| Test Steps | Cancel the reservation. |
| Test Data | — |
| Expected Result | The reservation is Cancelled; the event is in Planning with a "CONFIRMED → PLANNING" history entry; the safety check is Outdated with its time. Still stands on a Confirmed event changes neither. |

**Automated by:** `tests/unit/reconsideration-actions.test.ts` › "SCRUM-26 [AC10] TC-26-11: …" (3 tests); `tests/integration/reconsideration.test.ts` › "SCRUM-26 [AC9, AC10] TC-26-11: …"

### TC-26-12

| Item | Content |
|---|---|
| Test Case ID | TC-26-12 |
| Test Scenario | [Positive] AC 2, AC 6, AC 11, AC 13: a flag changes nothing else |
| Pre-conditions | The event has an Approved booking, a Confirmed reservation and a registered Attendee. |
| Test Steps | 1. Flag the event's arrangements. <br> 2. Move the event a day later. |
| Test Data | `attendee@test.local` registered. |
| Expected Result | The booking stays Approved and the reservation Confirmed, both on their original day, flagged with the reason. The registration stays Registered and unflagged. |

**Automated by:** `tests/integration/reconsideration.test.ts` › "SCRUM-26 [AC2, AC6, AC11, AC13] TC-26-12: …"

### TC-26-13

| Item | Content |
|---|---|
| Test Case ID | TC-26-13 |
| Test Scenario | [Negative] AC 12: a flagged arrangement keeps the event from being confirmed |
| Pre-conditions | One flagged live booking or Confirmed reservation; a flag left on a cancelled one. |
| Test Steps | Open the readiness checklist as the Coordinator, then as the Organiser. |
| Test Data | Reason "The event moved to 2 June." |
| Expected Result | Venue booking (or Equipment, naming the equipment) is incomplete, still showing the arrangement's own status ("Approved", "Pending", "Held until …", or "Reserved: Projector") with a **Needs Reconsideration** badge beside it (SCRUM-131 AC3) and the reason; the event isn't ready and Confirm is disabled. The Organiser sees the state and the badge without the reason. A flag on a cancelled row doesn't count. |

**Automated by:** `tests/unit/event-readiness.test.ts` › "SCRUM-26 [AC12] TC-26-13 …" (6 tests, three also SCRUM-131 [AC3]); `e2e/reconsideration.spec.ts` (TC-26-14), and › "SCRUM-26 [AC12] TC-26-13, SCRUM-131 [AC2, AC3] TC-131-05: …" for a flagged reservation in the Coordinator's checklist

### TC-26-14

| Item | Content |
|---|---|
| Test Case ID | TC-26-14 |
| Test Scenario | [Positive] AC 7, AC 8, AC 9, AC 10, AC 12: the Coordinator resolves flags from the event's details |
| Pre-conditions | A Planning event and a Confirmed event, each with a flagged Approved booking. |
| Test Steps | 1. As the Coordinator, open the Planning event: see the flag, its reason and the incomplete checklist; click **Still stands**. <br> 2. Open the Confirmed event, click **Cancel arrangement**, then **Keep it for now**; click it again and confirm. <br> 3. As the Organiser, open the Planning event. |
| Test Data | `coordinator@test.local`, `organiser@test.local`. |
| Expected Result | 1. The panel empties and the venue item is complete. 2. Keeping it writes nothing; confirming says "… was cancelled. The event is back in Planning." 3. The booking's status with the Needs Reconsideration badge, without the reason, and no panel. |

**Automated by:** `e2e/reconsideration.spec.ts` › "SCRUM-26 … TC-26-14: …" (3 tests); `tests/unit/reconsideration-actions.test.ts` › "SCRUM-26 [AC7, AC12] TC-26-14: …"

### TC-26-15

| Item | Content |
|---|---|
| Test Case ID | TC-26-15 |
| Test Scenario | [Concurrency] AC 9: two cancels of the same flagged booking at once release it once |
| Pre-conditions | A flagged booking, and a second Approved booking for the same event. |
| Test Steps | Send two Cancel arrangement requests at the same moment. |
| Test Data | — |
| Expected Result | One succeeds; the other says it no longer needs reconsideration. The booking is Cancelled with one status history entry, the venue is free for its period, and the other booking stays Approved. |

**Automated by:** `tests/integration/reconsideration.test.ts` › "SCRUM-26 [AC9] TC-26-15: …"
