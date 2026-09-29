# SCRUM-110 — See an event's readiness checklist: test cases

Story and acceptance criteria: [docs/backlog/SCRUM-110.md](../backlog/SCRUM-110.md)
(rewritten in Jira on 30 Sep 2026). Format and conventions: [README.md](README.md).
The checklist is built by [lib/event-readiness.ts](../../lib/event-readiness.ts)
and served, per viewer, by
[app/(app)/events/readiness-actions.ts](<../../app/(app)/events/readiness-actions.ts>);
the decisions behind it are [ADR 0011](../adr/0011-event-readiness-checklist.md).

**Shared pre-conditions for every case:** the database is migrated and seeded
(`npm run db:deploy && npm run db:seed`) and the app is running. Unless the
case says otherwise, the event is in **Planning**, owned by
`organiser@test.local` and assigned to `coordinator@test.local` (both
`Password123!`), and runs on one day in 2031. The checklist appears in the
event's details window: **Events** → the event's row → **View Details**.

**What the checklist shows**

| Item          | Shown                                                              | States                                                                                                                 |
| ------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| Venue booking | Always                                                             | Approved (complete) · Pending · Rejected – _reason_ · Not requested                                                    |
| Equipment     | Only when the event has an equipment request that is not cancelled | Reserved (complete) · Not fully reserved, with one line per requested item such as "Projector 3/5 reserved" · Rejected |

When every item is complete and the event is in Planning, the checklist shows
**Ready to confirm**. The Organiser sees the same items and states, without
the reason after "Rejected".

| ID                      | Type     | Criterion        | Automated |
| ----------------------- | -------- | ---------------- | --------- |
| [TC-110-01](#tc-110-01) | Positive | AC 1, AC 2, AC 5 | Unit, e2e |
| [TC-110-02](#tc-110-02) | Negative | AC 1             | Unit      |
| [TC-110-03](#tc-110-03) | Negative | AC 3             | Unit      |
| [TC-110-04](#tc-110-04) | Negative | AC 3             | Unit, e2e |
| [TC-110-05](#tc-110-05) | Boundary | AC 1, AC 3       | Unit      |
| [TC-110-06](#tc-110-06) | Positive | AC 2, AC 5       | Unit, e2e |
| [TC-110-07](#tc-110-07) | Negative | AC 2, AC 4       | Unit, e2e |
| [TC-110-08](#tc-110-08) | Boundary | AC 2             | Unit      |
| [TC-110-09](#tc-110-09) | Boundary | AC 2             | Unit      |
| [TC-110-10](#tc-110-10) | Negative | AC 5             | Unit      |
| [TC-110-11](#tc-110-11) | Positive | AC 6             | Unit, e2e |
| [TC-110-12](#tc-110-12) | Negative | AC 6             | Unit, e2e |
| [TC-110-13](#tc-110-13) | Negative | AC 6             | Unit      |

---

### TC-110-01

| Item            | Content                                                                                                                                                         |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Test Case ID    | TC-110-01                                                                                                                                                       |
| Test Scenario   | [Positive] AC 1, AC 2, AC 5: with the venue booking approved and no equipment request, the checklist shows only Venue booking, complete, and "Ready to confirm" |
| Pre-conditions  | Signed in as the assigned Coordinator. The event has one approved venue booking and no equipment request.                                                       |
| Test Steps      | 1. Open the event's details. <br> 2. Read the Readiness checklist.                                                                                              |
| Test Data       | Booking status APPROVED                                                                                                                                         |
| Expected Result | "Venue booking — Approved", marked complete. No Equipment item. "Ready to confirm" is shown.                                                                    |

**Automated by:** `tests/unit/event-readiness.test.ts` › "SCRUM-110 [AC1, AC2, AC5] TC-110-01: …"; `e2e/readiness.spec.ts` › "SCRUM-110 [AC5, AC6] TC-110-01, TC-110-06: …"

### TC-110-02

| Item            | Content                                                                                                       |
| --------------- | ------------------------------------------------------------------------------------------------------------- |
| Test Case ID    | TC-110-02                                                                                                     |
| Test Scenario   | [Negative] AC 1: with no venue booking at all, Venue booking is still listed, as not requested and incomplete |
| Pre-conditions  | The event has no venue booking and no equipment request.                                                      |
| Test Steps      | 1. Open the event's details. <br> 2. Read the Readiness checklist.                                            |
| Test Data       | No bookings                                                                                                   |
| Expected Result | "Venue booking — Not requested", incomplete. "Ready to confirm" is not shown.                                 |

**Automated by:** `tests/unit/event-readiness.test.ts` › "SCRUM-110 [AC1] TC-110-02: …"

### TC-110-03

| Item            | Content                                                                    |
| --------------- | -------------------------------------------------------------------------- |
| Test Case ID    | TC-110-03                                                                  |
| Test Scenario   | [Negative] AC 3: a pending venue booking shows "Pending" and is incomplete |
| Pre-conditions  | The event's only venue booking is awaiting Venue Staff.                    |
| Test Steps      | 1. Open the event's details. <br> 2. Read the Readiness checklist.         |
| Test Data       | Booking status PENDING                                                     |
| Expected Result | "Venue booking — Pending", incomplete. Not ready.                          |

**Automated by:** `tests/unit/event-readiness.test.ts` › "SCRUM-110 [AC3] TC-110-03: …"

### TC-110-04

| Item            | Content                                                                                                    |
| --------------- | ---------------------------------------------------------------------------------------------------------- |
| Test Case ID    | TC-110-04                                                                                                  |
| Test Scenario   | [Negative] AC 3: a rejected venue booking shows "Rejected – _reason_" to the Coordinator and is incomplete |
| Pre-conditions  | Signed in as the assigned Coordinator. The event's only venue booking was rejected with a reason.          |
| Test Steps      | 1. Open the event's details. <br> 2. Read the Readiness checklist.                                         |
| Test Data       | Booking status REJECTED, reason "Boardroom seats 14; the event expects 55 attendees."                      |
| Expected Result | "Venue booking — Rejected – Boardroom seats 14; the event expects 55 attendees.", incomplete. Not ready.   |

**Automated by:** `tests/unit/event-readiness.test.ts` › "SCRUM-110 [AC3] TC-110-04: …"; `e2e/readiness.spec.ts` › "SCRUM-110 [AC3, AC4, AC6] TC-110-04, TC-110-07, TC-110-11, TC-110-12: …"

### TC-110-05

| Item            | Content                                                                                                                                                     |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Test Case ID    | TC-110-05                                                                                                                                                   |
| Test Scenario   | [Boundary] AC 1, AC 3: with several bookings, an approved one wins; otherwise a pending one; otherwise the latest rejection. Cancelled bookings are ignored |
| Pre-conditions  | The event has more than one booking.                                                                                                                        |
| Test Steps      | 1. Read the checklist for each combination below.                                                                                                           |
| Test Data       | (a) REJECTED then APPROVED <br> (b) REJECTED then PENDING <br> (c) two REJECTED, reasons "old" then "new" <br> (d) only CANCELLED                           |
| Expected Result | (a) Approved, complete. (b) Pending. (c) Rejected – new. (d) Not requested.                                                                                 |

**Automated by:** `tests/unit/event-readiness.test.ts` › "SCRUM-110 [AC1, AC3] TC-110-05: …"

### TC-110-06

| Item            | Content                                                                                                                                                                                                               |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Test Case ID    | TC-110-06                                                                                                                                                                                                             |
| Test Scenario   | [Positive] AC 2, AC 5: when every requested line is reserved in full for the event's period, Equipment is complete and the event is ready                                                                             |
| Pre-conditions  | Venue booking approved. One equipment request for 5 Projectors and 2 Wireless Microphones. Confirmed reservations covering the whole event: 5 Projectors (in two reservations of 3 and 2) and 2 Wireless Microphones. |
| Test Steps      | 1. Open the event's details. <br> 2. Read the Readiness checklist.                                                                                                                                                    |
| Test Data       | Lines Projector × 5, Wireless Microphone × 2                                                                                                                                                                          |
| Expected Result | "Equipment — Reserved", with "Projector 5/5 reserved" and "Wireless Microphone 2/2 reserved", complete. "Ready to confirm".                                                                                           |

**Automated by:** `tests/unit/event-readiness.test.ts` › "SCRUM-110 [AC2, AC5] TC-110-06: …"; `e2e/readiness.spec.ts` › "SCRUM-110 [AC5, AC6] TC-110-01, TC-110-06: …"

### TC-110-07

| Item            | Content                                                                                              |
| --------------- | ---------------------------------------------------------------------------------------------------- |
| Test Case ID    | TC-110-07                                                                                            |
| Test Scenario   | [Negative] AC 2, AC 4: a line reserved only in part shows its shortfall, and Equipment is incomplete |
| Pre-conditions  | Venue booking approved. Request for 5 Projectors; 3 reserved for the whole event.                    |
| Test Steps      | 1. Open the event's details. <br> 2. Read the Readiness checklist.                                   |
| Test Data       | Line Projector × 5; reservation Projector × 3                                                        |
| Expected Result | "Equipment — Not fully reserved", with "Projector 3/5 reserved". Not ready.                          |

**Automated by:** `tests/unit/event-readiness.test.ts` › "SCRUM-110 [AC2, AC4] TC-110-07: …"; `e2e/readiness.spec.ts` › "SCRUM-110 [AC3, AC4, AC6] …"

### TC-110-08

| Item            | Content                                                                                                                                                                                |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Test Case ID    | TC-110-08                                                                                                                                                                              |
| Test Scenario   | [Boundary] AC 2: only a confirmed reservation of the requested item that covers the whole event period counts                                                                          |
| Pre-conditions  | Request for 2 Projectors. The event runs 09:00–17:00.                                                                                                                                  |
| Test Steps      | 1. Read the checklist for each reservation below.                                                                                                                                      |
| Test Data       | (a) 2 Projectors, exactly 09:00–17:00 <br> (b) 2 Projectors, 09:00–12:00 <br> (c) 2 Projectors, CANCELLED <br> (d) 2 Wireless Microphones, 09:00–17:00 <br> (e) the event has no dates |
| Expected Result | (a) "Projector 2/2 reserved", complete. (b)–(e) "Projector 0/2 reserved", incomplete.                                                                                                  |

**Automated by:** `tests/unit/event-readiness.test.ts` › "SCRUM-110 [AC2] TC-110-08: …"

### TC-110-09

| Item            | Content                                                                                                                                                                                                         |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Test Case ID    | TC-110-09                                                                                                                                                                                                       |
| Test Scenario   | [Boundary] AC 2: which equipment requests count                                                                                                                                                                 |
| Pre-conditions  | Venue booking approved. No reservations unless stated.                                                                                                                                                          |
| Test Steps      | 1. Read the checklist for each set of requests below.                                                                                                                                                           |
| Test Data       | (a) one CANCELLED request <br> (b) one REJECTED request <br> (c) a REJECTED request, then a new PENDING_REVIEW request for 1 Laptop <br> (d) two live requests that both ask for Projectors (2 and 3)           |
| Expected Result | (a) No Equipment item; ready. (b) "Equipment — Rejected", incomplete, until the Coordinator requests again. (c) The rejected request is ignored: "Laptop 0/1 reserved". (d) One line, "Projector 0/5 reserved". |

**Automated by:** `tests/unit/event-readiness.test.ts` › "SCRUM-110 [AC2] TC-110-09: …"

### TC-110-10

| Item            | Content                                                                                                |
| --------------- | ------------------------------------------------------------------------------------------------------ |
| Test Case ID    | TC-110-10                                                                                              |
| Test Scenario   | [Negative] AC 5: only an event in Planning can be "Ready to confirm", even when every item is complete |
| Pre-conditions  | Venue booking approved, no equipment request.                                                          |
| Test Steps      | 1. Read the checklist with the event in each status other than Planning.                               |
| Test Data       | APPROVED, CONFIRMED, UNDER_REVIEW, …                                                                   |
| Expected Result | Items as in TC-110-01, but not ready.                                                                  |

**Automated by:** `tests/unit/event-readiness.test.ts` › "SCRUM-110 [AC5] TC-110-10: …"

### TC-110-11

| Item            | Content                                                                                               |
| --------------- | ----------------------------------------------------------------------------------------------------- |
| Test Case ID    | TC-110-11                                                                                             |
| Test Scenario   | [Positive] AC 6: the assigned Coordinator sees the checklist on the event page, with internal reasons |
| Pre-conditions  | As TC-110-04.                                                                                         |
| Test Steps      | 1. Sign in as `coordinator@test.local`. <br> 2. Open the event's details.                             |
| Test Data       | —                                                                                                     |
| Expected Result | The Readiness checklist is shown, including the rejection reason.                                     |

**Automated by:** `tests/unit/readiness-actions.test.ts` › "SCRUM-110 [AC6] TC-110-11: …"; `e2e/readiness.spec.ts` › "SCRUM-110 [AC3, AC4, AC6] …"

### TC-110-12

| Item            | Content                                                                                    |
| --------------- | ------------------------------------------------------------------------------------------ |
| Test Case ID    | TC-110-12                                                                                  |
| Test Scenario   | [Negative] AC 6: the Organiser sees the item names and states but not internal reasons     |
| Pre-conditions  | As TC-110-04.                                                                              |
| Test Steps      | 1. Sign in as `organiser@test.local`. <br> 2. Open the event's details.                    |
| Test Data       | —                                                                                          |
| Expected Result | "Venue booking — Rejected" and the equipment lines are shown; the rejection reason is not. |

**Automated by:** `tests/unit/readiness-actions.test.ts` › "SCRUM-110 [AC6] TC-110-12: …"; `e2e/readiness.spec.ts` › "SCRUM-110 [AC3, AC4, AC6] …"

### TC-110-13

| Item            | Content                                                                                                                                      |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Test Case ID    | TC-110-13                                                                                                                                    |
| Test Scenario   | [Negative] AC 6: anyone who is neither the event's Organiser nor its Coordinator cannot read the checklist, and cannot tell the event exists |
| Pre-conditions  | Signed in as another Organiser, Venue Staff, Technical Support or an Attendee; or signed out.                                                |
| Test Steps      | 1. Ask for the event's checklist.                                                                                                            |
| Test Data       | eventId of the test event; also an id that matches no event                                                                                  |
| Expected Result | "Event not found." in every case, identical for a real and a missing event.                                                                  |

**Automated by:** `tests/unit/readiness-actions.test.ts` › "SCRUM-110 [AC6] TC-110-13: …"
