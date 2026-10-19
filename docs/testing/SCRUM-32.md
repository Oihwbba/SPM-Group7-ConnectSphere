# SCRUM-32 — Report reserved equipment that can no longer be provided: test cases

Story and acceptance criteria: [docs/backlog/SCRUM-32.md](../backlog/SCRUM-32.md).
Format and conventions: [README.md](README.md).

Technical Support report a reservation from the Equipment page, under the
selected type's commitments. The report flags it Needs Reconsideration
(SCRUM-26) with the reason; the event's Coordinator resolves the flag. Built
by `reportUnprovidableEquipment` in
[app/(app)/equipment/actions.ts](<../../app/(app)/equipment/actions.ts>).

**Shared pre-conditions for every case:** the database is migrated and
seeded. A Planning event assigned to `coordinator@test.local` has a
Confirmed reservation of 2 units of a 4-unit equipment type. Signed in as
`techsupport@test.local` (`Password123!`), on **Equipment**, with that type
selected.

| ID | Type | Criterion | Automated |
|---|---|---|---|
| [TC-32-01](#tc-32-01) | Positive | AC 1, AC 2, AC 4, AC 5 | Unit, integration, e2e |
| [TC-32-02](#tc-32-02) | Negative, Boundary | AC 2 | Unit, e2e |
| [TC-32-03](#tc-32-03) | Negative, Concurrency | AC 3 | Unit, integration |
| [TC-32-04](#tc-32-04) | Negative | AC 1 | Unit |
| [TC-32-05](#tc-32-05) | Negative | AC 4 | Unit |
| [TC-32-06](#tc-32-06) | Positive | AC 4, AC 5 | Integration |

---

### TC-32-01

| Item | Content |
|---|---|
| Test Case ID | TC-32-01 |
| Test Scenario | [Positive] AC 1, AC 2, AC 4, AC 5: a report flags the reservation with the reason; it stays reserved as it was, the report is recorded, and the Coordinator is told |
| Pre-conditions | Shared. |
| Test Steps | 1. On the reservation, choose **Can't provide this**. <br> 2. Enter the reason and choose **Report**. <br> 3. As `coordinator@test.local`, open the event's details. |
| Test Data | Reason "The rig's power supply failed its test." |
| Expected Result | Step 2: "Reported. The event's Coordinator has been told."; the reservation still reads 2 unit(s), now "Reserved" with the Needs Reconsideration badge beside it (SCRUM-131 AC3) and "Waiting for the event's Coordinator to decide.", with no report button. It is still Confirmed with the same quantity and period, flagged with the reason "Technical Support can no longer provide it: …". The report is recorded with who and when. The Coordinator has one notice, "Arrangements flagged for reconsideration", with the reason (SCRUM-124 AC8). Step 3: the Needs Reconsideration panel lists "[type] × 2" with the reason. |

**Automated by:** `tests/unit/report-reservation.test.ts` › "SCRUM-32 [AC1, AC4] TC-32-01: a report flags the reservation with the reason, and changes nothing else about it", "SCRUM-32 [AC2, AC5] TC-32-01: the event's Coordinator is told, with the reason", "SCRUM-32 [AC5] TC-32-01: the report is recorded with who made it and when" and "SCRUM-32 [AC1] TC-32-01: the event's row is locked before the reservation's, the order resolving a flag uses"; `tests/integration/report-reservation.test.ts` › "SCRUM-32 [AC1, AC2, AC4, AC5] TC-32-01: a report flags the reservation with the reason, keeps it reserved as it was, records who, and tells the Coordinator"; `e2e/report-reservation.spec.ts` › "SCRUM-32 [AC1, AC2, AC4] TC-32-01, TC-32-02: Technical Support report a reservation with a reason, and the Coordinator finds it flagged with that reason"

### TC-32-02

| Item | Content |
|---|---|
| Test Case ID | TC-32-02 |
| Test Scenario | [Negative, Boundary] AC 2: a report needs a reason, of at most 500 characters |
| Pre-conditions | Shared, with **Can't provide this** chosen. |
| Test Steps | 1. Leave the reason empty, or only spaces. <br> 2. Send a report with no reason, or no reservation, straight to the server. <br> 3. Send reasons of 500 and 501 characters. |
| Test Data | "", "   ", 500 and 501 characters |
| Expected Result | 1: **Report** stays disabled. 2: "Say why it can no longer be provided." at the field (or "Reservation not found." without a reservation), and nothing is read or written. 3: 500 is accepted; 501 is refused. |

**Automated by:** `tests/unit/report-reservation.test.ts` › "SCRUM-32 [AC2] TC-32-02: a report without a reason (%j) is refused before anything is read", "SCRUM-32 [AC2] TC-32-02: a reason over 500 characters is refused, and one of exactly 500 is accepted" and "SCRUM-32 [AC1] TC-32-02: a request without a reservation id is not found, before anything is read"; `e2e/report-reservation.spec.ts` › "SCRUM-32 [AC1, AC2, AC4] TC-32-01, TC-32-02: …" (the disabled Report)

### TC-32-03

| Item | Content |
|---|---|
| Test Case ID | TC-32-03 |
| Test Scenario | [Negative, Concurrency] AC 3: reporting a reservation that is already flagged changes nothing and tells nobody again |
| Pre-conditions | Shared. |
| Test Steps | 1. Report it, then report it again. <br> 2. On another, two members of Technical Support report it at the same moment. |
| Test Data | Reasons "Two of the projectors failed their safety test." and "Lens cracked." |
| Expected Result | 1: the second report is refused with "This reservation has already been reported and is waiting for its event's Coordinator to decide."; the reservation, its reason, the record and the notices are as after the first. 2: one report succeeds; the reservation is flagged once, with one record and one notice to the Coordinator. |

**Automated by:** `tests/unit/report-reservation.test.ts` › "SCRUM-32 [AC3] TC-32-03: a reservation already flagged is left alone, and nobody is told again" and "SCRUM-32 [AC3] TC-32-03: a reservation someone else reported a moment earlier is flagged once, with no second record"; `tests/integration/report-reservation.test.ts` › "SCRUM-32 [AC3] TC-32-03: two reports at the same moment flag it once, with one record and one notice" and "SCRUM-32 [AC3] TC-32-03: reporting it again later changes nothing"

### TC-32-04

| Item | Content |
|---|---|
| Test Case ID | TC-32-04 |
| Test Scenario | [Negative] AC 1: only a Confirmed reservation can be reported |
| Pre-conditions | — |
| Test Steps | 1. Report a reservation that doesn't exist. <br> 2. Report a Cancelled one. <br> 3. Report one cancelled a moment after it was read. |
| Test Data | — |
| Expected Result | Each: "Reservation not found.", and nothing is written. |

**Automated by:** `tests/unit/report-reservation.test.ts` › "SCRUM-32 [AC1] TC-32-04: a reservation cancelled a moment earlier is not found, and nothing is recorded" and "SCRUM-32 [AC1] TC-32-04: a reservation that doesn't exist or is cancelled (%j) is not found"

### TC-32-05

| Item | Content |
|---|---|
| Test Case ID | TC-32-05 |
| Test Scenario | [Negative] AC 4: only Technical Support can report, and no one can cancel or change a reservation this way |
| Pre-conditions | — |
| Test Steps | 1. As a Coordinator, Venue Staff, an Organiser or a Safety Officer, send a report. <br> 2. Send one signed out. |
| Test Data | — |
| Expected Result | "You do not have permission to do that.", before anything is read. The report itself only flags (TC-32-01): there is no way here to cancel a reservation or change its quantity or period. |

**Automated by:** `tests/unit/report-reservation.test.ts` › "SCRUM-32 [AC4] TC-32-05: %s can't report a reservation, and nothing is read", "SCRUM-32 [AC4] TC-32-05: only Technical Support hold the permission to report" and "SCRUM-32 TC-32-05: a signed-out caller is refused"

### TC-32-06

| Item | Content |
|---|---|
| Test Case ID | TC-32-06 |
| Test Scenario | [Positive] AC 4, AC 5: the Coordinator resolves the reported reservation, which may cancel it and return its stock, recorded with who and when |
| Pre-conditions | A reported reservation (TC-32-01). Signed in as `coordinator@test.local`. |
| Test Steps | 1. In the event's Needs Reconsideration panel, choose Cancel arrangement. |
| Test Data | — |
| Expected Result | The reservation is Cancelled, which returns its 2 units, with who resolved it and when (SCRUM-26 AC9). |

**Automated by:** `tests/integration/report-reservation.test.ts` › "SCRUM-32 [AC4, AC5] TC-32-06: the Coordinator cancels the reported reservation, which returns its stock and records who"
