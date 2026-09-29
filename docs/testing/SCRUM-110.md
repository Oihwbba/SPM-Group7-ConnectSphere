# SCRUM-110 — Define event confirmation readiness: test cases

Story and acceptance criteria: [docs/backlog/SCRUM-110.md](../backlog/SCRUM-110.md).
Format and conventions: [README.md](README.md). The rule itself is
[lib/event-readiness.ts](../../lib/event-readiness.ts); the decisions behind it
are [ADR 0011](../adr/0011-event-confirmation-readiness-rule.md).

SCRUM-110 is a business rule with no screen of its own: SCRUM-81 calls it
before moving an event from Planning to Confirmed and shows its answer to the
Coordinator. Until SCRUM-81 lands, each case is run by arranging the records
below and asking the rule for its verdict, which the unit tests do. The rule
only reads, so it needs no integration test (CONTRIBUTING reserves those for
locks, transactions and constraints) and no Playwright test (it has no page).

**Shared pre-conditions for every case:** one event in **Planning**, unless
the case says otherwise. "Approved booking" means a venue booking for that
event with status APPROVED; "confirmed reservation" means an equipment
reservation for that event with status CONFIRMED. Nothing is flagged for
reconsideration unless the case says so.

**The verdict** is `ready` (true or false) plus the list of **gaps**, in this
order when several apply:

| Gap                                  | Meaning                                         |
| ------------------------------------ | ----------------------------------------------- |
| `EVENT_NOT_FOUND`                    | No event has that id                            |
| `NOT_IN_PLANNING`                    | Only a Planning event can be confirmation-ready |
| `NO_APPROVED_VENUE_BOOKING`          | AC 1, AC 4, AC 5                                |
| `NO_CONFIRMED_EQUIPMENT_RESERVATION` | AC 2, AC 4                                      |
| `UNRESOLVED_RECONSIDERATION`         | AC 6, AC 7                                      |

| ID                      | Type     | Criterion                  | Automated    |
| ----------------------- | -------- | -------------------------- | ------------ |
| [TC-110-01](#tc-110-01) | Positive | AC 1, AC 3                 | Unit         |
| [TC-110-02](#tc-110-02) | Negative | AC 1, AC 5                 | Unit         |
| [TC-110-03](#tc-110-03) | Negative | AC 1, AC 4                 | Unit         |
| [TC-110-04](#tc-110-04) | Boundary | AC 1, AC 4                 | Unit         |
| [TC-110-05](#tc-110-05) | Positive | AC 2                       | Unit         |
| [TC-110-06](#tc-110-06) | Negative | AC 2, AC 4                 | Unit         |
| [TC-110-07](#tc-110-07) | Boundary | AC 2, AC 3                 | Unit         |
| [TC-110-08](#tc-110-08) | Positive | AC 3                       | Unit         |
| [TC-110-09](#tc-110-09) | Negative | AC 6, AC 7                 | Unit         |
| [TC-110-10](#tc-110-10) | Boundary | AC 7                       | Unit         |
| [TC-110-11](#tc-110-11) | Negative | Planning only; AC 6        | Unit         |
| [TC-110-12](#tc-110-12) | Negative | Unknown event              | Unit         |
| [TC-110-13](#tc-110-13) | Positive | Every gap reported at once | Unit         |
| [TC-110-14](#tc-110-14) | Positive | AC 8, AC 9                 | Unit, review |

---

### TC-110-01

| Item            | Content                                                                                                  |
| --------------- | -------------------------------------------------------------------------------------------------------- |
| Test Case ID    | TC-110-01                                                                                                |
| Test Scenario   | [Positive] AC 1, AC 3: a Planning event with an approved venue booking and no equipment request is ready |
| Pre-conditions  | Planning event. One approved booking. No equipment request. No reservations.                             |
| Test Steps      | 1. Ask the rule whether the event is confirmation-ready.                                                 |
| Test Data       | Event status PLANNING; booking status APPROVED                                                           |
| Expected Result | `ready: true`, no gaps.                                                                                  |

**Automated by:** `tests/unit/event-readiness.test.ts` › "SCRUM-110 [AC1, AC3] TC-110-01: a Planning event with an approved venue booking and no equipment request is ready"

### TC-110-02

| Item            | Content                                                                                                                    |
| --------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Test Case ID    | TC-110-02                                                                                                                  |
| Test Scenario   | [Negative] AC 1, AC 5: without any venue booking the event is not ready, even when the Organiser gave no venue requirement |
| Pre-conditions  | Planning event whose venue requirement is blank. No bookings. No equipment request.                                        |
| Test Steps      | 1. Ask the rule whether the event is confirmation-ready.                                                                   |
| Test Data       | Event status PLANNING; venueRequirements empty; no bookings                                                                |
| Expected Result | `ready: false`, gaps `NO_APPROVED_VENUE_BOOKING`. The venue requirement is never consulted.                                |

**Automated by:** `tests/unit/event-readiness.test.ts` › "SCRUM-110 [AC1, AC5] TC-110-02: without any venue booking the event is not ready, and the Organiser's venue requirement is never consulted"

### TC-110-03

| Item            | Content                                                                                            |
| --------------- | -------------------------------------------------------------------------------------------------- |
| Test Case ID    | TC-110-03                                                                                          |
| Test Scenario   | [Negative] AC 1, AC 4: a booking that is pending, rejected or cancelled does not count as approved |
| Pre-conditions  | Planning event. Its only booking is PENDING (then REJECTED, then CANCELLED).                       |
| Test Steps      | 1. For each booking status, ask the rule for its verdict.                                          |
| Test Data       | Booking status PENDING / REJECTED / CANCELLED                                                      |
| Expected Result | Each time `ready: false`, gaps `NO_APPROVED_VENUE_BOOKING`.                                        |

**Automated by:** `tests/unit/event-readiness.test.ts` › "SCRUM-110 [AC1, AC4] TC-110-03: a PENDING / REJECTED / CANCELLED booking is not an approved one"

### TC-110-04

| Item            | Content                                                                                                                                                                   |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Test Case ID    | TC-110-04                                                                                                                                                                 |
| Test Scenario   | [Boundary] AC 1, AC 4: after a rejected booking, a second booking that is approved makes the event ready (SCRUM-81: "the Coordinator can submit another booking request") |
| Pre-conditions  | Planning event with one REJECTED booking and one APPROVED booking.                                                                                                        |
| Test Steps      | 1. Ask the rule whether the event is confirmation-ready.                                                                                                                  |
| Test Data       | Bookings REJECTED, APPROVED                                                                                                                                               |
| Expected Result | `ready: true`, no gaps.                                                                                                                                                   |

**Automated by:** `tests/unit/event-readiness.test.ts` › "SCRUM-110 [AC1, AC4] TC-110-04: a second booking approved after a rejected one makes the event ready"

### TC-110-05

| Item            | Content                                                                                               |
| --------------- | ----------------------------------------------------------------------------------------------------- |
| Test Case ID    | TC-110-05                                                                                             |
| Test Scenario   | [Positive] AC 2: with an equipment request, an approved booking plus a confirmed reservation is ready |
| Pre-conditions  | Planning event. One approved booking. One equipment request. One confirmed reservation.               |
| Test Steps      | 1. Ask the rule whether the event is confirmation-ready.                                              |
| Test Data       | Equipment request APPROVED; reservation CONFIRMED                                                     |
| Expected Result | `ready: true`, no gaps.                                                                               |

**Automated by:** `tests/unit/event-readiness.test.ts` › "SCRUM-110 [AC2] TC-110-05: with an equipment request, an approved booking plus a confirmed reservation is ready"

### TC-110-06

| Item            | Content                                                                                                                                |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Test Case ID    | TC-110-06                                                                                                                              |
| Test Scenario   | [Negative] AC 2, AC 4: an equipment request with no confirmed reservation (none, or only a cancelled one) is not ready                 |
| Pre-conditions  | Planning event. One approved booking. One equipment request still being reviewed. Either no reservation, or one CANCELLED reservation. |
| Test Steps      | 1. Ask the rule for its verdict with no reservation. <br> 2. Ask again with only a cancelled reservation.                              |
| Test Data       | Equipment request PENDING_REVIEW; reservation CANCELLED                                                                                |
| Expected Result | Both times `ready: false`, gaps `NO_CONFIRMED_EQUIPMENT_RESERVATION`.                                                                  |

**Automated by:** `tests/unit/event-readiness.test.ts` › "SCRUM-110 [AC2, AC4] TC-110-06: an equipment request with no reservation, or only a cancelled one is not ready"

### TC-110-07

| Item            | Content                                                                                                                                    |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Test Case ID    | TC-110-07                                                                                                                                  |
| Test Scenario   | [Boundary] AC 2, AC 3: a request Technical Support rejected still needs equipment; only a cancelled request stops equipment being required |
| Pre-conditions  | Planning event with an approved booking and no reservation. Its only equipment request is REJECTED (then CANCELLED).                       |
| Test Steps      | 1. Ask the rule for its verdict with the rejected request. <br> 2. Ask again with the request cancelled.                                   |
| Test Data       | Equipment request REJECTED / CANCELLED                                                                                                     |
| Expected Result | Rejected: `ready: false`, gaps `NO_CONFIRMED_EQUIPMENT_RESERVATION`. Cancelled: `ready: true`.                                             |

**Automated by:** `tests/unit/event-readiness.test.ts` › "SCRUM-110 [AC2, AC3] TC-110-07: a request Technical Support rejected still needs equipment; only a cancelled request stops equipment being required"

### TC-110-08

| Item            | Content                                                                                              |
| --------------- | ---------------------------------------------------------------------------------------------------- |
| Test Case ID    | TC-110-08                                                                                            |
| Test Scenario   | [Positive] AC 3: a reservation made without an equipment request does not block, and is not required |
| Pre-conditions  | Planning event with an approved booking, no equipment request and one confirmed reservation.         |
| Test Steps      | 1. Ask the rule whether the event is confirmation-ready.                                             |
| Test Data       | No equipment request; reservation CONFIRMED                                                          |
| Expected Result | `ready: true`, no gaps.                                                                              |

**Automated by:** `tests/unit/event-readiness.test.ts` › "SCRUM-110 [AC3] TC-110-08: a reservation made without an equipment request neither blocks nor is required"

### TC-110-09

| Item            | Content                                                                                                                                                                                                                                      |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Test Case ID    | TC-110-09                                                                                                                                                                                                                                    |
| Test Scenario   | [Negative] AC 6, AC 7: an arrangement still flagged "needs reconsideration" after an impactful change blocks confirmation, even when everything else is in place                                                                             |
| Pre-conditions  | Planning event (moved back from Confirmed by an approved impactful change) with an approved booking, an equipment request and a confirmed reservation. One active record is flagged: the booking, then the reservation, then a registration. |
| Test Steps      | 1. For each flagged record, ask the rule for its verdict.                                                                                                                                                                                    |
| Test Data       | needsReconsideration = true on the APPROVED booking / CONFIRMED reservation / REGISTERED registration                                                                                                                                        |
| Expected Result | Each time `ready: false`, gaps `UNRESOLVED_RECONSIDERATION`.                                                                                                                                                                                 |

**Automated by:** `tests/unit/event-readiness.test.ts` › "SCRUM-110 [AC6, AC7] TC-110-09: a flagged booking / reservation / registration blocks confirmation even when every arrangement is in place"

### TC-110-10

| Item            | Content                                                                                                                                                                                            |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Test Case ID    | TC-110-10                                                                                                                                                                                          |
| Test Scenario   | [Boundary] AC 7: a flag counts as resolved once it is cleared, or once staff cancel or withdraw the flagged record (the customer's ruling: staff decide, and the Coordinator records the decision) |
| Pre-conditions  | As TC-110-09, but every flag has been dealt with: cleared on active records, and still set only on a cancelled booking, a cancelled reservation and a withdrawn registration.                      |
| Test Steps      | 1. Ask the rule whether the event is confirmation-ready.                                                                                                                                           |
| Test Data       | Flagged booking CANCELLED; flagged reservation CANCELLED; flagged registration WITHDRAWN                                                                                                           |
| Expected Result | `ready: true`, no gaps.                                                                                                                                                                            |

**Automated by:** `tests/unit/event-readiness.test.ts` › "SCRUM-110 [AC7] TC-110-10: a flag no longer blocks once the flagged booking, reservation or registration is cancelled or withdrawn"

### TC-110-11

| Item            | Content                                                                                                                      |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Test Case ID    | TC-110-11                                                                                                                    |
| Test Scenario   | [Negative] Planning only, AC 6: an event in any other status is not confirmation-ready, even with every arrangement in place |
| Pre-conditions  | An event with an approved booking and nothing else outstanding, in each status other than Planning.                          |
| Test Steps      | 1. For each status, ask the rule for its verdict.                                                                            |
| Test Data       | DRAFT, SUBMITTED, UNDER_REVIEW, APPROVED, CONFIRMED, COMPLETED, CANCELLED, REJECTED                                          |
| Expected Result | Each time `ready: false`, gaps `NOT_IN_PLANNING`.                                                                            |

**Automated by:** `tests/unit/event-readiness.test.ts` › "SCRUM-110 [Planning only] TC-110-11: an event in any status but Planning is not confirmation-ready, even with every arrangement in place"

### TC-110-12

| Item            | Content                                                                            |
| --------------- | ---------------------------------------------------------------------------------- |
| Test Case ID    | TC-110-12                                                                          |
| Test Scenario   | [Negative] An id that matches no event is not ready, and nothing else is looked up |
| Pre-conditions  | No event has the id.                                                               |
| Test Steps      | 1. Ask the rule for its verdict.                                                   |
| Test Data       | eventId `evt_missing`                                                              |
| Expected Result | `ready: false`, gaps `EVENT_NOT_FOUND` only.                                       |

**Automated by:** `tests/unit/event-readiness.test.ts` › "SCRUM-110 TC-110-12: an id that matches no event is not ready, and nothing else is reported"

### TC-110-13

| Item            | Content                                                                                                                                            |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Test Case ID    | TC-110-13                                                                                                                                          |
| Test Scenario   | [Positive] Every outstanding arrangement is reported at once, so the Coordinator sees all of them, not just the first                              |
| Pre-conditions  | Approved (not yet Planning) event. No booking. An open equipment request and no reservation. One flagged registration.                             |
| Test Steps      | 1. Ask the rule for its verdict.                                                                                                                   |
| Test Data       | Status APPROVED; equipment request IN_REVIEW; flagged REGISTERED registration                                                                      |
| Expected Result | `ready: false`, gaps in order: `NOT_IN_PLANNING`, `NO_APPROVED_VENUE_BOOKING`, `NO_CONFIRMED_EQUIPMENT_RESERVATION`, `UNRESOLVED_RECONSIDERATION`. |

**Automated by:** `tests/unit/event-readiness.test.ts` › "SCRUM-110 TC-110-13: every outstanding arrangement is reported at once, in a fixed order"

### TC-110-14

| Item            | Content                                                                                                                                                                                                        |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Test Case ID    | TC-110-14                                                                                                                                                                                                      |
| Test Scenario   | [Positive] AC 8, AC 9: the rule is one function that SCRUM-81 can call inside its own transaction, reading one event in one query                                                                              |
| Pre-conditions  | A transaction client (as SCRUM-81 will pass).                                                                                                                                                                  |
| Test Steps      | 1. Call the rule with the transaction client. <br> 2. Check which event it read.                                                                                                                               |
| Test Data       | eventId `evt_planning`                                                                                                                                                                                         |
| Expected Result | Exactly one read, through the client it was given, for that event id. That no other story adds a competing confirmation gate is checked in code review: SCRUM-81 must import this rule rather than restate it. |

**Automated by:** `tests/unit/event-readiness.test.ts` › "SCRUM-110 [AC8, AC9] TC-110-14: reads the one event it is asked about, once, through the client it is given"
