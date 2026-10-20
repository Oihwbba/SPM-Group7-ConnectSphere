# SCRUM-166 — Operational safety check: test cases

Story and acceptance criteria: [docs/backlog/SCRUM-166.md](../backlog/SCRUM-166.md).
Format and conventions: [README.md](README.md). Why it works this way:
[ADR 0018](../adr/0018-operational-safety-check.md). The `SafetyCheck` table
and its database rules came with SCRUM-172; flags are SCRUM-26's.

**Shared pre-conditions for every case:** the database is migrated and seeded
and the app is running. The event is in Planning, assigned to
`coordinator@test.local`, with an Approved booking of Exhibition Hall
(capacity 200) covering its whole period. The Safety Officer is
`safety@test.local`. Every account's password is `Password123!`.

**Covered by other stories:**

- **AC1, AC4, notifications:** this story writes a notification for every
  Safety Officer on a request (TC-166-01) and for the Coordinator on an
  outcome (TC-166-07). How notifications behave is SCRUM-124's AC11, merged in
  #213: `tests/integration/staff-notifications.test.ts` › "SCRUM-124 [AC8,
  AC11, AC14] TC-124-08, TC-124-11: a safety check's Changes requested flags
  the booking, and tells its Coordinator and each Venue Staff member once".
- **AC13, an approved change request:** SCRUM-128, merged in #181, puts an
  approved or awaiting check out of date with `outdateSafetyChecks`:
  `tests/unit/change-decision.test.ts` › "SCRUM-128 [AC4] TC-128-04: an
  impactful change flags the event's arrangements and outdates its safety
  check" and "SCRUM-128 [AC4] TC-128-04: a layout change outdates a safety
  check without flagging anything"; `tests/integration/change-decision.test.ts`
  › "SCRUM-128 [AC2, AC4, AC5] TC-128-11: …". SCRUM-25's edits, approving a
  booking, placing, rejecting, confirming or releasing a hold, withdrawing a
  request, reserving equipment and cancelling a flagged arrangement do the same
  (TC-166-12).

| ID | Type | Criterion | Automated |
|---|---|---|---|
| [TC-166-01](#tc-166-01) | Positive | AC 1, AC 12 | Unit, integration |
| [TC-166-02](#tc-166-02) | Negative, Concurrency | AC 1, AC 7 | Unit, integration |
| [TC-166-03](#tc-166-03) | Negative | AC 1 | Unit |
| [TC-166-04](#tc-166-04) | Positive | AC 3, AC 5, AC 14 | Unit |
| [TC-166-05](#tc-166-05) | Positive | AC 3, AC 10 | Unit, integration |
| [TC-166-06](#tc-166-06) | Positive | AC 11, AC 12 | Unit, integration |
| [TC-166-07](#tc-166-07) | Positive | AC 4 | Unit, integration |
| [TC-166-08](#tc-166-08) | Negative | AC 3 | Unit, e2e |
| [TC-166-09](#tc-166-09) | Negative | AC 6 | Unit |
| [TC-166-10](#tc-166-10) | Positive, Negative | AC 9, AC 15 | Unit, integration |
| [TC-166-11](#tc-166-11) | Concurrency, Negative | AC 7, AC 8 | Unit, integration |
| [TC-166-12](#tc-166-12) | Positive, Negative | AC 13 | Unit, integration |
| [TC-166-13](#tc-166-13) | Positive | AC 2 | Unit, e2e |
| [TC-166-14](#tc-166-14) | Positive | AC 5 | Unit |
| [TC-166-15](#tc-166-15) | Positive | AC 1, AC 2, AC 3, AC 9, AC 14 | e2e |
| [TC-166-16](#tc-166-16) | Positive, Negative | AC 3, AC 4, AC 10 | e2e |
| [TC-166-17](#tc-166-17) | Positive | AC 1, AC 13 | Unit, integration |

### TC-166-01

| Item | Content |
|---|---|
| Test Case ID | TC-166-01 |
| Test Scenario | [Positive] AC 1, AC 12: once the venue and equipment are complete, the Coordinator requests a check |
| Pre-conditions | No check yet; or the last one was Changes requested, Rejected or Outdated and its flags are resolved. |
| Test Steps | 1. Open the event's details. <br> 2. Click **Request safety check**. |
| Test Data | — |
| Expected Result | "Safety check requested. The Safety Officers have been notified." The item reads Awaiting review, the check joins the Safety Officers' queue (oldest first), and each Safety Officer gets a "Safety check requested" notification. |

**Automated by:** `tests/unit/safety-check-request.test.ts` › "SCRUM-166 [AC1] TC-166-01: …", "SCRUM-166 [AC12] TC-166-01: …"; `tests/unit/safety-check.test.ts` › "SCRUM-166 [AC1, AC12] TC-166-01: …"; `tests/unit/readiness-actions.test.ts` › "SCRUM-166 [AC1, AC12] TC-166-01: …"; `tests/unit/safety-check-queries.test.ts` › "SCRUM-166 [AC1] TC-166-01: …"; `tests/integration/safety-check.test.ts` › "SCRUM-166 [AC1, AC9] TC-166-01: …"

### TC-166-02

| Item | Content |
|---|---|
| Test Case ID | TC-166-02 |
| Test Scenario | [Negative, Concurrency] AC 1, AC 7: a check isn't offered or created when it shouldn't be, and never twice |
| Pre-conditions | One at a time: the venue is still Pending; a check awaits review; the check is Approved; the event is Confirmed. |
| Test Steps | 1. Open the event's details. <br> 2. Send the request directly. <br> 3. Send two requests at the same moment. |
| Test Data | — |
| Expected Result | 1. **Request safety check** isn't shown. 2. Refused: "Arrange the venue and equipment before requesting a safety check. Outstanding: Venue booking (Pending).", "This event's safety check is already approved." or "Only an event in Planning can have a safety check."; while one awaits review, that check is returned. 3. One check exists. |

**Automated by:** `tests/unit/safety-check-request.test.ts` › "… TC-166-02: …" (4 tests); `tests/unit/safety-check.test.ts`, `tests/unit/readiness-actions.test.ts` › "… TC-166-02: …"; `tests/integration/safety-check.test.ts` › "SCRUM-166 [AC7] TC-166-02: …"

### TC-166-03

| Item | Content |
|---|---|
| Test Case ID | TC-166-03 |
| Test Scenario | [Negative] AC 1: only the event's assigned Coordinator requests a check |
| Pre-conditions | — |
| Test Steps | Request a check as every other role, as another Coordinator, and after the event was reassigned. |
| Test Data | `coordinator2@test.local`, `organiser@test.local`, `safety@test.local`. |
| Expected Result | "You do not have permission to do that.", "Event not found." or "This event was updated by another user. Refresh and try again."; nothing is written. The Safety Officer's menu starts with **Safety Checks**. |

**Automated by:** `tests/unit/safety-check-request.test.ts` › "… TC-166-03: …" (2 tests); `tests/unit/auth.test.ts` › "SCRUM-166 [AC1] TC-166-03: …"; `tests/unit/nav.test.ts` › "… SCRUM-166 [AC1] TC-166-03: …"

### TC-166-04

| Item | Content |
|---|---|
| Test Case ID | TC-166-04 |
| Test Scenario | [Positive] AC 3, AC 5, AC 14: the Safety Officer approves |
| Pre-conditions | A check awaits review. Signed in as `safety@test.local`. |
| Test Steps | 1. Open **Safety Checks** and the event. <br> 2. Choose **Approve** and click **Record outcome**. |
| Test Data | No note. |
| Expected Result | The status reads Approved, with who and when. Nothing is flagged and the event stays in Planning. |

**Automated by:** `tests/unit/safety-check-outcome.test.ts` › "SCRUM-166 [AC3, AC5, AC14] TC-166-04: …"

### TC-166-05

| Item | Content |
|---|---|
| Test Case ID | TC-166-05 |
| Test Scenario | [Positive] AC 3, AC 10: Changes requested flags the picked arrangements with the note |
| Pre-conditions | A check awaits review. |
| Test Steps | Choose **Request changes**, tick Exhibition Hall, write a note, click **Record outcome**. |
| Test Data | Note "Move the stage away from the east exit." |
| Expected Result | The check is Changes requested with the note and the picked booking kept. The booking stays Approved and is flagged "Safety check changes requested: …". The event stays in Planning. |

**Automated by:** `tests/unit/safety-check-outcome.test.ts` › "SCRUM-166 [AC3, AC10] TC-166-05: …"; `tests/integration/safety-check.test.ts` › "SCRUM-166 [AC3, AC10] TC-166-05: …"

### TC-166-06

| Item | Content |
|---|---|
| Test Case ID | TC-166-06 |
| Test Scenario | [Positive] AC 11, AC 12: Rejected flags every arrangement; a new check follows once they're resolved |
| Pre-conditions | A check awaits review; the event has a booking and a reservation. |
| Test Steps | 1. Record **Reject** with a note. <br> 2. As the Coordinator, request again. <br> 3. Resolve both flags and request again. |
| Test Data | Note "No crowd plan." |
| Expected Result | 1. Both are flagged; the event stays in Planning. 2. Refused while they're flagged. 3. A second check awaits review. |

**Automated by:** `tests/unit/safety-check-outcome.test.ts` › "SCRUM-166 [AC11] TC-166-06: …"; `tests/integration/safety-check.test.ts` › "SCRUM-166 [AC11, AC12] TC-166-06: …"

### TC-166-07

| Item | Content |
|---|---|
| Test Case ID | TC-166-07 |
| Test Scenario | [Positive] AC 4: the Coordinator is told the outcome and the note |
| Pre-conditions | A check awaits review. |
| Test Steps | Record an outcome. |
| Test Data | Rejected with a note; Approved without one. |
| Expected Result | The Coordinator gets a "Safety check …" notification: `"Concert": Rejected. <note>` or `"Concert": Approved.` |

**Automated by:** `tests/unit/safety-check-outcome.test.ts` › "SCRUM-166 [AC4] TC-166-07: …" (2 tests); `tests/integration/safety-check.test.ts` › "SCRUM-166 [AC3, AC10] TC-166-05: …"

### TC-166-08

| Item | Content |
|---|---|
| Test Case ID | TC-166-08 |
| Test Scenario | [Negative] AC 3: Changes requested and Rejected need a note; Changes requested needs a pick |
| Pre-conditions | A check awaits review. |
| Test Steps | 1. Choose **Request changes** with no note and no pick. <br> 2. Send it directly; send a pick from another event. |
| Test Data | — |
| Expected Result | 1. **Record outcome** stays disabled. 2. "A note is required for Changes requested or Rejected.", "Pick at least one venue booking or equipment reservation the changes affect." or "Pick only this event's current venue bookings or equipment reservations." Nothing is written. |

**Automated by:** `tests/unit/safety-check-outcome.test.ts` › "SCRUM-166 [AC3] TC-166-08: …" (2 tests); `e2e/safety-check.spec.ts` (TC-166-16)

### TC-166-09

| Item | Content |
|---|---|
| Test Case ID | TC-166-09 |
| Test Scenario | [Negative] AC 6: only a Safety Officer, and never for their own event |
| Pre-conditions | A check awaits review. |
| Test Steps | Record an outcome as every other role, and as a Safety Officer who organises or coordinates the event. |
| Test Data | — |
| Expected Result | "You do not have permission to do that." or "Safety check not found."; the check is missing from that officer's queue and its page reads not found. |

**Automated by:** `tests/unit/safety-check-outcome.test.ts`, `tests/unit/safety-check-queries.test.ts`, `tests/unit/auth.test.ts` › "SCRUM-166 [AC6] TC-166-09: …"

### TC-166-10

| Item | Content |
|---|---|
| Test Case ID | TC-166-10 |
| Test Scenario | [Positive, Negative] AC 9, AC 15: the checklist's Safety check item, and Confirm waits for Approved |
| Pre-conditions | Venue and equipment complete. |
| Test Steps | Open the checklist with no check, then each outcome; try to confirm. |
| Test Data | — |
| Expected Result | Not requested, Awaiting review, Approved, Changes requested, Rejected or Outdated; only Approved completes it. Until then Confirm is disabled and a direct confirm is refused: "… Outstanding: Safety check (Not requested)." The event's status stays Planning. |

**Automated by:** `tests/unit/safety-check.test.ts` › "SCRUM-166 [AC9 …] TC-166-10: …" (4 tests); `tests/unit/event-readiness.test.ts` › "… SCRUM-166 [AC9] …"; `tests/integration/safety-check.test.ts` › "… TC-166-01: …", "SCRUM-166 [AC9, AC14] TC-166-10: …"

### TC-166-11

| Item | Content |
|---|---|
| Test Case ID | TC-166-11 |
| Test Scenario | [Concurrency, Negative] AC 7, AC 8: a second recording changes nothing |
| Pre-conditions | A check awaits review; a second Safety Officer exists. |
| Test Steps | 1. Two officers record outcomes at the same moment. <br> 2. Record again on a decided check. |
| Test Data | — |
| Expected Result | One is saved; the other is told "This check is already Approved by … on …; nothing was changed." One history entry. |

**Automated by:** `tests/unit/safety-check-outcome.test.ts` › "SCRUM-166 [AC7, AC8] TC-166-11: …", "SCRUM-166 [AC15] TC-166-11: …"; `tests/integration/safety-check.test.ts` › "SCRUM-166 [AC8] TC-166-11: …"

### TC-166-12

| Item | Content |
|---|---|
| Test Case ID | TC-166-12 |
| Test Scenario | [Positive, Negative] AC 13: a change makes the check Outdated |
| Pre-conditions | The check is Approved. |
| Test Steps | 1. Venue Staff approve a second venue for the event, or place or reject a hold on one (or Technical Support reserve equipment, or the Coordinator cancels a flagged arrangement). <br> 2. Try to approve the check. <br> 3. Try to confirm. |
| Test Data | — |
| Expected Result | 1. The check is Outdated with the time. 2. "This check is Outdated because the event's arrangements changed; nothing was changed. The Coordinator needs to request a new one." 3. Refused: "… Safety check (Outdated)." |

**Automated by:** `tests/unit/safety-check.test.ts`, `tests/unit/bookings.test.ts`, `tests/unit/request-reservation.test.ts`, `tests/unit/safety-check-outcome.test.ts` › "SCRUM-166 [AC13] TC-166-12: …"; `tests/unit/booking-holds.test.ts` › "SCRUM-163 [AC1, AC5] TC-163-01, TC-163-09: …" (placing a hold); `tests/unit/reconsideration-actions.test.ts` › "SCRUM-26 [AC10] TC-26-11: …"; `tests/integration/safety-check.test.ts` › "SCRUM-166 [AC9, AC13, AC14] TC-166-12: …"

### TC-166-13

| Item | Content |
|---|---|
| Test Case ID | TC-166-13 |
| Test Scenario | [Positive] AC 2: the Safety Officer sees the arrangements, read-only |
| Pre-conditions | A check awaits review; the booking is for 150 in a theatre layout; a projector is reserved with "Ceiling mount above the stage."; the Coordinator added an operational note (SCRUM-25 AC6). |
| Test Steps | Open the check from **Safety Checks**. |
| Test Data | — |
| Expected Result | The expected attendance; for Exhibition Hall its capacity (200), the attendance booked, requested and supported layouts, accessibility needs and features, setup and turnaround, and known restrictions; the projector with its specs and placement; the operational note with who wrote it and when. A hold past its expiry isn't listed. |

**Automated by:** `tests/unit/safety-check-queries.test.ts` › "SCRUM-166 [AC2] TC-166-13: …"; `e2e/safety-check.spec.ts` (TC-166-15)

### TC-166-14

| Item | Content |
|---|---|
| Test Case ID | TC-166-14 |
| Test Scenario | [Positive] AC 5: every check is kept |
| Pre-conditions | The event had a check that was Changes requested, and one that went Outdated. |
| Test Steps | Open its new check. |
| Test Data | — |
| Expected Result | "Earlier checks for this event" lists both, newest first, with outcome, note, who and when. |

**Automated by:** `tests/unit/safety-check-queries.test.ts` › "SCRUM-166 [AC5] TC-166-14: …"

### TC-166-15

| Item | Content |
|---|---|
| Test Case ID | TC-166-15 |
| Test Scenario | [Positive] AC 1, AC 2, AC 3, AC 9, AC 14: request, review, approve, confirm |
| Pre-conditions | The arranged event. |
| Test Steps | 1. As the Coordinator, see Confirm disabled and click **Request safety check**. <br> 2. As `safety@test.local`, open it from the queue, review the venue, **Approve**. <br> 3. As the Coordinator, click **Confirm event**. |
| Test Data | — |
| Expected Result | 1. Awaiting review. 2. Approved. 3. "Event confirmed." |

**Automated by:** `e2e/safety-check.spec.ts` › "SCRUM-166 [AC1, AC2, AC3, AC9, AC14] TC-166-15: …"

### TC-166-16

| Item | Content |
|---|---|
| Test Case ID | TC-166-16 |
| Test Scenario | [Positive, Negative] AC 3, AC 4, AC 10: request changes in the browser |
| Pre-conditions | A check awaits review. |
| Test Steps | 1. As the Safety Officer, choose **Request changes**; see **Record outcome** disabled without a note, then without a pick; add both and record. <br> 2. Open the event as the Coordinator, then as the Organiser. |
| Test Data | Note "Keep the east fire exit clear of seating." |
| Expected Result | 2. The Coordinator sees "Changes requested – <note>" and the venue's Needs Reconsideration badge; the Organiser sees Changes requested without the note. |

**Automated by:** `e2e/safety-check.spec.ts` › "SCRUM-166 [AC3, AC4, AC10] TC-166-16: …"

### TC-166-17

| Item | Content |
|---|---|
| Test Case ID | TC-166-17 |
| Test Scenario | [Positive] AC 1, AC 13: rejecting a Planning event outdates its safety check, and the queue lists only Planning events' checks |
| Pre-conditions | A Planning event with an approved booking, a reservation and a safety check awaiting review. |
| Test Steps | 1. As its Coordinator, reject the event (SCRUM-117). <br> 2. As `safety@test.local`, open **Safety checks**. |
| Test Data | — |
| Expected Result | Step 1: in the same operation as the bookings and reservations are released, the check becomes Outdated, as cancelling makes it (SCRUM-82). Step 2: the check isn't listed. A check awaiting review on any event no longer in Planning is left out of the queue, since recording it would be refused. |

**Automated by:** `tests/unit/reject-planning.test.ts` › "SCRUM-166 [AC13] TC-166-17: rejecting a Planning event makes its awaiting or approved safety check Outdated, in the same operation"; `tests/integration/reject-planning.test.ts` › "SCRUM-117 [AC1, AC3, AC6] TC-117-08: the event is Rejected and its booking, reservation, equipment request and change request are released together, returning the stock" (the check is Outdated); `tests/unit/safety-check-queries.test.ts` › "SCRUM-166 [AC1] TC-166-01: lists checks awaiting review, oldest request first, with the event and who asked" (the query keeps to Planning events)
