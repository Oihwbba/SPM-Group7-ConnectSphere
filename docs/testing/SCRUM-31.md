# SCRUM-31 — Reserve Equipment for Event: test cases

Story and acceptance criteria: [docs/backlog/SCRUM-31.md](../backlog/SCRUM-31.md).
Format and conventions: [README.md](README.md).

> **Reserving moved to SCRUM-155's card (SCRUM-156, 5 Oct 2026).** The
> one-type form now only checks availability, and `createReservation` is gone,
> so the reserve steps below no longer apply to that form. The same guarantees
> are tested through reserving an approved request:
>
> | SCRUM-31 case | Now covered by |
> |---|---|
> | TC-31-01, -02, -04 | [TC-155-04](SCRUM-155.md#tc-155-04) |
> | TC-31-03 | [TC-155-05](SCRUM-155.md#tc-155-05); the live shortfall in `e2e/equipment.spec.ts` › "SCRUM-29 AC 3: …" |
> | TC-31-05, -06 | `tests/integration/concurrency.test.ts` › "concurrency — equipment pool (SCRUM-31)", now reserving approved requests |
> | TC-31-07, -09 | [TC-155-09](SCRUM-155.md#tc-155-09) |
> | TC-31-08 | unchanged: `tests/unit/reservation.test.ts` › "SCRUM-31 [AC7] TC-31-08: deducts confirmed reservations and maintenance from the pool" |
> | TC-31-10 | [TC-155-10](SCRUM-155.md#tc-155-10); `tests/integration/equipment-availability.test.ts` › "SCRUM-31, SCRUM-81 TC-31-10, TC-81-12: reserves for a Planning event, and refuses a Confirmed one without writing" |
> | TC-31-11 | `tests/unit/request-reservation.test.ts` (roles without `equipment:reserve` are refused) |

**Shared pre-conditions for every case:** the database is migrated and seeded
(`npm run db:deploy && npm run db:seed`), the app is running, and the tester
signs in as Technical Support (`techsupport@test.local` / `Password123!`)
unless the case says otherwise. Cases use a far-future period so seeded
reservations and maintenance holds don't overlap it, except TC-31-08, which
needs them.

| ID | Type | Criterion | Automated |
|---|---|---|---|
| [TC-31-01](#tc-31-01) | Positive | AC 1, AC 7 | Unit, e2e |
| [TC-31-02](#tc-31-02) | Positive | AC 2 | Unit, integration |
| [TC-31-03](#tc-31-03) | Negative | AC 3 | Unit, integration |
| [TC-31-04](#tc-31-04) | Boundary | AC 1, AC 3 | Unit, integration |
| [TC-31-05](#tc-31-05) | Boundary | AC 4 | Unit, integration |
| [TC-31-06](#tc-31-06) | Concurrency | AC 5 | Unit, integration |
| [TC-31-07](#tc-31-07) | Negative, Boundary | AC 6 | Unit, e2e |
| [TC-31-08](#tc-31-08) | Positive | AC 7 | Unit |
| [TC-31-09](#tc-31-09) | Negative, Boundary | Valid period | Unit, e2e (SCRUM-155's) |
| [TC-31-10](#tc-31-10) | Positive, Negative | Approved and Planning events only | Unit, integration |
| [TC-31-11](#tc-31-11) | Negative | Technical Support only | Unit |

---

### TC-31-01

| Item | Content |
|---|---|
| Test Case ID | TC-31-01 |
| Test Scenario | [Positive] AC 1, AC 7: a quantity within availability is reserved as Confirmed, and availability drops by exactly that quantity |
| Pre-conditions | Signed in as Technical Support. The event "Approved — Research Symposium" is APPROVED. No reservation or maintenance hold overlaps the test period for Lectern. |
| Test Steps | Superseded by [TC-155-04](SCRUM-155.md#tc-155-04). SCRUM-156 moved reserving from the one-type form to the "Reserve an approved request" card, so follow that case's steps; this case's intent (the scenario above) is unchanged. |
| Test Data | As in TC-155-04. |
| Expected Result | As in TC-155-04. |

**Automated by:** `tests/unit/request-reservation.test.ts` › "SCRUM-155 [AC3] TC-155-04: rows that all fit are reserved together, each Confirmed and linked to the event and the request"; `tests/integration/request-reservation.test.ts` › "SCRUM-155 [AC3] TC-155-04: reserves every row together, Confirmed and linked to the event and the request"; `e2e/request-reservation.spec.ts` › "SCRUM-155 [AC3, AC6] TC-155-04, TC-155-06: …"

### TC-31-02

| Item | Content |
|---|---|
| Test Case ID | TC-31-02 |
| Test Scenario | [Positive] AC 2: a reservation is permanently linked to the event it was made for |
| Pre-conditions | As TC-31-01. |
| Test Steps | 1. Reserve 1 Lectern for the approved event, as in TC-31-01. <br> 2. Look up the new reservation in the database (or the event's reservations). |
| Test Data | Event ID: `evt_approved` (Approved — Research Symposium) <br> Equipment type: Lectern <br> Start: 2031-05-11 09:00 <br> End: 2031-05-11 17:00 <br> Quantity: 1 |
| Expected Result | The reservation's `eventId` is `evt_approved`, `reservedById` is the Technical Support user, and the reservation offers no way to move it to another event. |

**Automated by:** `tests/unit/request-reservation.test.ts` › "SCRUM-155 [AC3] TC-155-04: rows that all fit are reserved together, each Confirmed and linked to the event and the request"; `tests/integration/request-reservation.test.ts` › "SCRUM-155 [AC3] TC-155-04: reserves every row together, Confirmed and linked to the event and the request"

### TC-31-03

| Item | Content |
|---|---|
| Test Case ID | TC-31-03 |
| Test Scenario | [Negative] AC 3: a quantity above availability is refused, and the shortfall is shown |
| Pre-conditions | As TC-31-01. |
| Test Steps | Superseded by [TC-155-05](SCRUM-155.md#tc-155-05). SCRUM-156 moved reserving from the one-type form to the "Reserve an approved request" card, so follow that case's steps; this case's intent (the scenario above) is unchanged. |
| Test Data | As in TC-155-05. |
| Expected Result | As in TC-155-05. |

**Automated by:** `tests/unit/request-reservation.test.ts` › "SCRUM-155 [AC4] TC-155-05: one short row reserves nothing, and only that row reports what is free and the shortfall"; `tests/integration/request-reservation.test.ts` › "SCRUM-155 [AC4] TC-155-05: when one row is short, nothing is reserved — not even the rows that fit"

### TC-31-04

| Item | Content |
|---|---|
| Test Case ID | TC-31-04 |
| Test Scenario | [Boundary] AC 1, AC 3: reserving exactly every available unit succeeds, and one more unit is refused |
| Pre-conditions | As TC-31-01, with all 4 Lecterns available for the period. |
| Test Steps | Superseded by [TC-155-04](SCRUM-155.md#tc-155-04). SCRUM-156 moved reserving from the one-type form to the "Reserve an approved request" card, so follow that case's steps; this case's intent (the scenario above) is unchanged. |
| Test Data | As in TC-155-04. |
| Expected Result | As in TC-155-04. |

**Automated by:** `tests/unit/request-reservation.test.ts` › "SCRUM-155 [AC3] TC-155-04: rows that all fit are reserved together, each Confirmed and linked to the event and the request"; `tests/integration/request-reservation.test.ts` › "SCRUM-155 [AC3] TC-155-04: …". One unit more is refused by `tests/integration/request-reservation.test.ts` › "SCRUM-155 [AC4] TC-155-05: when one row is short, nothing is reserved — not even the rows that fit".

### TC-31-05

| Item | Content |
|---|---|
| Test Case ID | TC-31-05 |
| Test Scenario | [Boundary] AC 4: periods that only touch at an endpoint don't overlap, so each is accepted |
| Pre-conditions | An equipment type with exactly 1 unit and no reservations. |
| Test Steps | 1. Reserve the unit for the middle period. <br> 2. Reserve it for the period ending exactly when the middle one starts. <br> 3. Reserve it for the period starting exactly when the middle one ends. |
| Test Data | Pool: 1 unit <br> Middle: 2031-03-02 09:00–12:00 <br> Before: 2031-03-02 06:00–09:00 <br> After: 2031-03-02 12:00–15:00 <br> Quantity: 1 each |
| Expected Result | All three reservations are confirmed, and the unit is never counted twice. A fourth reservation from 11:59 to 12:30, which does overlap, is refused as 1 short. |

**Automated by:** `tests/integration/concurrency.test.ts` › "SCRUM-31 [AC4] TC-31-05: accepts reservations that touch at an endpoint — periods sharing an endpoint do not overlap" (real Postgres); `tests/unit/reservation.test.ts` › "SCRUM-31 [AC4] TC-31-05: overlap is half-open — a period that only touches another does not count against it". The overlapping fourth reservation is refused in the same integration test.

### TC-31-06

| Item | Content |
|---|---|
| Test Case ID | TC-31-06 |
| Test Scenario | [Concurrency] AC 5: two Technical Support staff reserve the last unit at the same moment, and only one succeeds |
| Pre-conditions | An equipment type with exactly 1 unit available for the period. Two Technical Support sessions. |
| Test Steps | Superseded by the equipment-pool cases in `tests/integration/concurrency.test.ts`. SCRUM-156 moved reserving from the one-type form to the "Reserve an approved request" card, so follow that case's steps; this case's intent (the scenario above) is unchanged. |
| Test Data | As in the equipment-pool cases in `tests/integration/concurrency.test.ts`. |
| Expected Result | As in the equipment-pool cases in `tests/integration/concurrency.test.ts`. |

**Automated by:** `tests/integration/concurrency.test.ts` › the SCRUM-31 pool-race test, now reserving approved requests; `tests/unit/request-reservation.test.ts` › "SCRUM-155 [AC5] TC-155-08, TC-155-15: locks the event, then the request, then the equipment rows in id order, before reading or counting anything"

### TC-31-07

| Item | Content |
|---|---|
| Test Case ID | TC-31-07 |
| Test Scenario | [Negative] [Boundary] AC 6: a quantity of zero, a negative number, a fraction or a blank is reported invalid, and nothing is created |
| Pre-conditions | As TC-31-01. |
| Test Steps | Superseded by [TC-155-09](SCRUM-155.md#tc-155-09). SCRUM-156 moved reserving from the one-type form to the "Reserve an approved request" card, so follow that case's steps; this case's intent (the scenario above) is unchanged. |
| Test Data | As in TC-155-09. |
| Expected Result | As in TC-155-09. |

**Automated by:** `tests/unit/request-reservation.test.ts` › "SCRUM-155 [AC7] TC-155-09: invalid rows or periods reserve nothing and say where the problem is"; `e2e/equipment.spec.ts` › "SCRUM-29 [AC7] TC-29-06, SCRUM-31 [AC6] TC-31-07: a quantity of zero asks for at least one"

### TC-31-08

| Item | Content |
|---|---|
| Test Case ID | TC-31-08 |
| Test Scenario | [Positive] AC 7: availability deducts confirmed reservations and maintenance holds from the pool |
| Pre-conditions | Seeded data: Projector has 10 units, and the maintenance hold `eun_projector_repair` takes 3 of them for its period. |
| Test Steps | 1. On **Equipment**, choose Projector and a period inside the maintenance hold. <br> 2. Note the number the live availability table shows. <br> 3. Reserve an approved request for 2 Projectors over that period (SCRUM-155). <br> 4. Read the live table again. |
| Test Data | Equipment type: Projector (10 total) <br> Period: inside `eun_projector_repair` (see `prisma/seed.ts`) <br> Step 3 quantity: 2 |
| Expected Result | Step 2 shows 10 − 3 (maintenance) − any overlapping confirmed reservations. Step 4 shows exactly 2 fewer. Cancelled reservations are not deducted. |

**Automated by:** `tests/unit/reservation.test.ts` › "SCRUM-31 [AC7] TC-31-08: deducts confirmed reservations and maintenance from the pool" (pool 10, 3 reserved, 2 in maintenance, 5 available)

### TC-31-09

| Item | Content |
|---|---|
| Test Case ID | TC-31-09 |
| Test Scenario | [Negative] [Boundary] a period whose end isn't after its start is refused before anything is counted |
| Pre-conditions | As TC-31-01. |
| Test Steps | Superseded by [TC-155-09](SCRUM-155.md#tc-155-09). SCRUM-156 moved reserving from the one-type form to the "Reserve an approved request" card, so follow that case's steps; this case's intent (the scenario above) is unchanged. |
| Test Data | As in TC-155-09. |
| Expected Result | As in TC-155-09. |

**Automated by:** `tests/unit/reservation.test.ts` › "SCRUM-31 TC-31-09: refuses a period whose end is not after its start" (case A); `tests/unit/request-reservation.test.ts` › "SCRUM-155 [AC7] TC-155-09: …" (an end at or before the start, on the form that replaced the one-type one); `e2e/request-reservation.spec.ts` › "SCRUM-155 [AC7] TC-155-09: a cleared start or end reserves nothing and says so at the field". The live availability table is availability-only since SCRUM-156, so it reserves nothing.

### TC-31-10

| Item | Content |
|---|---|
| Test Case ID | TC-31-10 |
| Test Scenario | [Positive, Negative] equipment can be reserved for an APPROVED or PLANNING event, and no other |
| Pre-conditions | Signed in as Technical Support. The seeded events "Planning — Freshman Orientation" (PLANNING) and "Confirmed — Charity Gala" (CONFIRMED) exist. |
| Test Steps | Superseded by [TC-155-10](SCRUM-155.md#tc-155-10). SCRUM-156 moved reserving from the one-type form to the "Reserve an approved request" card, so follow that case's steps; this case's intent (the scenario above) is unchanged. |
| Test Data | As in TC-155-10. |
| Expected Result | As in TC-155-10. |

**Automated by:** `tests/unit/equipment-request-queries.test.ts` › "SCRUM-27 [AC1] TC-27-01: stock can be reserved for exactly the events that can take a request"; `tests/integration/equipment-availability.test.ts` › "SCRUM-31, SCRUM-81 TC-31-10, TC-81-12: reserves for a Planning event, and refuses a Confirmed one without writing"; `tests/integration/request-reservation.test.ts` › "SCRUM-155 [AC1] TC-155-10: …"

### TC-31-11

| Item | Content |
|---|---|
| Test Case ID | TC-31-11 |
| Test Scenario | [Negative] only Technical Support can reserve equipment, and a role without equipment access can't check availability |
| Pre-conditions | Seeded users for each role. |
| Test Steps | 1. Sign in as each role below. <br> 2. Try to reserve equipment (by calling the action directly if the page is hidden). <br> 3. As Attendee, try to check equipment availability. |
| Test Data | Roles: ORGANISER, COORDINATOR, VENUE_STAFF, ATTENDEE (seeded `@test.local` accounts, password `Password123!`) <br> Equipment type: Lectern <br> Quantity: 1 |
| Expected Result | Each reservation attempt is refused with a permission message, and nothing is written. Attendee's availability check is refused without reading the equipment. |

**Automated by:** `tests/unit/request-reservation.test.ts` › "refuses a role without equipment:reserve before reading anything"; `tests/unit/reservation.test.ts` › "refuses a role without equipment:read"
