# SCRUM-128 — Decide a change request and apply it in one step: test cases

Story and acceptance criteria: [docs/backlog/SCRUM-128.md](../backlog/SCRUM-128.md).
Format and conventions: [README.md](README.md). Why it works this way:
[ADR 0020](../adr/0020-deciding-a-change-request.md). Raising the request is
SCRUM-41; flags are SCRUM-26's, the safety check SCRUM-166's, and cancelling
SCRUM-82's.

**Shared pre-conditions for every case:** the database is migrated and seeded
and the app is running. The event is assigned to `coordinator@test.local`,
organised by `organiser@test.local`, expects 40 attendees, and has a Submitted
change request. Every account's password is `Password123!`.

**Covered by other stories:**

- **AC5, pausing registration:** registration only takes a Confirmed event,
  so it pauses while the event is back in Planning; closing and reopening it is
  SCRUM-75.
- **AC10, Attendees:** the Organiser's notification is this story's
  (TC-128-02, TC-128-03). Attendees are told of a new date, time or venue
  when the event is Confirmed again, by SCRUM-85's confirmation:
  `tests/integration/attendee-updates.test.ts` › "SCRUM-85 [AC2, AC3, AC5,
  AC9, AC11] TC-85-02, TC-85-07: …" and `e2e/attendee-updates.spec.ts` ›
  "SCRUM-85 [AC2, AC7, AC8, AC9, AC10, AC11] …".
- **AC11's No half:** a change to No is refused while people are registered,
  with `registrationStillNeededMessage`, and otherwise closes registration
  (SCRUM-41 #221, TC-171-09 in [SCRUM-171.md](SCRUM-171.md#tc-171-09)). The
  Yes half is TC-128-16.
- **Equipment requirements (SCRUM-170 AC4):** approving a change to them puts
  Equipment back to Not decided; see TC-170-12 in
  [SCRUM-170.md](SCRUM-170.md#tc-170-12).

| ID | Type | Criterion | Automated |
|---|---|---|---|
| [TC-128-01](#tc-128-01) | Positive | AC 1 | Unit, e2e |
| [TC-128-02](#tc-128-02) | Positive | AC 2, AC 10 | Unit, integration |
| [TC-128-03](#tc-128-03) | Positive, Negative | AC 3, AC 10 | Unit, e2e |
| [TC-128-04](#tc-128-04) | Positive | AC 4 | Unit, integration |
| [TC-128-05](#tc-128-05) | Positive | AC 5, AC 6 | Unit, integration |
| [TC-128-06](#tc-128-06) | Negative, Boundary | AC 7 | Unit, integration |
| [TC-128-07](#tc-128-07) | Positive | AC 8 | Unit, integration, e2e |
| [TC-128-08](#tc-128-08) | Negative | AC 9 | Unit, e2e |
| [TC-128-09](#tc-128-09) | Positive | AC 10 | Unit |
| [TC-128-10](#tc-128-10) | Concurrency, Negative | AC 2 | Unit, integration, e2e |
| [TC-128-11](#tc-128-11) | Positive | AC 2, AC 4, AC 5 | Integration |
| [TC-128-12](#tc-128-12) | Negative | AC 2 | Integration |
| [TC-128-13](#tc-128-13) | Positive | AC 1, AC 2, AC 4, AC 5 | e2e |
| [TC-128-14](#tc-128-14) | Positive, Negative | AC 3, AC 9, AC 10 | e2e |
| [TC-128-15](#tc-128-15) | Negative | AC 2 | Unit |
| [TC-128-16](#tc-128-16) | Positive, Negative | AC 11 | Unit, integration |
| [TC-128-17](#tc-128-17) | Negative, Boundary | AC 2 | Unit, integration |

### TC-128-01

| Item | Content |
|---|---|
| Test Case ID | TC-128-01 |
| Test Scenario | [Positive] AC 1: the Coordinator sees what the request changes and what it could affect |
| Pre-conditions | The request asks to raise the attendance from 40 to 60; the event has an Approved booking, a hold, a reservation and an equipment request. |
| Test Steps | Open the event's details as the Coordinator. |
| Test Data | — |
| Expected Result | Under the request, each field's value now and the requested one; "Potentially affected" lists the bookings, hold, reservation and equipment request. A cancellation request lists what it would release; a change that isn't impactful lists nothing. A request on an event now Completed or Cancelled offers no decision. If the decision can't be loaded, "Couldn't load the decision for this change request." with **Try again**. |

**Automated by:** `tests/unit/change-decision.test.ts` › "SCRUM-128 [AC1] TC-128-01: …", "SCRUM-128 [AC1, AC8] TC-128-01: …", "SCRUM-128 [AC1] TC-128-01: nothing awaits …"; `e2e/change-decision.spec.ts` (TC-128-13); `e2e/change-decision.spec.ts` › "SCRUM-128 [AC1] TC-128-01: if the decision can't be loaded, the Coordinator is told and can try again"

### TC-128-02

| Item | Content |
|---|---|
| Test Case ID | TC-128-02 |
| Test Scenario | [Positive] AC 2, AC 10: approving applies the values and approves the request together |
| Pre-conditions | The request changes the description. |
| Test Steps | Click **Approve**. |
| Test Data | — |
| Expected Result | "Change request approved and applied." The event has the new values; the request is Approved with who and when; each value has a history entry; the Organiser is notified. |

**Automated by:** `tests/unit/change-decision.test.ts` › "SCRUM-128 [AC2, AC10] TC-128-02: …"; `tests/unit/change-application.test.ts` › "SCRUM-128 [AC2] TC-128-02: …"

### TC-128-03

| Item | Content |
|---|---|
| Test Case ID | TC-128-03 |
| Test Scenario | [Positive, Negative] AC 3, AC 10: rejecting needs a reason and changes nothing |
| Pre-conditions | — |
| Test Steps | 1. Click **Reject** with no reason. <br> 2. Enter a reason and reject. |
| Test Data | Reason "No larger room is free that day." |
| Expected Result | 1. **Reject change request** stays disabled; a direct request says "A reason is required to reject a change request." 2. The request is Rejected with the reason; the event is unchanged; the Organiser sees "Rejected because: …". |

**Automated by:** `tests/unit/change-decision.test.ts` › "SCRUM-128 [AC3 …] TC-128-03: …" (2 tests); `e2e/change-decision.spec.ts` (TC-128-14)

### TC-128-04

| Item | Content |
|---|---|
| Test Case ID | TC-128-04 |
| Test Scenario | [Positive] AC 4: an impactful change flags the arrangements and outdates the safety check |
| Pre-conditions | The event has an Approved booking and an Approved safety check. |
| Test Steps | Approve a change to the attendance; then one to the layout only. |
| Test Data | — |
| Expected Result | Attendance: the booking is flagged "Change approved: Expected attendance." and the check is Outdated. Layout only: nothing is flagged, but the check is Outdated (SCRUM-166 AC13). |

**Automated by:** `tests/unit/change-decision.test.ts`, `tests/unit/change-application.test.ts` › "SCRUM-128 [AC4 …] TC-128-04: …"; `tests/integration/change-decision.test.ts` (TC-128-11)

### TC-128-05

| Item | Content |
|---|---|
| Test Case ID | TC-128-05 |
| Test Scenario | [Positive] AC 5, AC 6: only an impactful change to a Confirmed event returns it to Planning |
| Pre-conditions | The event is Confirmed, then Under Review, then in Planning. |
| Test Steps | Approve an impactful change; approve one that isn't. |
| Test Data | — |
| Expected Result | Confirmed + impactful: Planning, with a history entry, registrations still Registered, and the "Registration closed" notice confirming scheduled is withdrawn (confirming again writes a new one). Any other case: the status doesn't change. |

**Automated by:** `tests/unit/change-decision.test.ts` › "SCRUM-128 [AC5] TC-128-05: …", "SCRUM-128 [AC6] TC-128-05: …" (2 tests); `tests/integration/change-decision.test.ts` (TC-128-11)

### TC-128-06

| Item | Content |
|---|---|
| Test Case ID | TC-128-06 |
| Test Scenario | [Negative, Boundary] AC 7: attendance can't drop below active registrations |
| Pre-conditions | 3 Attendees are registered (81 in the unit case). |
| Test Steps | Approve a request lowering the attendance to 2; then one equal to the registrations. |
| Test Data | — |
| Expected Result | Refused: "The expected attendance can't be lower than the 3 active registrations, so this change can't be approved." Nothing changes. Equal to the registrations is allowed. |

**Automated by:** `tests/unit/change-decision.test.ts` › "SCRUM-128 [AC7] TC-128-06: …" (2 tests); `tests/integration/change-decision.test.ts` › "SCRUM-128 [AC7] TC-128-06: …"

### TC-128-07

| Item | Content |
|---|---|
| Test Case ID | TC-128-07 |
| Test Scenario | [Positive] AC 8: approving a cancellation request cancels the event |
| Pre-conditions | The request asks to cancel, with reason "The sponsor pulled out."; an Attendee is registered. |
| Test Steps | Click **Approve**. |
| Test Data | — |
| Expected Result | "Change request approved. The event is cancelled." The event is Cancelled with the Organiser's reason, as SCRUM-82 does; the request stays Approved; the registration is Cancelled; the bookings, equipment and availability pages are refreshed, as SCRUM-25's edit and SCRUM-82's Cancel do. In the browser, the decision shows "Cancelling releases:" instead of a field table, and the Organiser then sees the event Cancelled with the reason. |

**Automated by:** `tests/unit/change-decision.test.ts` › "SCRUM-128 [AC8] TC-128-07: …"; `tests/integration/change-decision.test.ts` › "SCRUM-128 [AC8] TC-128-07: …"; `e2e/change-decision.spec.ts` › "SCRUM-128 [AC8] TC-128-07: approving a cancellation request lists what it releases, cancels the event with the Organiser's reason, and the Organiser sees it Cancelled"

### TC-128-08

| Item | Content |
|---|---|
| Test Case ID | TC-128-08 |
| Test Scenario | [Negative] AC 9: only the event's assigned Coordinator decides |
| Pre-conditions | — |
| Test Steps | Decide as every other role, as another Coordinator, and after the event was reassigned. |
| Test Data | — |
| Expected Result | "You do not have permission to do that.", "Change request not found." or "This event was updated by another user. Refresh and try again."; the Organiser sees no Approve or Reject. Nothing is written. |

**Automated by:** `tests/unit/change-decision.test.ts` › "SCRUM-128 [AC9] TC-128-08: …" (3 tests); `tests/unit/auth.test.ts` › "SCRUM-128 [AC9] TC-128-08: …"; `e2e/change-decision.spec.ts` (TC-128-14)

### TC-128-09

| Item | Content |
|---|---|
| Test Case ID | TC-128-09 |
| Test Scenario | [Positive] AC 10: the outcome reads plainly |
| Pre-conditions | The request changes the date, time and attendance. |
| Test Steps | Approve it. |
| Test Data | — |
| Expected Result | The Organiser's notice and the flags name "Date and time, Expected attendance". |

**Automated by:** `tests/unit/change-application.test.ts` › "SCRUM-128 [AC10] TC-128-09: …"

### TC-128-10

| Item | Content |
|---|---|
| Test Case ID | TC-128-10 |
| Test Scenario | [Concurrency, Negative] AC 2: one decision only |
| Pre-conditions | — |
| Test Steps | 1. Approve and reject at the same moment. <br> 2. Decide a request already decided, or on an event since cancelled or completed. |
| Test Data | — |
| Expected Result | 1. One succeeds; the other says "This change request is already Approved/Rejected; nothing was changed." One history entry. 2. Refused with nothing written. In the browser, a decision decided elsewhere refreshes the request, which then reads as decided with no Approve or Reject; a decision that never reaches the server says "The decision couldn't be sent. If the request above isn't decided, try again." |

**Automated by:** `tests/unit/change-decision.test.ts` › "SCRUM-128 [AC2] TC-128-10: …" (2 tests); `tests/integration/change-decision.test.ts` › "SCRUM-128 [AC2] TC-128-10: …"; `e2e/change-decision.spec.ts` › "SCRUM-128 [AC2] TC-128-10: a decision that never reaches the server says so, and one already made elsewhere refreshes the request instead of offering it again"

### TC-128-11

| Item | Content |
|---|---|
| Test Case ID | TC-128-11 |
| Test Scenario | [Positive] AC 2, AC 4, AC 5: an impactful approval against a real database |
| Pre-conditions | A Confirmed event with an Approved booking, an Approved safety check, a registered Attendee and the "Registration closed" notice confirming wrote ahead; the request raises the attendance from 40 to 90. |
| Test Steps | Approve it. |
| Test Data | — |
| Expected Result | Attendance 90, status Planning, request Approved, booking flagged, check Outdated, registration still Registered, the notice withdrawn. |

**Automated by:** `tests/integration/change-decision.test.ts` › "SCRUM-128 [AC2, AC4, AC5] TC-128-11: …"

### TC-128-12

| Item | Content |
|---|---|
| Test Case ID | TC-128-12 |
| Test Scenario | [Negative] AC 2: a failure part-way saves nothing |
| Pre-conditions | The request changes the description and sets the expected attendance to 0, which the database refuses (`event_attendance_positive`) while the change is applied. |
| Test Steps | Approve it. |
| Test Data | — |
| Expected Result | The approval fails; the description is unchanged, the event still Confirmed, and the request still Submitted. |

**Automated by:** `tests/integration/change-decision.test.ts` › "SCRUM-128 [AC2] TC-128-12: …"

### TC-128-13

| Item | Content |
|---|---|
| Test Case ID | TC-128-13 |
| Test Scenario | [Positive] AC 1, AC 2, AC 4, AC 5: approve in the browser |
| Pre-conditions | A Confirmed event with an Approved booking of Exhibition Hall and a request raising the attendance from 40 to 60. |
| Test Steps | As the Coordinator, open the event, check the values and the affected list, click **Approve**. |
| Test Data | — |
| Expected Result | "Now 40, Requested 60"; "Exhibition Hall (Approved)" listed; then "Change request approved. The event is back in Planning and its arrangements are flagged." |

**Automated by:** `e2e/change-decision.spec.ts` › "SCRUM-128 [AC1, AC2, AC4, AC5] TC-128-13, SCRUM-208 [AC2] TC-208-06: …"

### TC-128-14

| Item | Content |
|---|---|
| Test Case ID | TC-128-14 |
| Test Scenario | [Positive, Negative] AC 3, AC 9, AC 10: reject in the browser |
| Pre-conditions | As TC-128-13. |
| Test Steps | 1. As the Organiser, open the event. <br> 2. As the Coordinator, click **Reject**, see it disabled without a reason, enter one, reject. <br> 3. As the Organiser, open it again. |
| Test Data | Reason "No larger room is free that day." |
| Expected Result | 1. The request shows, with no Approve or Reject. 2. Rejected; attendance still 40. 3. The request reads Rejected with the reason. |

**Automated by:** `e2e/change-decision.spec.ts` › "SCRUM-128 [AC3, AC9, AC10] TC-128-14: …"

### TC-128-15

| Item | Content |
|---|---|
| Test Case ID | TC-128-15 |
| Test Scenario | [Negative] AC 2: a requested start that has passed while the request waited is refused |
| Pre-conditions | A Submitted request moves the start to a date that has since passed. |
| Test Steps | Click **Approve**. |
| Test Data | — |
| Expected Result | "The start can't be in the past. The requested start has passed, so reject this request and the organiser can ask for a new date." Nothing is changed, as SCRUM-25's direct edit refuses a past start. A future start is applied. |

**Automated by:** `tests/unit/change-decision.test.ts` › "SCRUM-128 [AC2] TC-128-15: a requested start that has passed while the request waited is refused, and nothing is written; a future one is applied"

### TC-128-16

| Item | Content |
|---|---|
| Test Case ID | TC-128-16 |
| Test Scenario | [Positive, Negative] AC 11: Registration needed changed from No to Yes on a Confirmed event opens registration |
| Pre-conditions | A Confirmed event whose Registration needed is No, so registration is closed. The Organiser raises a change request setting it to Yes (SCRUM-41). |
| Test Steps | 1. As its Coordinator, approve the request. <br> 2. Repeat with a registration window that closes before the start, and with one already past. <br> 3. Repeat on an event in Planning. |
| Test Data | — |
| Expected Result | 1. The event stays Confirmed and registration opens as confirming opens it (SCRUM-75 AC4). A "Registration closed" notice for the Organiser and the Coordinator is written to show at the event's start. 2. The notice shows at the window's close; with the close already past, registration is enabled but no notice is written. 3. Nothing opens now: confirming the event opens it. Turning registration off on a Confirmed event withdraws the notice without saying the event is back in Planning. |

**Automated by:** `tests/unit/change-decision.test.ts` › "SCRUM-128 [AC11] TC-128-16: …" (3 tests) and "SCRUM-128 [AC11], SCRUM-45 [AC5]: turning registration off on a Confirmed event withdraws its notice but doesn't say the event is back in Planning, since it isn't"; `tests/integration/change-decision.test.ts` › "SCRUM-128 [AC11] TC-128-16: Registration needed raised as Yes on a Confirmed event opens registration when approved, with its Registration closed notice written for the event's start"

### TC-128-17

| Item | Content |
|---|---|
| Test Case ID | TC-128-17 |
| Test Scenario | [Negative, Boundary] AC 2: a request whose times no longer make a valid period is refused, not failed |
| Pre-conditions | A Confirmed event from 10:00 to 14:00 SGT. A Submitted request moves only the end, to 12:00. Before it is decided, the start moves to 13:00 (SCRUM-25's edit or a clarification answer). |
| Test Steps | Click **Approve**. |
| Test Data | — |
| Expected Result | "The event's times changed after this request was raised, so it would now end before it starts. Reject it and the organiser can ask for new times." The event and the request are unchanged. An end equal to the start is refused too; an end one minute after the start is applied. A requested start after the event's current end is refused the same way. |

**Automated by:** `tests/unit/change-decision.test.ts` › "SCRUM-128 [AC2] TC-128-17: …" (2 tests); `tests/integration/change-decision.test.ts` › "SCRUM-128 [AC2] TC-128-17: a request that only moves the end is refused once the start has moved past it, and the event and request are left as they were"
