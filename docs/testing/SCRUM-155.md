# SCRUM-155 — Reserve an approved equipment request in one step: test cases

Story and acceptance criteria: [SCRUM-155 in Jira](https://smu-spm-group7.atlassian.net/browse/SCRUM-155)
(written on 4 Oct 2026 from the SCRUM-31 review feedback; mirrored in
[docs/backlog/SCRUM-155.md](../backlog/SCRUM-155.md)). Format and conventions: [README.md](README.md).
The reservation is made by `reserveEquipmentRequest` in
[app/(app)/equipment/actions.ts](<../../app/(app)/equipment/actions.ts>); the
requests offered come from `getReservableRequests` in
[lib/equipment/request-queries.ts](../../lib/equipment/request-queries.ts), and
both use the same `reservableRequest` rule.

**Shared pre-conditions for every case:** the database is migrated and seeded
and the app is running. Signed in as `techsupport@test.local` (`Password123!`)
on **Equipment**. Unless the case says otherwise, the event is in Planning and
runs 09:00–17:00 Singapore time on one day, and its equipment request is
Approved and asks for 1 Projector and 2 Wireless Microphones.

| ID                      | Type        | Criterion | Automated              |
| ----------------------- | ----------- | --------- | ---------------------- |
| [TC-155-01](#tc-155-01) | Positive    | AC 1      | Unit, integration      |
| [TC-155-02](#tc-155-02) | Positive    | AC 2      | Unit, e2e              |
| [TC-155-03](#tc-155-03) | Positive    | AC 2      | e2e                    |
| [TC-155-04](#tc-155-04) | Positive    | AC 3      | Unit, integration, e2e |
| [TC-155-05](#tc-155-05) | Negative    | AC 4      | Unit, integration, e2e |
| [TC-155-06](#tc-155-06) | Negative    | AC 6      | Unit, integration, e2e |
| [TC-155-07](#tc-155-07) | Concurrency | AC 5      | Integration            |
| [TC-155-08](#tc-155-08) | Concurrency | AC 5      | Unit, integration      |
| [TC-155-09](#tc-155-09) | Negative    | AC 7      | Unit                   |
| [TC-155-10](#tc-155-10) | Negative    | AC 1      | Unit, integration      |
| [TC-155-11](#tc-155-11) | Negative    | Errors    | e2e                    |
| [TC-155-12](#tc-155-12) | Negative    | AC 6      | Unit, integration      |
| [TC-155-13](#tc-155-13) | Negative    | AC 2      | Unit, integration      |
| [TC-155-14](#tc-155-14) | Negative    | AC 7      | Unit                   |
| [TC-155-15](#tc-155-15) | Concurrency | AC 5      | Unit, integration      |
| [TC-155-16](#tc-155-16) | Concurrency | AC 5, 6   | Unit, integration      |

---

### TC-155-01

| Item            | Content                                                                                                                                                                               |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Test Case ID    | TC-155-01                                                                                                                                                                             |
| Test Scenario   | [Positive] AC 1: only approved requests for an Approved or Planning event that hasn't started, with nothing reserved for it yet, are offered                                          |
| Pre-conditions  | One Approved request for a Planning event, one In Review request, one Approved request for a Confirmed event, and one Approved request for a Planning event that has already started. |
| Test Steps      | 1. Open the **Approved request** list.                                                                                                                                                |
| Test Data       | —                                                                                                                                                                                     |
| Expected Result | Only the Approved request for the upcoming Planning event is listed, by event name and period. The In Review one, the Confirmed event's and the started event's are not.              |

**Automated by:** `tests/unit/equipment-request-queries.test.ts` › "SCRUM-155 [AC1, AC6] TC-155-01: …"; `tests/unit/request-reservation.test.ts` › "SCRUM-155 [AC1, AC6] TC-155-01: …"; `tests/integration/request-reservation.test.ts` › "SCRUM-155 [AC1, AC6] TC-155-01, TC-155-06: …"

### TC-155-02

| Item            | Content                                                                                                                                                                                                                                                  |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Test Case ID    | TC-155-02                                                                                                                                                                                                                                                |
| Test Scenario   | [Positive] AC 2: choosing a request fills in its event's period and one row per line                                                                                                                                                                     |
| Pre-conditions  | Shared.                                                                                                                                                                                                                                                  |
| Test Steps      | 1. Choose the request under **Approved request**. 2. Choose another request whose event has the same times.                                                                                                                                              |
| Test Data       | Event 09:00–17:00 Singapore time.                                                                                                                                                                                                                        |
| Expected Result | **Reservation starts** and **Reservation ends** show 09:00 and 17:00 on the event's day. Item 1 is Projector × 1 and Item 2 is Wireless Microphone × 2, each saying how many are free for the period. After step 2 the rows again say how many are free. |

**Automated by:** `tests/unit/equipment-request-queries.test.ts` › "SCRUM-155 [AC2] TC-155-02: …"; `e2e/request-reservation.spec.ts` › "SCRUM-155 [AC1, AC2] TC-155-02: …"

### TC-155-03

| Item            | Content                                                                                                                   |
| --------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Test Case ID    | TC-155-03                                                                                                                 |
| Test Scenario   | [Positive] AC 2: rows can be removed, added and changed before saving, and the edited list is what gets reserved          |
| Pre-conditions  | Shared. The request is chosen.                                                                                            |
| Test Steps      | 1. **Remove item 2**. 2. **Add item**, choose Laptop, 3 units. 3. Change item 1 to 2 units. 4. **Reserve all 2 item(s)**. |
| Test Data       | —                                                                                                                         |
| Expected Result | "Reserved 2 item(s) for …". The request now has Projector × 2 and Laptop × 3 reserved, and no microphones.                |

**Automated by:** `e2e/request-reservation.spec.ts` › "SCRUM-155 [AC2] TC-155-03: …"

### TC-155-04

| Item            | Content                                                                                                                                         |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Test Case ID    | TC-155-04                                                                                                                                       |
| Test Scenario   | [Positive] AC 3: when every row fits, all are reserved together, each Confirmed and linked to the event and the request                         |
| Pre-conditions  | Shared. Nothing else is committed for the period.                                                                                               |
| Test Steps      | 1. Choose the request. 2. **Reserve all 2 item(s)**.                                                                                            |
| Test Data       | —                                                                                                                                               |
| Expected Result | "Reserved 2 item(s) for …". Two Confirmed reservations exist for the event's period, both linked to the request; availability drops by 1 and 2. |

**Automated by:** `tests/unit/request-reservation.test.ts` › "SCRUM-155 [AC3] TC-155-04: …"; `tests/integration/request-reservation.test.ts` › "SCRUM-155 [AC3] TC-155-04: …"; `e2e/request-reservation.spec.ts` › "SCRUM-155 [AC3, AC6] TC-155-04, TC-155-06: …"

### TC-155-05

| Item            | Content                                                                                                                                                                                                                                   |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Test Case ID    | TC-155-05                                                                                                                                                                                                                                 |
| Test Scenario   | [Negative] AC 4: one short row means nothing is reserved, and every short row shows what is free and the shortfall                                                                                                                        |
| Pre-conditions  | Shared. The request is chosen.                                                                                                                                                                                                            |
| Test Steps      | 1. Set **Units for item 2** to 999. 2. **Reserve all 2 item(s)**.                                                                                                                                                                         |
| Test Data       | 999 microphones, from a pool of 25.                                                                                                                                                                                                       |
| Expected Result | The row already warns "Only … of 25 free for this period — … short." before saving. After saving: "Nothing was reserved…", the row keeps the shortfall, and no reservation exists for the request, not even the projector that would fit. |

**Automated by:** `tests/unit/request-reservation.test.ts` › both "SCRUM-155 [AC4] TC-155-05: …" tests; `tests/integration/request-reservation.test.ts` › "SCRUM-155 [AC4] TC-155-05: …"; `e2e/request-reservation.spec.ts` › "SCRUM-155 [AC4] TC-155-05: …"

### TC-155-06

| Item            | Content                                                                                                                                                         |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Test Case ID    | TC-155-06                                                                                                                                                       |
| Test Scenario   | [Negative] AC 6: a reserved request is no longer offered, and reserving it again is refused; cancelling its reservations offers it again                        |
| Pre-conditions  | The request has just been reserved (TC-155-04).                                                                                                                 |
| Test Steps      | 1. Open the **Approved request** list. 2. Reserve the same request again (e.g. from a page opened before the first reservation). 3. Cancel its reservations.    |
| Test Data       | —                                                                                                                                                               |
| Expected Result | 1. It is not listed. 2. "This request is not waiting to be reserved: it is already reserved, or no longer approved." Nothing is written. 3. It is listed again. |

**Automated by:** `tests/unit/request-reservation.test.ts` › "SCRUM-155 [AC1, AC6] TC-155-06, TC-155-10, TC-155-12: …"; `tests/integration/request-reservation.test.ts` › "SCRUM-155 [AC1, AC6] TC-155-01, TC-155-06: …"; `e2e/request-reservation.spec.ts` › "SCRUM-155 [AC3, AC6] TC-155-04, TC-155-06: …"

### TC-155-07

| Item            | Content                                                                                                   |
| --------------- | --------------------------------------------------------------------------------------------------------- |
| Test Case ID    | TC-155-07                                                                                                 |
| Test Scenario   | [Concurrency] AC 5: two staff reserve the same request at the same moment                                 |
| Pre-conditions  | An Approved, unreserved request.                                                                          |
| Test Steps      | 1. Submit the same reservation twice at once.                                                             |
| Test Data       | —                                                                                                         |
| Expected Result | One succeeds, the other is told it is already reserved. The request's reservations exist once, not twice. |

**Automated by:** `tests/integration/request-reservation.test.ts` › "SCRUM-155 [AC5] TC-155-07: …" (it fails, three runs out of three, when the request-row lock is removed)

### TC-155-08

| Item            | Content                                                                                                                                                                                                                            |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Test Case ID    | TC-155-08                                                                                                                                                                                                                          |
| Test Scenario   | [Concurrency] AC 5: two requests needing the last unit of a type are reserved at the same moment, with their rows in opposite order                                                                                                |
| Pre-conditions  | A pool with one unit; two Approved requests for different events that each need it, plus another type with room for both.                                                                                                          |
| Test Steps      | 1. Reserve both requests at once.                                                                                                                                                                                                  |
| Test Data       | Request A lists the roomy type first; request B lists the scarce type first.                                                                                                                                                       |
| Expected Result | One succeeds and the other reserves nothing at all. The scarce pool is never over-allocated, and neither attempt deadlocks: the event, then the request and then the equipment rows (in id order) are always locked in that order. |

**Automated by:** `tests/unit/request-reservation.test.ts` › "SCRUM-155 [AC5] TC-155-08, TC-155-15: …"; `tests/integration/request-reservation.test.ts` › "SCRUM-155 [AC5] TC-155-08: …"

### TC-155-09

| Item            | Content                                                                                                                                                                          |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Test Case ID    | TC-155-09                                                                                                                                                                        |
| Test Scenario   | [Negative] AC 7: invalid rows or periods reserve nothing and say where the problem is                                                                                            |
| Pre-conditions  | Shared. The request is chosen.                                                                                                                                                   |
| Test Steps      | Try each in turn: remove every row; a row with no type; 0 or 1.5 units; the same type on two rows; an end at or before the start; a start in the past.                           |
| Test Data       | —                                                                                                                                                                                |
| Expected Result | Nothing is reserved. The message is shown at the row or period field it belongs to, e.g. "This equipment type is already on another row." or "Start time cannot be in the past." |

**Automated by:** `tests/unit/request-reservation.test.ts` › "SCRUM-155 [AC7] TC-155-09: …"

### TC-155-10

| Item            | Content                                                                                          |
| --------------- | ------------------------------------------------------------------------------------------------ |
| Test Case ID    | TC-155-10                                                                                        |
| Test Scenario   | [Negative] AC 1: a request whose event is Confirmed, or that is not Approved, cannot be reserved |
| Pre-conditions  | An Approved request for a Confirmed event.                                                       |
| Test Steps      | 1. Submit a reservation for it directly (it is not offered in the list).                         |
| Test Data       | —                                                                                                |
| Expected Result | Refused; nothing is written.                                                                     |

**Automated by:** `tests/unit/request-reservation.test.ts` › "SCRUM-155 [AC1, AC6] TC-155-06, TC-155-10, TC-155-12: …"; `tests/integration/request-reservation.test.ts` › "SCRUM-155 [AC1] TC-155-10: …"

### TC-155-11

| Item            | Content                                                                                                                                                                                                                                     |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Test Case ID    | TC-155-11                                                                                                                                                                                                                                   |
| Test Scenario   | [Negative] Errors (GLM review of #130): when the server can't be reached, the card says so instead of failing silently                                                                                                                      |
| Pre-conditions  | Shared. The connection to the server drops, or the server fails, after the page has loaded.                                                                                                                                                 |
| Test Steps      | 1. Choose the request. 2. **Reserve all 2 item(s)**.                                                                                                                                                                                        |
| Test Data       | —                                                                                                                                                                                                                                           |
| Expected Result | 1. Under the rows: "Couldn't check what is free for this period. You can still reserve; the server checks again." 2. "Couldn't reach the server. Check your connection and try again." The button is usable again, and nothing is reserved. |

**Automated by:** `e2e/request-reservation.spec.ts` › "SCRUM-155 TC-155-11: …"

### TC-155-12

| Item            | Content                                                                                                                                                        |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Test Case ID    | TC-155-12                                                                                                                                                      |
| Test Scenario   | [Negative] AC 6: stock already reserved for the event with the one-type form (SCRUM-31) is not reserved a second time                                          |
| Pre-conditions  | The event's request is Approved, and Projector × 2 has already been reserved for the event on the **Reserve equipment** form, which does not link the request. |
| Test Steps      | 1. Open the **Approved request** list. 2. Reserve the request directly.                                                                                        |
| Test Data       | —                                                                                                                                                              |
| Expected Result | 1. The request is not listed. 2. Refused as already reserved; the event still holds only the two projectors.                                                   |

**Automated by:** `tests/unit/request-reservation.test.ts` › "SCRUM-155 [AC1, AC6] TC-155-06, TC-155-10, TC-155-12: …"; `tests/integration/request-reservation.test.ts` › "SCRUM-155 [AC6] TC-155-12: …"

### TC-155-13

| Item            | Content                                                                                                                                                                                                                                                                                           |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Test Case ID    | TC-155-13                                                                                                                                                                                                                                                                                         |
| Test Scenario   | [Negative] AC 2: the period may be lengthened but must still cover the whole event                                                                                                                                                                                                                |
| Pre-conditions  | Shared. The request is chosen.                                                                                                                                                                                                                                                                    |
| Test Steps      | 1. Change the period to 10:00–12:00 and **Reserve all**. 2. Change it to 08:00–18:00 and **Reserve all**.                                                                                                                                                                                         |
| Test Data       | Event 09:00–17:00 Singapore time.                                                                                                                                                                                                                                                                 |
| Expected Result | 1. "The reservation must cover the whole event." Each field says what it must be ("Start by …, when the event begins." / "End at … or later, when the event ends."), nothing is reserved, and the request stays listed. 2. Reserved, so the SCRUM-110 checklist counts the equipment as reserved. |

**Automated by:** `tests/unit/request-reservation.test.ts` › "SCRUM-155 [AC2] TC-155-13: …" (start, end, longer period, event without dates); `tests/integration/request-reservation.test.ts` › "SCRUM-155 [AC2] TC-155-13: …"

### TC-155-14

| Item            | Content                                                                                                                                      |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Test Case ID    | TC-155-14                                                                                                                                    |
| Test Scenario   | [Negative] AC 7: a row whose equipment type has been retired since the request was made is marked on that row                                |
| Pre-conditions  | The request asks for a type that is no longer active.                                                                                        |
| Test Steps      | 1. Choose the request and **Reserve all**.                                                                                                   |
| Test Data       | —                                                                                                                                            |
| Expected Result | "Nothing was reserved: an equipment type is no longer available." The row says "This equipment type is no longer available. Choose another." |

**Automated by:** `tests/unit/request-reservation.test.ts` › "marks the row whose equipment type has been retired, and reserves nothing"

### TC-155-15

| Item            | Content                                                                                                                                                    |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Test Case ID    | TC-155-15                                                                                                                                                  |
| Test Scenario   | [Concurrency] AC 5: the Coordinator rejects the Planning event (SCRUM-117) at the moment its request is being reserved                                     |
| Pre-conditions  | An Approved request for a Planning event. Rejecting locks the event, then cancels its requests.                                                            |
| Test Steps      | 1. While the event row is held, as rejecting holds it, reserve the request. 2. Take the request row, as rejecting does next.                               |
| Test Data       | —                                                                                                                                                          |
| Expected Result | Reserving waits for the event before taking the request, so step 2 is not blocked and neither side deadlocks. Reserving goes ahead once the event is free. |

**Automated by:** `tests/unit/request-reservation.test.ts` › "SCRUM-155 [AC5] TC-155-08, TC-155-15: …"; `tests/integration/request-reservation.test.ts` › "SCRUM-155 [AC5] TC-155-15: …" (it fails against the previous lock order)

### TC-155-16

| Item            | Content                                                                                                                                                               |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Test Case ID    | TC-155-16                                                                                                                                                             |
| Test Scenario   | [Concurrency] AC 5, 6: equipment is reserved for the event on the one-type **Reserve equipment** form (SCRUM-31) while this card is reserving for the same event      |
| Pre-conditions  | A Planning event. The card holds the event while it checks that nothing is reserved yet, then locks the equipment.                                                    |
| Test Steps      | 1. While the event row is held, as the card holds it, reserve on the one-type form. 2. Take that equipment row, as the card does next.                                |
| Test Data       | —                                                                                                                                                                     |
| Expected Result | The one-type form waits for the event before the equipment, so step 2 is not blocked: the two take turns on the event instead of deadlocking over the equipment rows. |

**Automated by:** `tests/unit/reservation.test.ts` › "SCRUM-155 TC-155-16: …"; `tests/integration/request-reservation.test.ts` › "SCRUM-155 [AC5, AC6] TC-155-16: …" (it fails against the previous one-type form)
