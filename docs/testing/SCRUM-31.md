# SCRUM-31 — Reserve Equipment for Event: test cases

Story and acceptance criteria: [docs/backlog/SCRUM-31.md](../backlog/SCRUM-31.md).
Format and conventions: [README.md](README.md).

**Shared pre-conditions for every case:** the database is migrated and seeded
(`npm run db:deploy && npm run db:seed`), the app is running, and the tester
signs in as Technical Support (`techsupport@test.local` / `Password123!`)
unless the case says otherwise. Cases use a far-future period so seeded
reservations and maintenance holds don't overlap it, except TC-31-08, which
needs them.

| ID | Type | Criterion | Automated |
|---|---|---|---|
| [TC-31-01](#tc-31-01) | Positive | AC 1, AC 7 | Unit, e2e |
| [TC-31-02](#tc-31-02) | Positive | AC 2 | Unit |
| [TC-31-03](#tc-31-03) | Negative | AC 3 | Unit, e2e |
| [TC-31-04](#tc-31-04) | Boundary | AC 1, AC 3 | Unit |
| [TC-31-05](#tc-31-05) | Boundary | AC 4 | Unit, integration |
| [TC-31-06](#tc-31-06) | Concurrency | AC 5 | Unit, integration |
| [TC-31-07](#tc-31-07) | Negative, Boundary | AC 6 | Unit, e2e |
| [TC-31-08](#tc-31-08) | Positive | AC 7 | Unit |
| [TC-31-09](#tc-31-09) | Negative, Boundary | Valid period | Unit (end equal to start only) |
| [TC-31-10](#tc-31-10) | Negative | Approved events only | Unit |
| [TC-31-11](#tc-31-11) | Negative | Technical Support only | Unit |

---

### TC-31-01

| Item | Content |
|---|---|
| Test Case ID | TC-31-01 |
| Test Scenario | [Positive] AC 1, AC 7: a quantity within availability is reserved as Confirmed, and availability drops by exactly that quantity |
| Pre-conditions | Signed in as Technical Support. The event "Approved — Research Symposium" is APPROVED. No reservation or maintenance hold overlaps the test period for Lectern. |
| Test Steps | 1. Open **Equipment**. <br> 2. Choose the approved event, start date and end date (live availability table updates automatically). <br> 3. Choose the equipment type, enter the quantity, and verify live availability (or click **Check availability**). <br> 4. Click **Confirm reservation**. <br> 5. Verify the live table and status message reflect the reduced availability for the period. |
| Test Data | Event: Approved — Research Symposium <br> Equipment type: Lectern (4 total) <br> Start: 2031-05-10 09:00 <br> End: 2031-05-10 17:00 <br> Quantity: 1 |
| Expected Result | Step 3 shows "N unit(s) available for this period" (and N of total in live table). Step 4 shows "Reservation confirmed. N−1 unit(s) remain available." and a reservation with status CONFIRMED and quantity 1 exists. Step 5 shows N−1 available. |

**Automated by:** `e2e/equipment.spec.ts` › "AC 1 & 7: a reservation that fits is confirmed and reduces availability"; `tests/unit/reservation.test.ts` › "AC 1 & 2: a quantity that fits is CONFIRMED, linked to the event, and availability drops by exactly that amount"

### TC-31-02

| Item | Content |
|---|---|
| Test Case ID | TC-31-02 |
| Test Scenario | [Positive] AC 2: a reservation is permanently linked to the event it was made for |
| Pre-conditions | As TC-31-01. |
| Test Steps | 1. Reserve 1 Lectern for the approved event, as in TC-31-01. <br> 2. Look up the new reservation in the database (or the event's reservations). |
| Test Data | Event ID: `evt_approved` (Approved — Research Symposium) <br> Equipment type: Lectern <br> Start: 2031-05-11 09:00 <br> End: 2031-05-11 17:00 <br> Quantity: 1 |
| Expected Result | The reservation's `eventId` is `evt_approved`, `reservedById` is the Technical Support user, and the reservation offers no way to move it to another event. |

**Automated by:** `tests/unit/reservation.test.ts` › "AC 1 & 2: a quantity that fits is CONFIRMED, linked to the event, and availability drops by exactly that amount"

### TC-31-03

| Item | Content |
|---|---|
| Test Case ID | TC-31-03 |
| Test Scenario | [Negative] AC 3: a quantity above availability is refused, and the shortfall is shown |
| Pre-conditions | As TC-31-01. |
| Test Steps | 1. Open **Equipment**. <br> 2. Choose the approved event, Lectern and the period. <br> 3. Enter the quantity. <br> 4. Click **Confirm reservation**. |
| Test Data | Event: Approved — Research Symposium <br> Equipment type: Lectern (4 total) <br> Start: 2031-05-10 09:00 <br> End: 2031-05-10 17:00 <br> Quantity: 99 |
| Expected Result | "Only N of 4 unit(s) are available for this period — (99−N) short." is shown. No reservation is created and availability is unchanged. |

**Automated by:** `e2e/equipment.spec.ts` › "AC 3: requesting more than the pool is refused and the shortfall is shown"; `tests/unit/reservation.test.ts` › "AC 3: over-allocation is refused and the shortfall is shown"

### TC-31-04

| Item | Content |
|---|---|
| Test Case ID | TC-31-04 |
| Test Scenario | [Boundary] AC 1, AC 3: reserving exactly every available unit succeeds, and one more unit is refused |
| Pre-conditions | As TC-31-01, with all 4 Lecterns available for the period. |
| Test Steps | 1. Reserve Lectern with quantity equal to the number available. <br> 2. Check availability for the same period. <br> 3. Try to reserve 1 more Lectern for the same period. |
| Test Data | Equipment type: Lectern (4 total) <br> Start: 2031-05-12 09:00 <br> End: 2031-05-12 17:00 <br> Step 1 quantity: 4 <br> Step 3 quantity: 1 |
| Expected Result | Step 1 is confirmed with "0 unit(s) remain available." Step 2 shows 0 available. Step 3 is refused with "Only 0 of 4 unit(s) are available for this period — 1 short." |

**Automated by:** `tests/unit/reservation.test.ts` › "AC 1 & 2: a quantity that fits is CONFIRMED, linked to the event, and availability drops by exactly that amount" (5 of 5 available, leaving 0). Step 3 is **Manual**.

### TC-31-05

| Item | Content |
|---|---|
| Test Case ID | TC-31-05 |
| Test Scenario | [Boundary] AC 4: periods that only touch at an endpoint don't overlap, so each is accepted |
| Pre-conditions | An equipment type with exactly 1 unit and no reservations. |
| Test Steps | 1. Reserve the unit for the middle period. <br> 2. Reserve it for the period ending exactly when the middle one starts. <br> 3. Reserve it for the period starting exactly when the middle one ends. |
| Test Data | Pool: 1 unit <br> Middle: 2031-03-02 09:00–12:00 <br> Before: 2031-03-02 06:00–09:00 <br> After: 2031-03-02 12:00–15:00 <br> Quantity: 1 each |
| Expected Result | All three reservations are confirmed, and the unit is never counted twice. A fourth reservation from 11:59 to 12:30, which does overlap, is refused as 1 short. |

**Automated by:** `tests/integration/concurrency.test.ts` › "accepts reservations that touch at an endpoint — periods sharing an endpoint do not overlap (SCRUM-31)" (real Postgres); `tests/unit/reservation.test.ts` › "AC 4: overlap is half-open — a period that only touches another does not count against it". The overlapping fourth reservation is **Manual**.

### TC-31-06

| Item | Content |
|---|---|
| Test Case ID | TC-31-06 |
| Test Scenario | [Concurrency] AC 5: two Technical Support staff reserve the last unit at the same moment, and only one succeeds |
| Pre-conditions | An equipment type with exactly 1 unit available for the period. Two Technical Support sessions. |
| Test Steps | 1. In both sessions, fill the same reservation. <br> 2. Click **Confirm reservation** in both at the same moment. <br> 3. Check availability for the period. |
| Test Data | Pool: 1 unit <br> Period: 2031-03-01 09:00–13:00 <br> Quantity: 1 in each session |
| Expected Result | Exactly one session shows "Reservation confirmed"; the other is refused as 1 short. The total reserved for the period is 1, never 2. |

**Automated by:** `tests/integration/concurrency.test.ts` › "does not over-allocate equipment when two staff reserve the last unit (SCRUM-31)" (real Postgres, simultaneous calls); `tests/unit/reservation.test.ts` › "AC 5: the equipment row is locked before availability is counted"

### TC-31-07

| Item | Content |
|---|---|
| Test Case ID | TC-31-07 |
| Test Scenario | [Negative] [Boundary] AC 6: a quantity of zero, a negative number, a fraction or a blank is reported invalid, and nothing is created |
| Pre-conditions | As TC-31-01. |
| Test Steps | 1. Fill the reservation with a valid event, equipment type and period. <br> 2. Enter one of the quantities below and click **Confirm reservation**. <br> 3. Repeat for each quantity. |
| Test Data | Equipment type: Lectern <br> Period: 2031-05-10 09:00–17:00 <br> Quantities: 0, -1, 1.5, blank |
| Expected Result | Each attempt shows "Please fix the reservation details." and an inline error message appears below the Quantity input. No reservation is created and availability is unchanged. |

**Automated by:** `tests/unit/reservation.test.ts` › "AC 6: quantity %s is reported invalid and nothing is created" (0, -1, 1.5, blank); `e2e/equipment.spec.ts` › "AC 6: a quantity of zero is refused"

### TC-31-08

| Item | Content |
|---|---|
| Test Case ID | TC-31-08 |
| Test Scenario | [Positive] AC 7: availability deducts confirmed reservations and maintenance holds from the pool |
| Pre-conditions | Seeded data: Projector has 10 units, and the maintenance hold `eun_projector_repair` takes 3 of them for its period. |
| Test Steps | 1. Choose Projector and a period inside the maintenance hold. <br> 2. Click **Check availability** and note the number. <br> 3. Reserve 2 Projectors for that period. <br> 4. Click **Check availability** again. |
| Test Data | Equipment type: Projector (10 total) <br> Period: inside `eun_projector_repair` (see `prisma/seed.ts`) <br> Step 3 quantity: 2 |
| Expected Result | Step 2 shows 10 − 3 (maintenance) − any overlapping confirmed reservations. Step 4 shows exactly 2 fewer. Cancelled reservations are not deducted. |

**Automated by:** `tests/unit/reservation.test.ts` › "AC 7: deducts confirmed reservations and maintenance from the pool" (pool 10, 3 reserved, 2 in maintenance, 5 available)

### TC-31-09

| Item | Content |
|---|---|
| Test Case ID | TC-31-09 |
| Test Scenario | [Negative] [Boundary] a period whose end isn't after its start is refused before anything is counted |
| Pre-conditions | As TC-31-01. |
| Test Steps | 1. Fill the reservation with the period below. <br> 2. Click **Confirm reservation**. |
| Test Data | Equipment type: Lectern <br> Quantity: 1 <br> Case A (zero length): Start 2031-05-10 09:00, End 2031-05-10 09:00 <br> Case B (reversed): Start 2031-05-10 17:00, End 2031-05-10 09:00 |
| Expected Result | Both cases are refused with End reported as invalid via an inline error message below the End field. No reservation is created. |

**Automated by:** `tests/unit/reservation.test.ts` › "refuses a period whose end is not after its start" (reserve, case A). Case B, and both cases on **Check availability**, are **Manual**.

### TC-31-10

| Item | Content |
|---|---|
| Test Case ID | TC-31-10 |
| Test Scenario | [Negative] equipment can only be reserved for an APPROVED event |
| Pre-conditions | Signed in as Technical Support. A seeded event in DRAFT, SUBMITTED or REJECTED status exists. |
| Test Steps | 1. Submit a reservation for the non-approved event's ID (it isn't offered in the event list, so send it directly). |
| Test Data | Event: any seeded event not in APPROVED status <br> Equipment type: Lectern <br> Period: 2031-05-10 09:00–17:00 <br> Quantity: 1 |
| Expected Result | "Reservations can only be made for an approved event." No reservation is created. |

**Automated by:** `tests/unit/reservation.test.ts` › "only reserves for an approved event"

### TC-31-11

| Item | Content |
|---|---|
| Test Case ID | TC-31-11 |
| Test Scenario | [Negative] only Technical Support can reserve equipment, and a role without equipment access can't check availability |
| Pre-conditions | Seeded users for each role. |
| Test Steps | 1. Sign in as each role below. <br> 2. Try to reserve equipment (by calling the action directly if the page is hidden). <br> 3. As Attendee, try to check equipment availability. |
| Test Data | Roles: ORGANISER, COORDINATOR, VENUE_STAFF, ATTENDEE (seeded `@test.local` accounts, password `Password123!`) <br> Equipment type: Lectern <br> Quantity: 1 |
| Expected Result | Each reservation attempt is refused with a permission message, and nothing is written. Attendee's availability check is refused without reading the equipment. |

**Automated by:** `tests/unit/reservation.test.ts` › "refuses %s and never opens a transaction" (all four roles), "refuses a role without equipment:read"
