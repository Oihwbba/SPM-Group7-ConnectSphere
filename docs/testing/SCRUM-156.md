# SCRUM-156 — Make the one-type equipment form availability-only: test cases

Story and acceptance criteria: [docs/backlog/SCRUM-156.md](../backlog/SCRUM-156.md).
Format and conventions: [README.md](README.md). The PO chose option (b) on
5 Oct 2026: reserving happens only through SCRUM-155's **Reserve an approved
request** card, and the form below it only checks availability and
commitments.

**Shared pre-conditions for every case:** the database is migrated and seeded
and the app is running. Signed in as `techsupport@test.local` (`Password123!`)
on **Equipment**. Cases use a far-future period so seeded reservations and
maintenance don't overlap it.

| ID                      | Type       | Criterion     | Automated   |
| ----------------------- | ---------- | ------------- | ----------- |
| [TC-156-01](#tc-156-01) | Positive   | AC 1          | e2e         |
| [TC-156-02](#tc-156-02) | Positive   | AC 1          | e2e         |
| [TC-156-03](#tc-156-03) | Negative   | AC 2          | Unit        |
| [TC-156-04](#tc-156-04) | Positive   | AC 3          | e2e         |
| [TC-156-05](#tc-156-05) | Positive   | AC 4          | Integration |
| [TC-156-06](#tc-156-06) | Regression | SCRUM-30 AC 1 | e2e         |

---

### TC-156-01

| Item            | Content                                                                                                                                                   |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Test Case ID    | TC-156-01                                                                                                                                                 |
| Test Scenario   | [Positive] AC 1: availability is checked for a type and period without choosing an event, and the form offers no way to reserve                           |
| Pre-conditions  | Shared.                                                                                                                                                   |
| Test Steps      | 1. In **Equipment availability**, choose Lectern, 10 May 2031 09:00–17:00 and quantity 1. 2. Look for an event field or a reserve button in that section. |
| Test Data       | Lectern (4 in the pool).                                                                                                                                  |
| Expected Result | 1. "N unit(s) available for this period" and "N of 4 available". 2. There is no **Approved event** field and no **Reserve equipment** button.             |

**Automated by:** `e2e/equipment.spec.ts` › "SCRUM-156 [AC1] TC-156-01: …"

### TC-156-02

| Item            | Content                                                                                                                 |
| --------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Test Case ID    | TC-156-02                                                                                                               |
| Test Scenario   | [Positive] AC 1: an item's commitments (SCRUM-30) are shown without choosing an event                                   |
| Pre-conditions  | Shared. The seed holds a damaged speaker and projectors in for maintenance.                                             |
| Test Steps      | 1. Choose Speaker as the equipment type, with no period. 2. Add a period.                                               |
| Test Data       | —                                                                                                                       |
| Expected Result | 1. Its commitments are listed with their reasons. 2. They split into those during the period and the item's other ones. |

**Automated by:** `e2e/equipment.spec.ts` › "SCRUM-30 — View Equipment Conflicts" (every case selects a type and period only)

### TC-156-03

| Item            | Content                                                                                                                                                                                                          |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Test Case ID    | TC-156-03                                                                                                                                                                                                        |
| Test Scenario   | [Negative] AC 2: reserving without going through an approved request is refused                                                                                                                                  |
| Pre-conditions  | —                                                                                                                                                                                                                |
| Test Steps      | 1. List the server actions the Equipment page exposes that reserve anything.                                                                                                                                     |
| Test Data       | —                                                                                                                                                                                                                |
| Expected Result | Only `reserveEquipmentRequest`, which reserves an approved request. The one-type `createReservation` no longer exists, so a call that bypasses an approved request has nothing to reach and nothing is reserved. |

**Automated by:** `tests/unit/reservation.test.ts` › "SCRUM-156 [AC2] TC-156-03: …"

### TC-156-04

| Item            | Content                                                                                                                                       |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Test Case ID    | TC-156-04                                                                                                                                     |
| Test Scenario   | [Positive] AC 3: the page points to the approved-request card                                                                                 |
| Pre-conditions  | Shared.                                                                                                                                       |
| Test Steps      | 1. Open **Equipment**. 2. Click **Reserve an approved request** in the availability section's description.                                    |
| Test Data       | —                                                                                                                                             |
| Expected Result | 1. **Reserve an approved request** is at the top and **Equipment availability** below it. 2. The page moves to the card (`#reserve-request`). |

**Automated by:** `e2e/equipment.spec.ts` › "SCRUM-156 [AC3] TC-156-04: …"

### TC-156-05

| Item            | Content                                                                                                                                                                                                      |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Test Case ID    | TC-156-05                                                                                                                                                                                                    |
| Test Scenario   | [Positive] AC 4: reservations made with the one-type form before this change stay and still count                                                                                                            |
| Pre-conditions  | An Approved request for a Planning event, and a Confirmed reservation for that event with no request linked, as the old form made them.                                                                      |
| Test Steps      | 1. Open the **Approved request** list. 2. Reserve the request directly.                                                                                                                                      |
| Test Data       | Projector × 2 reserved the old way.                                                                                                                                                                          |
| Expected Result | 1. The request is not listed. 2. Refused as already reserved; the old reservation is untouched. It still counts against availability, and the SCRUM-110 checklist counts by event, so it still counts there. |

**Automated by:** `tests/integration/request-reservation.test.ts` › "SCRUM-155 [AC6] TC-155-12, SCRUM-156 [AC4] TC-156-05: …"

### TC-156-06

| Item            | Content                                                                                                                                                           |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Test Case ID    | TC-156-06                                                                                                                                                         |
| Test Scenario   | [Regression] SCRUM-30 AC 1: a reservation made in the card shows in the availability check below it without a reload                                              |
| Pre-conditions  | An equipment type with 4 units and nothing committed, and an Approved request for one unit of it for a Planning event on the checked day.                         |
| Test Steps      | 1. Check that type for the event's period. 2. Choose the request in the card and **Reserve all**.                                                                 |
| Test Data       | —                                                                                                                                                                 |
| Expected Result | 1. "4 of 4 available", nothing during the period. 2. Without reloading: "3 of 4 available", and the new reservation is listed under the period, naming the event. |

**Automated by:** `e2e/equipment.spec.ts` › "AC 1: a reservation made in the request card appears in the commitments without a reload"
