# SCRUM-29 — Check equipment availability: test cases

Story and acceptance criteria: [docs/backlog/SCRUM-29.md](../backlog/SCRUM-29.md).
Format and conventions: [README.md](README.md). Availability is
`getEquipmentAvailability` and `getAllEquipmentAvailability` in
[app/(app)/equipment/actions.ts](<../../app/(app)/equipment/actions.ts>),
weighed by `summariseAvailability` in
[lib/equipment/availability.ts](../../lib/equipment/availability.ts): the
answer is the busiest instant in the period, not the total of everything that
touches it.

Written on 2026-10-12 from the acceptance criteria, then mapped to the tests
that already existed (SCRUM-176). The tests predate the `SCRUM-n [ACx] TC-n-xx`
title format, so each case names them by their current titles. TC-29-08 and
the `e2e/equipment-availability.spec.ts` tests were added on 2026-10-13, so
that every e2e test is named by a case.

**AC 2 was overtaken.** Since SCRUM-156 the one-type form only checks
availability. Equipment is reserved from an approved request in one step
(SCRUM-155), and that path refuses a quantity that doesn't fit (TC-29-02,
TC-29-03).

**Shared pre-conditions for every case:** the database is migrated and seeded
and the app is running. Signed in as `techsupport@test.local`
(`Password123!`), on **Equipment**. The pools of 4 below are test equipment
types the tests build, so seeded commitments can't change the answer; the
seed's own projector pool has 10, with 3 in for maintenance.

| ID | Type | Criterion | Automated |
|---|---|---|---|
| [TC-29-01](#tc-29-01) | Positive | AC 1, AC 4 | Unit, integration, e2e |
| [TC-29-02](#tc-29-02) | Boundary | AC 2 | Unit, integration, e2e |
| [TC-29-03](#tc-29-03) | Negative | AC 3 | Unit, integration, e2e |
| [TC-29-04](#tc-29-04) | Boundary | AC 5 | Unit, integration, e2e |
| [TC-29-05](#tc-29-05) | Positive | AC 6 | Unit, integration, e2e |
| [TC-29-06](#tc-29-06) | Negative | AC 7 | Unit, integration, e2e |
| [TC-29-07](#tc-29-07) | Negative | AC 1 | Unit |
| [TC-29-08](#tc-29-08) | Negative | Validation beyond the ACs | e2e |

---

### TC-29-01

| Item | Content |
|---|---|
| Test Case ID | TC-29-01 |
| Test Scenario | [Positive] AC 1, AC 4: the check shows how many are free for the whole period, counting only reservations |
| Pre-conditions | 2 projectors are reserved for part of the period, and an approved request for 1 more isn't reserved yet. |
| Test Steps | 1. Choose **Equipment type** "Projector", a start and end date and time, and **Quantity** 1. |
| Test Data | 10 May 2031, 09:00 to 17:00 SGT |
| Expected Result | "2 of 4 available": the busiest moment in the period has 2 reserved. The unreserved request takes nothing, and neither does a cancelled reservation. |

**Automated by:** `tests/integration/equipment-availability.test.ts` › "SCRUM-29 [AC1, AC4] TC-29-01: reports the busiest instant, not the sum of everything touching the period", "SCRUM-29 [AC1, AC4] TC-29-01: does not count a cancelled reservation against the pool", "SCRUM-29 [AC1, AC4] TC-29-01: gives the same answer for the pool in the all-equipment view"; `tests/unit/equipment-availability.test.ts` › "SCRUM-29 [AC1, AC4] TC-29-01: finds a peak that starts partway through the window", "SCRUM-29 [AC1, AC4] TC-29-01: adds commitments that genuinely share an instant"; `tests/unit/reservation.test.ts` › "SCRUM-31 [AC7] TC-31-08: deducts confirmed reservations and maintenance from the pool"; `e2e/equipment.spec.ts` › "SCRUM-156 [AC1] TC-156-01: checks a type and period without choosing an event, and offers no way to reserve"; `e2e/equipment-availability.spec.ts` › "SCRUM-29 [AC1] TC-29-01: shows the free quantity for the period, from the busiest instant", "SCRUM-29 [AC4] TC-29-01: equipment reserved for an overlapping period is excluded"

### TC-29-02

| Item | Content |
|---|---|
| Test Case ID | TC-29-02 |
| Test Scenario | [Boundary] AC 2: exactly the free quantity is available |
| Pre-conditions | 2 projectors are free for the period. |
| Test Steps | 1. Check a quantity of 2. <br> 2. Reserve 2 from an approved request for that period. |
| Test Data | Quantity 2 |
| Expected Result | Step 1 reports them available with no shortfall. Step 2 is accepted. |

**Automated by:** `tests/unit/equipment-availability.test.ts` › "SCRUM-29 [AC2] TC-29-02: accepts a quantity at the limit and reports no shortfall"; `tests/integration/equipment-availability.test.ts` › "SCRUM-29 [AC2] TC-29-02: a quantity that fits the whole period is accepted by the locked reservation path"; `e2e/equipment-availability.spec.ts` › "SCRUM-29 [AC2] TC-29-02: a quantity that fits is reported available" (step 1, with 1 unit free and 1 asked for)

### TC-29-03

| Item | Content |
|---|---|
| Test Case ID | TC-29-03 |
| Test Scenario | [Negative] AC 3: more than are free shows the shortfall, and can't be reserved |
| Pre-conditions | 2 projectors are free for the period. |
| Test Steps | 1. Check a quantity of 3. <br> 2. Reserve 3 for that period. |
| Test Data | Quantity 3 |
| Expected Result | Step 1 shows the shortfall at once ("1 short"). Step 2 is refused with the shortfall, and nothing is written. |

**Automated by:** `tests/unit/equipment-availability.test.ts` › "SCRUM-29 [AC3] TC-29-03: refuses a quantity over the limit and states how many short"; `tests/integration/equipment-availability.test.ts` › "SCRUM-29 [AC3] TC-29-03: a quantity over the free units is refused with the shortfall, and nothing is written"; `e2e/equipment.spec.ts` › "SCRUM-29 [AC3] TC-29-03: more than the pool shows the shortfall live"; `e2e/equipment-availability.spec.ts` › "SCRUM-29 [AC3] TC-29-03: a quantity over the free units reports the shortfall"

### TC-29-04

| Item | Content |
|---|---|
| Test Case ID | TC-29-04 |
| Test Scenario | [Boundary] AC 5: a reservation that only touches the period doesn't count |
| Pre-conditions | A reservation of all 4 projectors ending at 09:00. |
| Test Steps | 1. Check a period starting at 09:00. <br> 2. Check one starting at 08:59. |
| Test Data | The reservation above |
| Expected Result | Step 1: all 4 are free. Step 2: none are free, since one minute is shared. |

**Automated by:** `tests/unit/equipment-availability.test.ts` › "SCRUM-29 [AC5] TC-29-04: does not treat periods that touch at an endpoint as overlapping", "SCRUM-29 [AC5] TC-29-04: treats any shared instant as an overlap, in either order", "SCRUM-29 [AC5] TC-29-04: frees a reservation that ends exactly when the requested period starts", "SCRUM-29 [AC5] TC-29-04: counts back-to-back commitments once, not twice"; `tests/integration/equipment-availability.test.ts` › "SCRUM-29 [AC5] TC-29-04: a reservation ending exactly when the period starts leaves the whole pool free"; `e2e/equipment-availability.spec.ts` › "SCRUM-29 [AC5] TC-29-04: a reservation that ends exactly when the period begins leaves the pool free" (step 1, with one reservation ending as the period starts and another starting as it ends)

### TC-29-05

| Item | Content |
|---|---|
| Test Case ID | TC-29-05 |
| Test Scenario | [Positive] AC 6: units under maintenance or damaged aren't available |
| Pre-conditions | The seed's maintenance and damage records overlap the period. |
| Test Steps | 1. Check the affected type for that period. |
| Test Data | The seeded records |
| Expected Result | Those units are left out of the free quantity, together with any reservations at the same moment. The pool never shows below zero. |

**Automated by:** `tests/integration/equipment-availability.test.ts` › "SCRUM-29 [AC6] TC-29-05: units under maintenance or damaged are not available"; `tests/unit/equipment-availability.test.ts` › "SCRUM-29 [AC6] TC-29-05: weighs reservations and unavailability together at the same instant", "SCRUM-29 [AC6] TC-29-05: never reports a negative pool when more is committed than exists"; `e2e/equipment-availability.spec.ts` › "SCRUM-29 [AC6] TC-29-05: units under maintenance or damaged are not shown as available"

### TC-29-06

| Item | Content |
|---|---|
| Test Case ID | TC-29-06 |
| Test Scenario | [Negative] AC 7: a quantity of zero or an end not after the start is rejected, with no result |
| Pre-conditions | On **Equipment**. |
| Test Steps | 1. Enter **Quantity** 0. <br> 2. Enter an end earlier than the start. |
| Test Data | Quantity 0; start 17:00, end 09:00 on the same day |
| Expected Result | Step 1: "Enter a whole number of at least 1.", with no availability figure (SCRUM-229); a decimal such as 1.5 gets the same. Step 2: "End time must be after the start time." at once. No availability is shown, and nothing is read or written. |

**Automated by:** `tests/unit/equipment-availability.test.ts` › "SCRUM-229 [AC1], SCRUM-29 [AC7] TC-29-06: %j is not a positive whole number, so no result is shown for it", "SCRUM-229 [AC2], SCRUM-29 [AC7] TC-29-06: %j is a quantity of %i"; `tests/unit/reservation.test.ts` › "SCRUM-29 [AC7] TC-29-06: rejects an end before the start with field errors and reads nothing"; `tests/integration/equipment-availability.test.ts` › "SCRUM-29 [AC7] TC-29-06: an end before the start is rejected, reads nothing and writes nothing"; `e2e/equipment.spec.ts` › "SCRUM-29 [AC7] TC-29-06, SCRUM-31 [AC6] TC-31-07: a quantity of zero asks for a whole number of at least one", "SCRUM-29 [AC7] TC-29-06: an invalid period (end earlier than start) triggers a live inline error"; `e2e/equipment-availability.spec.ts` › "SCRUM-29 [AC7] TC-29-06, SCRUM-229 [AC1]: a zero or decimal quantity, or an end before the start, is rejected with no result"

### TC-29-07

| Item | Content |
|---|---|
| Test Case ID | TC-29-07 |
| Test Scenario | [Negative] AC 1: a retired type, or a role without access, gets no count |
| Pre-conditions | A retired equipment type; signed in as an Organiser. |
| Test Steps | 1. Check the retired type. <br> 2. As the Organiser, ask for availability directly. |
| Test Data | The retired type's id |
| Expected Result | Step 1 reports the type as unknown, not a count. Step 2 is refused. |

**Automated by:** `tests/unit/reservation.test.ts` › "SCRUM-29 [AC1] TC-29-07: reports an unknown or retired equipment type rather than a count", "SCRUM-31 TC-31-11: refuses a role without equipment:read"

### TC-29-08

| Item | Content |
|---|---|
| Test Case ID | TC-29-08 |
| Test Scenario | [Negative] Validation beyond the ACs: a period that starts in the past is rejected, with no result |
| Pre-conditions | On **Equipment**. No criterion asks for this: AC 7 names only a zero quantity and an end not after the start. The check also refuses a start in the past, in the same way. |
| Test Steps | 1. Choose **Equipment type** "Lectern". <br> 2. Enter a start and end on a day that has passed. |
| Test Data | 1 Jan 2020, 09:00 to 17:00 SGT |
| Expected Result | "Start time cannot be in the past." at once, and the count reads "— of 4 available": no availability is shown. |

**Automated by:** `e2e/equipment.spec.ts` › "SCRUM-29 TC-29-08: a start time in the past triggers a live inline error and no availability"
