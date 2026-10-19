# SCRUM-131 — Use the agreed status names on every screen: test cases

Story and acceptance criteria: [docs/backlog/SCRUM-131.md](../backlog/SCRUM-131.md).
Format and conventions: [README.md](README.md). The names are defined once,
in `lib/status-labels.ts` (events, bookings, reservations, registrations and
the Needs Reconsideration badge) and beside their rules for equipment
requests (`lib/equipment/requests.ts`), change requests
(`lib/schemas/change-request.ts`) and safety checks (`lib/safety-checks.ts`).

**Shared pre-conditions for every case:** the database is migrated and seeded
and the app is running. Every account's password is `Password123!`.

| ID | Type | Criterion | Automated |
|---|---|---|---|
| [TC-131-01](#tc-131-01) | Positive | AC 1 | Unit, e2e |
| [TC-131-02](#tc-131-02) | Positive | AC 2 | Unit |
| [TC-131-03](#tc-131-03) | Negative | AC 2 | Unit |
| [TC-131-04](#tc-131-04) | Positive, Negative | AC 3 | Unit, e2e |
| [TC-131-05](#tc-131-05) | Positive | AC 2, AC 3 | Unit, e2e |
| [TC-131-06](#tc-131-06) | Negative | AC 4 | Unit |
| [TC-131-07](#tc-131-07) | Positive | AC 5 | Unit |
| [TC-131-08](#tc-131-08) | Positive | AC 7 | Unit, integration |
| [TC-131-09](#tc-131-09) | Negative | AC 6 | Unit (SCRUM-85) |

### TC-131-01

| Item | Content |
|---|---|
| Test Case ID | TC-131-01 |
| Test Scenario | [Positive] AC 1: event statuses use the nine agreed names, and the Organiser's tab of every non-draft request is named Sent |
| Pre-conditions | Signed in as the Organiser, who owns seeded events in several statuses. |
| Test Steps | 1. Open My Events. <br> 2. Read the filter tabs. <br> 3. Open the status filter. |
| Test Data | `organiser@test.local` |
| Expected Result | The tabs read "All (n)", "Drafts (n)" and "Sent (n)"; no tab reads "Submitted". The filter offers All Statuses, then Draft, Submitted, Under Review, Approved, Planning, Confirmed, Completed, Cancelled, Rejected. Every status badge uses one of those nine names. |

**Automated by:** `tests/unit/status-labels.test.ts` › "SCRUM-131 [AC1] TC-131-01: event statuses are shown exactly as the nine agreed names, in lifecycle order"; `e2e/status-names.spec.ts` › "SCRUM-131 [AC1] TC-131-01: the Organiser's tab of every request that isn't a draft reads Sent, and the status filter offers the nine agreed names"

### TC-131-02

| Item | Content |
|---|---|
| Test Case ID | TC-131-02 |
| Test Scenario | [Positive] AC 2: venue bookings and equipment requests use their agreed names |
| Pre-conditions | — |
| Test Steps | 1. Read each stored booking and equipment request status's display name. |
| Test Data | Booking: PENDING, HELD, APPROVED, REJECTED, EXPIRED, CANCELLED. Equipment request: PENDING_REVIEW, IN_REVIEW, APPROVED, REJECTED, CANCELLED. |
| Expected Result | Pending, Held, Approved, Rejected, Expired, Cancelled; and Pending Review, In Review, Approved, Rejected, Cancelled. |

**Automated by:** `tests/unit/status-labels.test.ts` › "SCRUM-131 [AC2] TC-131-02: venue bookings are shown as Pending, Held, Approved, Rejected, Expired or Cancelled" and "SCRUM-131 [AC2] TC-131-02: equipment requests are shown as Pending Review, In Review, Approved, Rejected or Cancelled"

### TC-131-03

| Item | Content |
|---|---|
| Test Case ID | TC-131-03 |
| Test Scenario | [Negative] AC 2: a reservation is never shown as Confirmed |
| Pre-conditions | — |
| Test Steps | 1. Read the display name of each stored reservation status. |
| Test Data | CONFIRMED, CANCELLED |
| Expected Result | Reserved and Cancelled; "Confirmed" is not among them. |

**Automated by:** `tests/unit/status-labels.test.ts` › "SCRUM-131 [AC2] TC-131-03: a reservation stored as CONFIRMED is shown as Reserved, never Confirmed"

### TC-131-04

| Item | Content |
|---|---|
| Test Case ID | TC-131-04 |
| Test Scenario | [Positive, Negative] AC 3: Needs Reconsideration is a badge beside a booking's status, never in place of it |
| Pre-conditions | A Planning event with a flagged Approved booking of Exhibition Hall; also a flagged Pending and a flagged Held booking beside an Approved one. |
| Test Steps | 1. As the Coordinator, open the event's readiness checklist. <br> 2. Choose Still stands. <br> 3. As the Organiser, open the same checklist before step 2. |
| Test Data | `coordinator@test.local`, `organiser@test.local`; reason "The event's expected attendance changed." |
| Expected Result | 1. The booking reads "Approved", then a **Needs Reconsideration** badge, then the reason; a flagged Pending one reads "Pending" and a flagged Held one "Held until … – confirm to secure", each with the badge. The item is incomplete and Confirm is disabled. 2. The badge disappears and the item is complete. 3. "Approved" with the badge, without the reason. |

**Automated by:** `tests/unit/status-labels.test.ts` › "SCRUM-131 [AC3] TC-131-04: the flag is named Needs Reconsideration, which is no booking or reservation status"; `tests/unit/event-readiness.test.ts` › "SCRUM-26 [AC12] TC-26-13, SCRUM-131 [AC3] TC-131-04: …" (2 tests); `e2e/reconsideration.spec.ts` › "SCRUM-26 [AC7, AC8, AC12] TC-26-14, SCRUM-131 [AC3] TC-131-04: …" and "SCRUM-26 [AC7, AC12] TC-26-14, SCRUM-131 [AC3] TC-131-04: …"

### TC-131-05

| Item | Content |
|---|---|
| Test Case ID | TC-131-05 |
| Test Scenario | [Positive] AC 2, AC 3: a flagged reservation still reads Reserved, with the badge |
| Pre-conditions | A Planning event whose approved equipment request has flagged reservations of two Projectors and a Wireless Microphone. |
| Test Steps | 1. Open the readiness checklist as the Coordinator. |
| Test Data | Reason "One projector broke." |
| Expected Result | Equipment is incomplete and reads "Reserved: Projector, Wireless Microphone", with the Needs Reconsideration badge and the reason. |

**Automated by:** `tests/unit/event-readiness.test.ts` › "SCRUM-26 [AC12] TC-26-13, SCRUM-131 [AC2, AC3] TC-131-05: a flagged Confirmed reservation makes the equipment item incomplete, reading Reserved with the flag, naming the equipment, with the first reason"; `e2e/reconsideration.spec.ts` › "SCRUM-26 [AC12] TC-26-13, SCRUM-131 [AC2, AC3] TC-131-05: a confirmed reservation reads Reserved, never Confirmed, and once flagged reads Reserved with the equipment named …" (the Coordinator's checklist, before and after the flag)

### TC-131-06

| Item | Content |
|---|---|
| Test Case ID | TC-131-06 |
| Test Scenario | [Negative] AC 4: a registration is never shown as Confirmed |
| Pre-conditions | — |
| Test Steps | 1. Read the display name of each stored registration status, as My Registrations and the event's registration list show it. |
| Test Data | REGISTERED, WITHDRAWN, CANCELLED |
| Expected Result | Registered, Withdrawn, Cancelled; "Confirmed" is not among them. |

**Automated by:** `tests/unit/status-labels.test.ts` › "SCRUM-131 [AC4] TC-131-06: registrations are shown as Registered, Withdrawn or Cancelled, never Confirmed"

### TC-131-07

| Item | Content |
|---|---|
| Test Case ID | TC-131-07 |
| Test Scenario | [Positive] AC 5: change requests are shown as Submitted, Approved or Rejected |
| Pre-conditions | — |
| Test Steps | 1. Read the display name of each stored change request status. |
| Test Data | PENDING_REVIEW, APPROVED, REJECTED |
| Expected Result | Submitted, Approved, Rejected. |

**Automated by:** `tests/unit/status-labels.test.ts` › "SCRUM-131 [AC5] TC-131-07: a change request stored as PENDING_REVIEW is shown as Submitted, then Approved or Rejected"

### TC-131-08

| Item | Content |
|---|---|
| Test Case ID | TC-131-08 |
| Test Scenario | [Positive] AC 7: safety checks use their six names, and the event stays in Planning |
| Pre-conditions | A Planning event whose safety check receives Changes requested. |
| Test Steps | 1. Read each safety check state's display name. <br> 2. Record Changes requested and read the event's status. |
| Test Data | — |
| Expected Result | 1. Not requested, Awaiting review, Approved, Changes requested, Rejected, Outdated. 2. The event's status is still Planning. |

**Automated by:** `tests/unit/status-labels.test.ts` › "SCRUM-131 [AC7] TC-131-08: safety checks are shown as Not requested, Awaiting review, Approved, Changes requested, Rejected or Outdated"; `tests/integration/safety-check.test.ts` › "SCRUM-166 [AC3, AC10] TC-166-05: Changes requested keeps the picked booking, flags it with the note, and the event stays in Planning"

### TC-131-09

| Item | Content |
|---|---|
| Test Case ID | TC-131-09 |
| Test Scenario | [Negative] AC 6: an Attendee never sees an internal event status |
| Pre-conditions | As TC-85-06: an event the Attendee is registered for, back in Planning after being Confirmed. |
| Test Steps | 1. As the Attendee, open My Registrations. |
| Test Data | `attendee@test.local` |
| Expected Result | The card reads "Details being updated – registration paused", never "Planning". The Attendee's pages show no event status badge at all; browse lists only Confirmed events. |

**Automated by:** SCRUM-85's cases, which AC 6 points to: `tests/unit/replanning-views.test.tsx` › "SCRUM-85 [AC8, AC10] TC-85-06: the card says details are being updated, never Planning, with what was last confirmed, and links to the event"
