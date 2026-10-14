# SCRUM-25 — Update routine event information during planning

Test cases for [docs/backlog/SCRUM-25.md](../backlog/SCRUM-25.md). Format:
[README](README.md). Seeded accounts share the password `Password123!`.

Routine fields (AC1): name, purpose, description, accessibility needs,
preferred room layout, registration needs, programme and special requests.
Date, time, expected attendance, venue requirements and equipment
requirements are the fields SCRUM-26 warns about and flags on (AC3).

### TC-25-01

| Item | Content |
|---|---|
| Test Case ID | TC-25-01 |
| Test Scenario | [Positive] AC 1: the assigned Coordinator edits routine fields of a Planning event |
| Pre-conditions | Signed in as the event's assigned Coordinator; the event is in Planning. |
| Test Steps | 1. Open the event's details and choose Edit details. <br> 2. Change the name and the programme. Save. |
| Test Data | `coordinator@test.local` |
| Expected Result | "Details saved." The new values are stored; one audit entry per changed field records who changed it and its old and new values. An empty name or a zero attendance is refused against its field. |

**Automated by:** `tests/unit/event-edit.test.ts` › "SCRUM-25 [AC1, AC2] TC-25-01, TC-25-04: …"; `tests/integration/event-edit.test.ts` › "SCRUM-25 [AC1, AC2] TC-25-01, TC-25-04: …"; `e2e/event-edit.spec.ts` › "SCRUM-25 [AC1, AC2, AC3, AC6] …"

### TC-25-02

| Item | Content |
|---|---|
| Test Case ID | TC-25-02 |
| Test Scenario | [Positive] AC 1: an event Under Review is edited the same way |
| Pre-conditions | As TC-25-01, the event Under Review. |
| Test Steps | 1. Change the purpose. Save. |
| Test Data | — |
| Expected Result | Saved; the event stays Under Review. |

**Automated by:** `tests/unit/event-edit.test.ts` › "SCRUM-25 [AC1] TC-25-02: …"

### TC-25-03

| Item | Content |
|---|---|
| Test Case ID | TC-25-03 |
| Test Scenario | [Negative] AC 1, AC 5: other statuses can't be edited directly |
| Pre-conditions | An assigned event that is Confirmed, Submitted, Approved, Completed, Cancelled or Rejected. |
| Test Steps | 1. Save an edit. |
| Test Data | — |
| Expected Result | Confirmed: "A Confirmed event's details can't be edited directly. Changes go through a change request." Others: "An event's details can only be edited while it is Under Review or in Planning." Nothing is written, and Edit details is not offered. |

**Automated by:** `tests/unit/event-edit.test.ts` › "SCRUM-25 [AC5] TC-25-03: …", "SCRUM-25 [AC1] TC-25-03: …", "canEditEventDetails …"

### TC-25-04

| Item | Content |
|---|---|
| Test Case ID | TC-25-04 |
| Test Scenario | [Positive] AC 2: a routine edit doesn't change the status or flag any arrangement |
| Pre-conditions | A Planning event with an Approved venue booking. |
| Test Steps | 1. Change the programme. Save. |
| Test Data | — |
| Expected Result | The event stays Planning; the booking stays Approved and is not flagged Needs Reconsideration. An event changed by someone else while it was being edited is not overwritten ("This event changed while you were editing it…"). |

**Automated by:** `tests/unit/event-edit.test.ts`; `tests/integration/event-edit.test.ts` › "SCRUM-25 [AC1, AC2] TC-25-01, TC-25-04: …"; `e2e/event-edit.spec.ts`

### TC-25-05

| Item | Content |
|---|---|
| Test Case ID | TC-25-05 |
| Test Scenario | [Positive] AC 2: changing the layout or accessibility needs puts a requested safety check out of date |
| Pre-conditions | A Planning event with a safety check Awaiting review, and older Rejected and Changes requested ones. |
| Test Steps | 1. Change the preferred layout. Save. <br> 2. Separately, change only the programme. |
| Test Data | — |
| Expected Result | Step 1: the awaiting check becomes Outdated with the time it went out of date; the Rejected and Changes requested ones are unchanged (SCRUM-166 AC13: only Approved or awaiting review goes out of date); the message says the safety check needs requesting again. Step 2 leaves safety checks alone. |

**Automated by:** `tests/unit/event-edit.test.ts` › "SCRUM-25 [AC2] TC-25-05: …"; `tests/integration/event-edit.test.ts` › "SCRUM-25 [AC2] TC-25-05: …"

### TC-25-06

| Item | Content |
|---|---|
| Test Case ID | TC-25-06 |
| Test Scenario | [Positive] [Negative] AC 3: date, time, attendance, venue and equipment |
| Pre-conditions | One Planning event with nothing booked or reserved; another with a Pending venue booking. |
| Test Steps | 1. Move the first event a week later and change its attendance. <br> 2. Change the second event's attendance. <br> 3. Move a start into the past, or the end before the start. |
| Test Data | — |
| Expected Result | 1 saves: with nothing booked or reserved there is nothing for SCRUM-26 to warn about or flag. 2 is refused: "Expected attendance can't be changed while the event has a venue booking or an equipment reservation: it would leave them out of date. Nothing was saved." shown above the form, and the attendance field is marked "Can't change while the event has a venue booking or an equipment reservation." with the dialog scrolled to it. 3 is refused against the field. A hold past its expiry no longer counts as a booking (SCRUM-163 AC4), so it doesn't stop the change; a hold still live does. |

**Automated by:** `tests/unit/event-edit.test.ts` › "SCRUM-25 [AC3] TC-25-06: …"; `tests/integration/event-edit.test.ts` › "SCRUM-25 [AC3] TC-25-06: …"; `e2e/event-edit.spec.ts`

Once SCRUM-26 lands, step 2 shows its warning and flags the booking instead of refusing.

### TC-25-07

| Item | Content |
|---|---|
| Test Case ID | TC-25-07 |
| Test Scenario | [Negative] AC 4: the Organiser can't edit after submission |
| Pre-conditions | Signed in as the event's Organiser. |
| Test Steps | 1. Open the event's details. <br> 2. Call the edit directly. |
| Test Data | `organiser@test.local` |
| Expected Result | No Edit details button; the direct call is refused with "You do not have permission to do that." and nothing is read or written. |

**Automated by:** `tests/unit/event-edit.test.ts` › "SCRUM-25 [AC4, AC7] TC-25-07, TC-25-08: …", "SCRUM-25 [AC4, AC7] TC-25-07: event:edit belongs to the assigned Coordinator only"; `e2e/event-edit.spec.ts` › "SCRUM-25 [AC4, AC6] …"

### TC-25-08

| Item | Content |
|---|---|
| Test Case ID | TC-25-08 |
| Test Scenario | [Negative] AC 7: any other user, including a previous Coordinator, is refused |
| Pre-conditions | An event now assigned to another Coordinator; an unassigned event. |
| Test Steps | 1. As the previous Coordinator, save an edit. <br> 2. As any Coordinator, edit the unassigned event. <br> 3. As Venue Staff, Technical Support, an Attendee, the Lead or the Safety Officer, call the edit. |
| Test Data | — |
| Expected Result | 1 and 2: "Event not found.", the same as for an event that doesn't exist. 3: "You do not have permission to do that." Nothing changes in any case. |

**Automated by:** `tests/unit/event-edit.test.ts` › "SCRUM-25 [AC7] TC-25-08: …"; `tests/integration/event-edit.test.ts` › "SCRUM-25 [AC7] TC-25-08, TC-25-12: …" (step 1)

### TC-25-09

| Item | Content |
|---|---|
| Test Case ID | TC-25-09 |
| Test Scenario | [Positive] AC 6: the assigned Coordinator adds operational notes; the Organiser reads them |
| Pre-conditions | A Planning event. |
| Test Steps | 1. As the Coordinator, add a note from the event's details. <br> 2. As the Organiser, open the event. |
| Test Data | Note "Auction items arrive at 17:00." |
| Expected Result | The note shows with its author and time, oldest first. The Coordinator can add notes at any status except Cancelled. The Organiser sees the notes but no box to add one. |

**Automated by:** `tests/unit/event-edit.test.ts` › "SCRUM-25 [AC6] TC-25-09: …"; `tests/integration/event-edit.test.ts` › "SCRUM-25 [AC6] TC-25-09, TC-25-10: …"; `e2e/event-edit.spec.ts`

### TC-25-10

| Item | Content |
|---|---|
| Test Case ID | TC-25-10 |
| Test Scenario | [Positive] [Negative] AC 6: Venue Staff once there is a venue booking; Technical Support once there is an equipment request |
| Pre-conditions | A Planning event first with no booking, then with a Pending booking; one with an equipment request. |
| Test Steps | 1. As Venue Staff, add a note before and after the booking exists, from the booking in Bookings. <br> 2. As Technical Support, add a note from the equipment request. |
| Test Data | `venuestaff@test.local`, `techsupport@test.local` |
| Expected Result | Before the booking: "Event not found." After: the note is added. Only Pending, Approved and still-live Held bookings count; a hold past its expiry reads as "Event not found." Technical Support can add once there is a request, not before. |

**Automated by:** `tests/unit/event-edit.test.ts` › "SCRUM-25 [AC6, AC7] TC-25-10, TC-25-12: …"; `tests/integration/event-edit.test.ts` (including "SCRUM-25 [AC3, AC6] TC-25-06, TC-25-10: …" for the lapsed hold); `e2e/event-edit.spec.ts`

### TC-25-11

| Item | Content |
|---|---|
| Test Case ID | TC-25-11 |
| Test Scenario | [Negative] AC 6: notes can't be edited or deleted, blank, or added to a Cancelled event |
| Pre-conditions | An event with a note; a Cancelled event. |
| Test Steps | 1. Update the note's text in the database. <br> 2. Delete it. <br> 3. Add a blank note. <br> 4. Add a note to the Cancelled event. |
| Test Data | — |
| Expected Result | 1 and 2 are refused by the database (`event_operational_note_permanent`) and the note is unchanged; there is no edit or delete in the app. 3: "Write the note before adding it." (and the database refuses it too). 4: "Notes can't be added to a cancelled event." Its notes stay readable. |

**Automated by:** `tests/integration/event-edit.test.ts` › "SCRUM-25 [AC6] TC-25-11: …"; `tests/unit/event-edit.test.ts` › "SCRUM-25 [AC6] TC-25-11: …"

### TC-25-12

| Item | Content |
|---|---|
| Test Case ID | TC-25-12 |
| Test Scenario | [Negative] AC 6, AC 7: who can't read or add notes |
| Pre-conditions | A Planning event. |
| Test Steps | 1. Read its notes as another Organiser, a previous Coordinator, and Venue Staff with no booking for it. <br> 2. Add one as the Organiser, an Attendee, the Lead or the Safety Officer. |
| Test Data | — |
| Expected Result | 1: "Event not found." 2: "You do not have permission to do that." Nothing is read or written. |

**Automated by:** `tests/unit/event-edit.test.ts` › "SCRUM-25 [AC6, AC7] TC-25-12: …"; `tests/integration/event-edit.test.ts` › "SCRUM-25 [AC7] TC-25-08, TC-25-12: …" (a previous Coordinator adding)

### TC-25-13

| Item | Content |
|---|---|
| Test Case ID | TC-25-13 |
| Test Scenario | [Concurrency] AC 3: a date or attendance change and a venue booking at the same moment |
| Pre-conditions | A Planning event with nothing booked. |
| Test Steps | 1. Start a booking request for the event and hold it before it commits. <br> 2. Meanwhile save an attendance change. <br> 3. Let the booking commit. |
| Test Data | — |
| Expected Result | The edit waits on the event row, then sees the booking and is refused; the attendance is unchanged. It never saves against arrangements it didn't see. |

**Automated by:** `tests/integration/event-edit.test.ts` › "SCRUM-25 [AC3] TC-25-13: …"

### TC-25-14

| Item | Content |
|---|---|
| Test Case ID | TC-25-14 |
| Test Scenario | [Boundary] AC 1: saving with nothing changed |
| Pre-conditions | As TC-25-01. |
| Test Steps | 1. Open Edit details and save without changing anything. |
| Test Data | — |
| Expected Result | "Nothing changed."; nothing is written or audited. |

**Automated by:** `tests/unit/event-edit.test.ts` › "SCRUM-25 [AC1] TC-25-14: …"

### TC-25-15

| Item | Content |
|---|---|
| Test Case ID | TC-25-15 |
| Test Scenario | [Positive] [Negative] AC 3, with SCRUM-170 AC 4: changing the equipment requirements puts a No equipment needed decision back to Not decided |
| Pre-conditions | A Planning event with nothing booked or reserved, whose Coordinator recorded No equipment needed. |
| Test Steps | 1. Change only the programme. Save. <br> 2. Change the equipment requirements. Save. |
| Test Data | Equipment requirements "Two lapel mics" |
| Expected Result | 1: the decision and who made it are kept. 2: both are cleared together (`event_no_equipment_decision_complete`), so the readiness checklist shows Equipment as Not decided again. |

**Automated by:** `tests/unit/event-edit.test.ts` › "SCRUM-25 [AC3] TC-25-15: …"; `tests/integration/event-edit.test.ts` › "SCRUM-25 [AC3] TC-25-15: …"
