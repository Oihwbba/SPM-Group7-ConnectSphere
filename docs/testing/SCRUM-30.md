# SCRUM-30 — View equipment conflicts: test cases

Story and acceptance criteria: [docs/backlog/SCRUM-30.md](../backlog/SCRUM-30.md).
Format and conventions: [README.md](README.md). A type's commitments come from
`getEquipmentSchedule` in
[app/(app)/equipment/actions.ts](<../../app/(app)/equipment/actions.ts>); they
are split by the requested period, and coloured, by the rules in
[lib/equipment/availability.ts](../../lib/equipment/availability.ts), the same
rules availability is computed from (SCRUM-29).

Written on 2026-10-12 from the acceptance criteria, then mapped to the tests
that already existed (SCRUM-176). The tests predate the `SCRUM-n [ACx] TC-n-xx`
title format, so each case names them by their current titles. Three more
e2e tests were named under TC-30-02 and TC-30-07 on 2026-10-13, so that every
e2e test is named by a case.

**Shared pre-conditions for every case:** the database is migrated and seeded
and the app is running. Signed in as `techsupport@test.local`
(`Password123!`), on **Equipment**, with a type chosen in **Equipment type**.

| ID | Type | Criterion | Automated |
|---|---|---|---|
| [TC-30-01](#tc-30-01) | Positive | AC 1 | Unit, integration, e2e |
| [TC-30-02](#tc-30-02) | Positive | AC 2 | Unit, integration, e2e |
| [TC-30-03](#tc-30-03) | Boundary | AC 3, AC 4 | Unit, integration, e2e |
| [TC-30-04](#tc-30-04) | Boundary | AC 2, AC 5 | Unit, integration, e2e |
| [TC-30-05](#tc-30-05) | Positive | AC 6 | Unit, integration, e2e |
| [TC-30-06](#tc-30-06) | Boundary | AC 7 | Unit, integration, e2e |
| [TC-30-07](#tc-30-07) | Negative | AC 1 | Unit, e2e |

---

### TC-30-01

| Item | Content |
|---|---|
| Test Case ID | TC-30-01 |
| Test Scenario | [Positive] AC 1: a type's current and future commitments are listed, with the event each one serves |
| Pre-conditions | The type has a finished reservation, two upcoming ones (overlapping each other) and recorded maintenance. |
| Test Steps | 1. Choose the type. <br> 2. Reserve more of it from a request card. |
| Test Data | The seeded projector pool |
| Expected Result | The upcoming reservations, with their events, and the maintenance are listed in time order, each with its period and quantity; the finished one isn't. Overlapping reservations are listed as they are, without a verdict. The new reservation appears without a reload. |

**Automated by:** `tests/unit/equipment-schedule.test.ts` › "SCRUM-30 [AC1]: lists current and future reservations with the event they serve", "SCRUM-30 [AC1]: reports overlapping reservations as they stand, without judging them", "returns entries in chronological order, reservations and repairs together"; `tests/integration/equipment-schedule.test.ts` › "SCRUM-30 [AC1]: lists current and future commitments with the event name, and drops finished ones"; `e2e/equipment.spec.ts` › "SCRUM-30 [AC1]: the seeded maintenance on the projector pool is listed", "SCRUM-30 [AC1] TC-30-01, SCRUM-156 [AC6] TC-156-06: a reservation made in the request card appears in the commitments without a reload"

### TC-30-02

| Item | Content |
|---|---|
| Test Case ID | TC-30-02 |
| Test Scenario | [Positive] AC 2: commitments that overlap the requested period are listed under it, and the rest apart |
| Pre-conditions | The type has commitments inside and outside a period. |
| Test Steps | 1. Enter a period and a quantity. |
| Test Data | 10 May 2031, 09:00 to 17:00 SGT |
| Expected Result | The overlapping ones are under "Commitments during requested period", below the chosen type. The rest are under "Other commitments", even ones that overlap each other, and don't reduce the period's availability. |

**Automated by:** `tests/unit/equipment-availability.test.ts` › "SCRUM-30 [AC2]: puts commitments that share time with the requested period under it", "SCRUM-30 [AC2]: commitments wholly outside the period are other commitments, even if they overlap each other", "splits on the same rule the requested-period availability is computed from"; `tests/integration/equipment-schedule.test.ts` › "SCRUM-30 [AC2]: other commitments, even ones that overlap each other, do not reduce the requested period's availability"; `e2e/equipment.spec.ts` › "SCRUM-30 [AC1, AC2]: commitments overlapping the requested period are listed under it, the rest under other commitments", "SCRUM-30 [AC2] TC-30-02: the requested-period section sits under the selected item, and other commitments below the other equipment", "SCRUM-30 [AC2] TC-30-02: other commitments stay neutral even when they overlap each other"

### TC-30-03

| Item | Content |
|---|---|
| Test Case ID | TC-30-03 |
| Test Scenario | [Boundary] AC 3, AC 4: overlapping commitments are amber while the quantity still fits, and red with the shortfall once it doesn't |
| Pre-conditions | 2 of 4 units are committed during the period. |
| Test Steps | 1. Enter a quantity of 2. <br> 2. Change it to 3. |
| Test Data | Quantities 2 and 3 |
| Expected Result | At 2 the commitments are amber: they affect availability but aren't a conflict. At 3 they turn red, with the shortfall: 1 short. |

**Automated by:** `tests/unit/equipment-availability.test.ts` › "SCRUM-30 [AC3]: amber while the requested quantity can still be fulfilled", "SCRUM-30 [AC4]: red only when the requested quantity exceeds what is free", "agrees with checkQuantity at the boundary: exactly the free quantity is amber, one more is red"; `tests/integration/equipment-schedule.test.ts` › "SCRUM-30 [AC3]: commitments during the period are amber while the request still fits", "SCRUM-30 [AC4]: they turn red, with the shortfall, once the request exceeds what is free"; `e2e/equipment.spec.ts` › "SCRUM-30 [AC3]: commitments during the period are amber while the requested quantity can still be fulfilled", "SCRUM-30 [AC4]: they turn red with the shortfall only when the requested quantity exceeds what is free"

### TC-30-04

| Item | Content |
|---|---|
| Test Case ID | TC-30-04 |
| Test Scenario | [Boundary] AC 2, AC 5: commitments that only touch the period or each other are not conflicts |
| Pre-conditions | One reservation ends at 09:00 and the next starts at 09:00; the period starts at 09:00. |
| Test Steps | 1. Choose the type and enter the period. |
| Test Data | The reservations above |
| Expected Result | The two reservations are listed as separate, adjacent commitments, not a conflict. The one that only touches the period is under "Other commitments", and the period is fully available. |

**Automated by:** `tests/unit/equipment-availability.test.ts` › "SCRUM-30 [AC2, AC5]: a commitment that only touches the period at an endpoint is an other commitment"; `tests/unit/equipment-schedule.test.ts` › "SCRUM-30 [AC5]: reports back-to-back reservations as two separate commitments"; `tests/integration/equipment-schedule.test.ts` › "SCRUM-30 [AC2, AC5]: splits real commitments by the requested period, with touching ones under other commitments"; `e2e/equipment.spec.ts` › "SCRUM-30 [AC2, AC5]: commitments that only touch the period are other commitments and leave it fully available"

### TC-30-05

| Item | Content |
|---|---|
| Test Case ID | TC-30-05 |
| Test Scenario | [Positive] AC 6: recorded unavailability shows its reason, note, quantity and period |
| Pre-conditions | The seed's maintenance on the projector pool and a damaged speaker. |
| Test Steps | 1. Choose the projector, then the speaker. |
| Test Data | The seeded records |
| Expected Result | Each shows its reason ("Under maintenance", "Damaged"), its note (the speaker's is "Blown driver, awaiting write-off."), its quantity (for example "1 unit(s)") and its period in SGT. |

**Automated by:** `tests/unit/equipment-schedule.test.ts` › "SCRUM-30 [AC6]: shows the reason and duration of unavailability"; `tests/integration/equipment-schedule.test.ts` › "SCRUM-30 [AC6]: shows the reason, note and period of unavailability, alongside reservations in time order"; `e2e/equipment.spec.ts` › "SCRUM-30 [AC6]: selecting a seeded item shows its commitments with the reason", "SCRUM-30 [AC6]: an outage shows its reason, note and period"

### TC-30-06

| Item | Content |
|---|---|
| Test Case ID | TC-30-06 |
| Test Scenario | [Boundary] AC 7: a type with nothing committed says it is fully available |
| Pre-conditions | A type with no commitments from the date viewed onwards. |
| Test Steps | 1. Choose the type. |
| Test Data | A newly created type with nothing reserved or recorded |
| Expected Result | It is reported as fully available, not shown as an empty list. |

**Automated by:** `tests/unit/equipment-schedule.test.ts` › "SCRUM-30 [AC7]: an item with nothing committed reports fully available, not an empty list"; `tests/integration/equipment-schedule.test.ts` › "SCRUM-30 [AC7]: an item with nothing committed from `from` onwards is reported fully available"; `e2e/equipment.spec.ts` › "SCRUM-30 [AC7]: an item with nothing committed says so instead of showing an empty list"

### TC-30-07

| Item | Content |
|---|---|
| Test Case ID | TC-30-07 |
| Test Scenario | [Negative] AC 1: the schedule is refused to a role without access, for an unknown type, and for a bad date |
| Pre-conditions | Signed in as an Organiser; then as Tech Support. |
| Test Steps | 1. As the Organiser, ask for a type's schedule. <br> 2. As Tech Support, ask for an unknown type, and give a start date that isn't a date. |
| Test Data | A made-up type id; "not-a-date" |
| Expected Result | Each is refused with its reason, and nothing is read. |

**Automated by:** `tests/unit/equipment-schedule.test.ts` › "refuses a role without equipment:read, and an unknown item", "rejects a malformed request with field errors and reads nothing", "rejects a `from` that is not a date"; `e2e/equipment.spec.ts` › "SCRUM-30 [AC1] TC-30-07: shows the schedule's own error when the item can no longer be read, and keeps the form" (a type retired while the page is open: the panel says "Equipment type is unavailable." and the availability check stays usable)
