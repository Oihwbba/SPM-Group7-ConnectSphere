# SCRUM-160 — Identify bookings that clash once setup and turnaround apply: test cases

Story and acceptance criteria: [docs/backlog/SCRUM-160.md](../backlog/SCRUM-160.md).
Format and conventions: [README.md](README.md). Why it works this way:
[ADR 0021](../adr/0021-flagging-setup-and-turnaround-clashes.md).

**Shared pre-conditions for every case:** the database is migrated and seeded
and the app is running. Signed in as `venuestaff@test.local`; the events'
Coordinator is `coordinator@test.local` (both `Password123!`). The venue
starts with 0 minutes' setup and turnaround and two Approved bookings that
don't touch: 10:00–12:00 (approved first) and 13:00–15:00 (approved second),
with maintenance recorded from 15:30 to 16:30.

Venue Staff change the times in SCRUM-34's venue edit (**Venues** › a venue ›
**Edit**). A longer time warns there, listing the bookings it would make
clash with any SCRUM-34 AC10 warning, and saving again confirms.

| ID | Type | Criterion | Automated |
|---|---|---|---|
| [TC-160-01](#tc-160-01) | Positive | AC 1, AC 2 | Unit, integration |
| [TC-160-02](#tc-160-02) | Boundary | AC 1 | Unit |
| [TC-160-03](#tc-160-03) | Positive | AC 2 | Unit |
| [TC-160-04](#tc-160-04) | Positive | AC 1, AC 2 | Unit, integration |
| [TC-160-05](#tc-160-05) | Boundary | AC 1 | Unit |
| [TC-160-06](#tc-160-06) | Negative | AC 6 | Unit, integration |
| [TC-160-07](#tc-160-07) | Positive | AC 2, AC 3 | Unit, integration |
| [TC-160-08](#tc-160-08) | Negative | AC 7 | Unit, integration |
| [TC-160-09](#tc-160-09) | Negative | AC 6, AC 7 | Unit |
| [TC-160-10](#tc-160-10) | Concurrency | AC 1 | Unit, integration |
| [TC-160-11](#tc-160-11) | Positive | AC 5 | Unit, integration, e2e |
| [TC-160-12](#tc-160-12) | Negative | AC 1 | Unit |
| [TC-160-13](#tc-160-13) | Positive | AC 4 | Integration |

### TC-160-01

| Item | Content |
|---|---|
| Test Case ID | TC-160-01 |
| Test Scenario | [Positive] AC 1, AC 2: lengthening shows the bookings it makes clash before anything is saved |
| Pre-conditions | — |
| Test Steps | Edit the venue: 30 minutes' setup and 45 minutes' turnaround. Save once. |
| Test Data | 30, 45 |
| Expected Result | Not saved: the edit warns and lists the 13:00–15:00 booking with both clashes, the 10:00–12:00 booking (now 09:30–12:45 against 12:30–15:45) and the maintenance. A booking that also stops fitting the venue (SCRUM-34 AC10) is listed once, for that. No booking is flagged. |

**Automated by:** `tests/unit/venue-time-clashes.test.ts` › "SCRUM-160 [AC1] TC-160-01: …", "SCRUM-160 [AC1, AC2] TC-160-01: …" (3 tests); `tests/unit/venue-catalogue.test.ts` › "SCRUM-160 [AC1] TC-160-01: …" (2 tests); `tests/integration/venue-time-clashes.test.ts` › "SCRUM-160 [AC1] TC-160-01: …"

### TC-160-02

| Item | Content |
|---|---|
| Test Case ID | TC-160-02 |
| Test Scenario | [Boundary] AC 1: occupied periods that only touch don't clash |
| Pre-conditions | The second booking runs 13:15–15:00 instead. |
| Test Steps | Lengthen to 30 and 45. |
| Test Data | — |
| Expected Result | 10:00–12:00 occupies to 12:45; 13:15–15:00 occupies from 12:45. No clash. |

**Automated by:** `tests/unit/venue-time-clashes.test.ts` › "SCRUM-160 [AC1] TC-160-02: …"

### TC-160-03

| Item | Content |
|---|---|
| Test Case ID | TC-160-03 |
| Test Scenario | [Positive] AC 2: of two clashing bookings, the one that took the venue later is flagged |
| Pre-conditions | One booking was held, then approved after the other was approved. |
| Test Steps | Lengthen the times. |
| Test Data | Held 15 Dec, approved 1 Feb; the other approved 15 Jan. |
| Expected Result | The one approved on 15 Jan is listed: the other took the venue when it was held. A seeded booking with neither time counts from its request; at the same moment, the higher id is the later. |

**Automated by:** `tests/unit/venue-time-clashes.test.ts` › "SCRUM-160 [AC2] TC-160-03: …" (3 tests)

### TC-160-04

| Item | Content |
|---|---|
| Test Case ID | TC-160-04 |
| Test Scenario | [Positive] AC 1, AC 2: a booking that now overlaps recorded unavailability |
| Pre-conditions | Maintenance from 15:30 to 16:30. |
| Test Steps | Lengthen the turnaround to 45 minutes. |
| Test Data | — |
| Expected Result | The 13:00–15:00 booking (now to 15:45) is listed with the maintenance. Unavailability starting exactly when the occupied period ends isn't a clash. |

**Automated by:** `tests/unit/venue-time-clashes.test.ts` › "SCRUM-160 [AC1, AC2] TC-160-04: …", "SCRUM-160 [AC1] TC-160-04: …"; `tests/integration/venue-time-clashes.test.ts` (TC-160-01)

### TC-160-05

| Item | Content |
|---|---|
| Test Case ID | TC-160-05 |
| Test Scenario | [Boundary] AC 1: only bookings that haven't started are listed |
| Pre-conditions | A booking is under way; the next one starts soon after. |
| Test Steps | Lengthen the setup. |
| Test Data | Under way until 00:30; the next starts 00:45; setup 30. |
| Expected Result | The booking under way keeps its own minutes and is never listed; the next one is, even if it was approved first. Two bookings under way are never listed. |

**Automated by:** `tests/unit/venue-time-clashes.test.ts` › "SCRUM-160 [AC1] TC-160-05: …" (2 tests)

### TC-160-06

| Item | Content |
|---|---|
| Test Case ID | TC-160-06 |
| Test Scenario | [Negative] AC 6: shortening, or lengthening without a clash, flags nothing |
| Pre-conditions | — |
| Test Steps | 1. Shorten a time. 2. Lengthen one where nothing would clash. |
| Test Data | 20 → 10; 0 → 15 |
| Expected Result | Saved at once, with the changed time in the venue's history. No booking is flagged. |

**Automated by:** `tests/unit/venue-time-clashes.test.ts` › "SCRUM-160 [AC6] TC-160-06: …" (5 tests); `tests/unit/venue-catalogue.test.ts` › "SCRUM-160 [AC6] TC-160-06: …"; `tests/integration/venue-time-clashes.test.ts` › "SCRUM-160 [AC6] TC-160-06: …"

### TC-160-07

| Item | Content |
|---|---|
| Test Case ID | TC-160-07 |
| Test Scenario | [Positive] AC 2, AC 3: confirmed, the times are saved and the clashing booking is flagged and its people told |
| Pre-conditions | As TC-160-01. |
| Test Steps | Save the same edit again to confirm. |
| Test Data | — |
| Expected Result | The times are saved. The 13:00–15:00 booking is flagged Needs Reconsideration with "Setup or turnaround time changed", once, with both clashes in its history. Its status, times and minutes don't change; the 10:00–12:00 booking isn't flagged. Its Coordinator and every Venue Staff member get one SCRUM-124 notice each that it needs reconsideration, with the reason; what it clashes with is on the Venue Staff list (TC-160-11). |

**Automated by:** `tests/unit/venue-time-clashes.test.ts` › "SCRUM-160 [AC2, AC3] TC-160-07: …" (2 tests); `tests/unit/venue-catalogue.test.ts` › "SCRUM-160 [AC2, AC3] TC-160-07: …"; `tests/integration/venue-time-clashes.test.ts` › "SCRUM-160 [AC2, AC3, AC5] TC-160-07: …"

### TC-160-08

| Item | Content |
|---|---|
| Test Case ID | TC-160-08 |
| Test Scenario | [Negative] AC 7: never flagged twice for the same clash |
| Pre-conditions | TC-160-07 done. |
| Test Steps | 1. Save the same times again. 2. The Coordinator resolves the flag; shorten to 0, then lengthen to 30 and 45 again. |
| Test Data | — |
| Expected Result | 1. Nothing changes. 2. No warning and no flag: its clashes are already in its history, which still holds just the two. A booking flagged by someone else in the meantime is left alone. |

**Automated by:** `tests/unit/venue-time-clashes.test.ts` › "SCRUM-160 [AC7] TC-160-08: …" (2 tests); `tests/unit/venue-catalogue.test.ts` › "SCRUM-160 [AC7] TC-160-08: …"; `tests/integration/venue-time-clashes.test.ts` › "SCRUM-160 [AC6, AC7] TC-160-08: …"

### TC-160-09

| Item | Content |
|---|---|
| Test Case ID | TC-160-09 |
| Test Scenario | [Negative] AC 6, AC 7: flags already raised stay as they are |
| Pre-conditions | A booking already flagged (a) for this reason, (b) for an approved change. |
| Test Steps | Lengthen so it clashes with something new. |
| Test Data | — |
| Expected Result | (a) The new clash is added to its history; no second flag or notice. (b) It keeps its first reason and the clash isn't recorded, so it can be flagged for it once resolved. |

**Automated by:** `tests/unit/venue-time-clashes.test.ts` › "SCRUM-160 [AC6, AC7] TC-160-09: …", "SCRUM-160 [AC6] TC-160-09: …" (2 tests)

### TC-160-10

| Item | Content |
|---|---|
| Test Case ID | TC-160-10 |
| Test Scenario | [Concurrency] AC 1: a booking approved while the times change |
| Pre-conditions | A pending request at the venue. |
| Test Steps | Approve it while the times are being changed. |
| Test Data | — |
| Expected Result | Both read the venue's times under its row lock, so they take turns: the approval (or hold) copies the new minutes and is checked against them, or it is already Approved when clashes are looked for. The lock comes after the availability check, so two simultaneous approvals still both reach the database's own refusal, and the booking's row is locked before the venue's, the order recording unavailability takes, so the two never deadlock. |

**Automated by:** `tests/unit/bookings.test.ts` › "SCRUM-160 [AC1] TC-160-10: …" (3 tests); `tests/integration/concurrency.test.ts` › "SCRUM-53 [AC5] TC-53-05: …" and "SCRUM-159 [AC5] TC-159-09: …", where the approvals still race past the check

### TC-160-11

| Item | Content |
|---|---|
| Test Case ID | TC-160-11 |
| Test Scenario | [Positive] AC 5: Venue Staff list the bookings flagged for this reason |
| Pre-conditions | TC-160-07 done. |
| Test Steps | Open **Bookings**. |
| Test Data | — |
| Expected Result | "Clashes after a setup or turnaround change" lists the 13:00–15:00 booking with its venue, event, Coordinator (or "Not assigned"), period and both clashes. Clashes from an earlier, resolved flag aren't shown. With nothing flagged, the section isn't shown (shared page conventions, change 14). |

**Automated by:** `tests/unit/venue-time-clashes.test.ts` › "SCRUM-160 [AC5] TC-160-11: …", "SCRUM-160 [AC5, AC6] TC-160-11: …"; `tests/unit/time-clash-flags.test.tsx` (2 tests); `tests/integration/venue-time-clashes.test.ts` (TC-160-07); `e2e/setup-turnaround-clashes.spec.ts` › "SCRUM-160 [AC5] TC-160-11: …"

### TC-160-12

| Item | Content |
|---|---|
| Test Case ID | TC-160-12 |
| Test Scenario | [Negative] AC 1: only Venue Staff change a venue's times, and only within range |
| Pre-conditions | — |
| Test Steps | Edit as another role; save 1,441 minutes. |
| Test Data | — |
| Expected Result | "You do not have permission to do that."; "Turnaround time must be a whole number of minutes from 0 to 1,440." against the field. Nothing is saved. These are SCRUM-34's and SCRUM-159's rules for the venue edit. |

**Automated by:** `tests/unit/venue-catalogue.test.ts` › "SCRUM-34 [AC9] TC-34-11: …"; `tests/unit/venue-times.test.ts` › "SCRUM-159 [AC1] TC-159-02: …" (2 tests)

### TC-160-13

| Item | Content |
|---|---|
| Test Case ID | TC-160-13 |
| Test Scenario | [Positive] AC 4: the seed creates no clash |
| Pre-conditions | A freshly seeded database. |
| Test Steps | Look for clashes at each seeded venue with its seeded times. |
| Test Data | — |
| Expected Result | None. Seeding doesn't run the check, and seeded venues start at 0 and 0 (SCRUM-159 AC1). |

**Automated by:** `tests/integration/venue-time-clashes.test.ts` › "SCRUM-160 [AC4] TC-160-13: …"
