# SCRUM-110 — See an event's readiness checklist: test cases

Story and acceptance criteria: [docs/backlog/SCRUM-110.md](../backlog/SCRUM-110.md)
(rewritten in Jira on 30 Sep 2026; criteria renumbered on 1 Oct, AC 4 simplified on 3 Oct and changed to name what is short on 4 Oct). Format and conventions: [README.md](README.md).
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

| Item          | Shown                                                                     | States                                                                                                                                                     |
| ------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Venue booking | Always; each Pending, Held or Approved booking is listed (SCRUM-162 AC 8) | Approved (complete) · Pending · Held until _time_ – confirm to secure · Approved for a different time · Rejected – _reason_ · Hold expired · Not requested |
| Equipment     | Always (SCRUM-170 AC 4)                                                   | Reserved (complete) · No equipment needed (complete) · Not fully reserved: _items_ · Awaiting Technical Support review · Rejected · Not decided            |
| Safety check  | Always (SCRUM-166 AC 9)                                                   | Approved (complete) · Awaiting review · Changes requested · Rejected · Outdated · Not requested                                                            |

When every item is complete and the event is in Planning, the checklist shows
**Ready to confirm**. The Organiser sees the same items and states, without
the reason after "Rejected".

Later stories superseded parts of the story (its "Superseded in part" note):
AC 1 and AC 2's single booking by SCRUM-162 AC 8, which lists every booking
([TC-162-12](SCRUM-162.md#tc-162-12), [TC-162-13](SCRUM-162.md#tc-162-13));
AC 2's states by SCRUM-163 AC 6, which adds Held and Expired
([TC-163-11](SCRUM-163.md#tc-163-11)); AC 3 by SCRUM-170 AC 4, so Equipment
is always listed ([TC-170-07](SCRUM-170.md#tc-170-07)); and AC 5 by SCRUM-166
AC 9, so Ready to confirm also needs an Approved safety check
([TC-166-10](SCRUM-166.md#tc-166-10)). The cases below keep the original
criteria where they still hold, and note where they don't.

| ID                      | Type     | Criterion        | Automated |
| ----------------------- | -------- | ---------------- | --------- |
| [TC-110-01](#tc-110-01) | Positive | AC 1, AC 3, AC 5 | Unit, e2e |
| [TC-110-02](#tc-110-02) | Negative | AC 2             | Unit      |
| [TC-110-03](#tc-110-03) | Negative | AC 2             | Unit      |
| [TC-110-04](#tc-110-04) | Negative | AC 2             | Unit, e2e |
| [TC-110-05](#tc-110-05) | Boundary | AC 1, AC 2       | Unit      |
| [TC-110-06](#tc-110-06) | Positive | AC 3, AC 5       | Unit, e2e |
| [TC-110-07](#tc-110-07) | Negative | AC 3, AC 4       | Unit, e2e |
| [TC-110-08](#tc-110-08) | Boundary | AC 3             | Unit      |
| [TC-110-09](#tc-110-09) | Boundary | AC 3, AC 4       | Unit      |
| [TC-110-10](#tc-110-10) | Negative | AC 5             | Unit      |
| [TC-110-11](#tc-110-11) | Positive | AC 6             | Unit, e2e |
| [TC-110-12](#tc-110-12) | Negative | AC 6             | Unit, e2e |
| [TC-110-13](#tc-110-13) | Negative | AC 6             | Unit      |
| [TC-110-14](#tc-110-14) | Boundary | AC 1, AC 2       | Unit      |
| [TC-110-15](#tc-110-15) | Negative | AC 4             | Unit      |

---

### TC-110-01

| Item            | Content                                                                                                                                                         |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Test Case ID    | TC-110-01                                                                                                                                                       |
| Test Scenario   | [Positive] AC 1, AC 3, AC 5: with the venue booking approved, No equipment needed recorded and the safety check Approved, every item is complete and the checklist shows "Ready to confirm" |
| Pre-conditions  | Signed in as the assigned Coordinator. The event has one approved venue booking, No equipment needed recorded and an Approved safety check (SCRUM-166 AC 9). |
| Test Steps      | 1. Open the event's details. <br> 2. Read the Readiness checklist.                                                                                              |
| Test Data       | Booking status APPROVED                                                                                                                                         |
| Expected Result | "Venue booking — Approved", marked complete. Since SCRUM-170 AC 4 (which supersedes AC 3), Equipment is always listed: with No equipment needed recorded it is complete, and without a decision it is "Not decided" and the event is not ready (TC-170-07, TC-170-08). "Safety check — Approved", complete (SCRUM-166 AC 9). "Ready to confirm" is shown. |

**Automated by:** `tests/unit/event-readiness.test.ts` › "SCRUM-110 [AC1, AC5] TC-110-01, SCRUM-170 [AC4] TC-170-08, SCRUM-166 [AC9]: …"; `e2e/readiness.spec.ts` › "SCRUM-110 [AC3, AC5, AC6] TC-110-01, TC-110-06: …"

### TC-110-02

| Item            | Content                                                                                                       |
| --------------- | ------------------------------------------------------------------------------------------------------------- |
| Test Case ID    | TC-110-02                                                                                                     |
| Test Scenario   | [Negative] AC 2: with no venue booking at all, Venue booking is still listed, as not requested and incomplete |
| Pre-conditions  | The event has no venue booking and no equipment request.                                                      |
| Test Steps      | 1. Open the event's details. <br> 2. Read the Readiness checklist.                                            |
| Test Data       | No bookings                                                                                                   |
| Expected Result | "Venue booking — Not requested", incomplete. "Ready to confirm" is not shown.                                 |

**Automated by:** `tests/unit/event-readiness.test.ts` › "SCRUM-110 [AC2] TC-110-02: …"

### TC-110-03

| Item            | Content                                                                    |
| --------------- | -------------------------------------------------------------------------- |
| Test Case ID    | TC-110-03                                                                  |
| Test Scenario   | [Negative] AC 2: a pending venue booking shows "Pending" and is incomplete |
| Pre-conditions  | The event's only venue booking is awaiting Venue Staff.                    |
| Test Steps      | 1. Open the event's details. <br> 2. Read the Readiness checklist.         |
| Test Data       | Booking status PENDING                                                     |
| Expected Result | "Venue booking — Pending", incomplete. Not ready.                          |

**Automated by:** `tests/unit/event-readiness.test.ts` › "SCRUM-110 [AC2] TC-110-03: …"

### TC-110-04

| Item            | Content                                                                                                    |
| --------------- | ---------------------------------------------------------------------------------------------------------- |
| Test Case ID    | TC-110-04                                                                                                  |
| Test Scenario   | [Negative] AC 2: a rejected venue booking shows "Rejected – _reason_" to the Coordinator and is incomplete |
| Pre-conditions  | Signed in as the assigned Coordinator. The event's only venue booking was rejected with a reason.          |
| Test Steps      | 1. Open the event's details. <br> 2. Read the Readiness checklist.                                         |
| Test Data       | Booking status REJECTED, reason "Boardroom seats 14; the event expects 55 attendees."                      |
| Expected Result | "Venue booking — Rejected – Boardroom seats 14; the event expects 55 attendees.", incomplete. Not ready.   |

**Automated by:** `tests/unit/event-readiness.test.ts` › "SCRUM-110 [AC2] TC-110-04: …"; `e2e/readiness.spec.ts` › "SCRUM-110 [AC2, AC3, AC6] TC-110-04, TC-110-07, TC-110-11, TC-110-12: …"

### TC-110-05

| Item            | Content                                                                                                                                                     |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Test Case ID    | TC-110-05                                                                                                                                                   |
| Test Scenario   | [Boundary] AC 1, AC 2: with several bookings, an approved one wins; otherwise a pending one; otherwise the latest rejection. Cancelled bookings are ignored. Since SCRUM-162 AC8, an approval beside a live Pending or Held booking doesn't complete the item ([TC-162-13](SCRUM-162.md#tc-162-13)) |
| Pre-conditions  | The event has more than one booking.                                                                                                                        |
| Test Steps      | 1. Read the checklist for each combination below.                                                                                                           |
| Test Data       | (a) REJECTED then APPROVED <br> (b) REJECTED then PENDING <br> (c) two REJECTED, reasons "old" then "new" <br> (d) only CANCELLED                           |
| Expected Result | (a) Approved, complete. (b) Pending. (c) Rejected – new. (d) Not requested.                                                                                 |

**Automated by:** `tests/unit/event-readiness.test.ts` › "SCRUM-110 [AC1, AC2] TC-110-05: …"

### TC-110-06

| Item            | Content                                                                                                                                                                                                               |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Test Case ID    | TC-110-06                                                                                                                                                                                                             |
| Test Scenario   | [Positive] AC 3, AC 5: when every requested line is reserved in full for the event's period, Equipment is complete and the event is ready                                                                             |
| Pre-conditions  | Venue booking approved. One equipment request for 5 Projectors and 2 Wireless Microphones. Confirmed reservations covering the whole event: 5 Projectors (in two reservations of 3 and 2) and 2 Wireless Microphones. |
| Test Steps      | 1. Open the event's details. <br> 2. Read the Readiness checklist.                                                                                                                                                    |
| Test Data       | Lines Projector × 5, Wireless Microphone × 2                                                                                                                                                                          |
| Expected Result | "Equipment — Reserved", complete. "Ready to confirm".                                                                                                                                                                 |

**Automated by:** `tests/unit/event-readiness.test.ts` › "SCRUM-110 [AC3, AC5] TC-110-06: …"; `e2e/readiness.spec.ts` › "SCRUM-110 [AC3, AC5, AC6] TC-110-01, TC-110-06: …"

### TC-110-07

| Item            | Content                                                                                             |
| --------------- | --------------------------------------------------------------------------------------------------- |
| Test Case ID    | TC-110-07                                                                                           |
| Test Scenario   | [Negative] AC 3, AC 4: a line reserved only in part leaves Equipment incomplete and names that item |
| Pre-conditions  | Venue booking approved. Request for 5 Projectors; 3 reserved for the whole event.                   |
| Test Steps      | 1. Open the event's details. <br> 2. Read the Readiness checklist.                                  |
| Test Data       | Line Projector × 5; reservation Projector × 3                                                       |
| Expected Result | "Equipment — Not fully reserved: Projector", incomplete. No count is shown. Not ready.              |

**Automated by:** `tests/unit/event-readiness.test.ts` › "SCRUM-110 [AC3, AC4] TC-110-07: …"; `e2e/readiness.spec.ts` › "SCRUM-110 [AC2, AC3, AC6] …"

### TC-110-08

| Item            | Content                                                                                                                                                                                |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Test Case ID    | TC-110-08                                                                                                                                                                              |
| Test Scenario   | [Boundary] AC 3: only a confirmed reservation of the requested item that covers the whole event period counts                                                                          |
| Pre-conditions  | Request for 2 Projectors. The event runs 09:00–17:00.                                                                                                                                  |
| Test Steps      | 1. Read the checklist for each reservation below.                                                                                                                                      |
| Test Data       | (a) 2 Projectors, exactly 09:00–17:00 <br> (b) 2 Projectors, 09:00–12:00 <br> (c) 2 Projectors, CANCELLED <br> (d) 2 Wireless Microphones, 09:00–17:00 <br> (e) the event has no dates |
| Expected Result | (a) "Equipment — Reserved", complete. (b)–(e) "Equipment — Not fully reserved: Projector", incomplete.                                                                                 |

**Automated by:** `tests/unit/event-readiness.test.ts` › "SCRUM-110 [AC3] TC-110-08: …"

### TC-110-09

| Item            | Content                                                                                                                                                                                                                                                                                                                                                                                                      |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Test Case ID    | TC-110-09                                                                                                                                                                                                                                                                                                                                                                                                    |
| Test Scenario   | [Boundary] AC 3, AC 4: which equipment requests count                                                                                                                                                                                                                                                                                                                                                        |
| Pre-conditions  | Venue booking approved. No reservations unless stated.                                                                                                                                                                                                                                                                                                                                                       |
| Test Steps      | 1. Read the checklist for each set of requests below.                                                                                                                                                                                                                                                                                                                                                        |
| Test Data       | (a) one CANCELLED request <br> (b) one REJECTED request <br> (c) a REJECTED request for 2 Projectors, then a new APPROVED request for 1 Laptop, with 1 Laptop reserved <br> (d) two APPROVED requests that both ask for Projectors (2 and 3), with 3 and then 5 reserved                                                                                                                                     |
| Expected Result | (a) Since SCRUM-170 AC 4, Equipment is "Not decided" and incomplete until the Coordinator decides (TC-170-07). (b) "Equipment — Rejected", incomplete, until the Coordinator requests again. (c) The rejected request is ignored: 1 Laptop reserved completes Equipment. (d) The two requests add up to 5 Projectors: 3 reserved is "Not fully reserved: Projector" (named once), 5 reserved is complete. A request still awaiting Technical Support's review is SCRUM-142 AC 10 (TC-142-18). |

**Automated by:** `tests/unit/event-readiness.test.ts` › "SCRUM-110 TC-110-09, SCRUM-170 [AC4] TC-170-07: …", "SCRUM-110 [AC4] TC-110-09: …" and "SCRUM-110 [AC3] TC-110-09: …"

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

**Automated by:** `tests/unit/readiness-actions.test.ts` › "SCRUM-110 [AC6] TC-110-11: …"; `e2e/readiness.spec.ts` › "SCRUM-110 [AC2, AC3, AC6] TC-110-04, TC-110-07, TC-110-11, TC-110-12: …"

### TC-110-12

| Item            | Content                                                                                                            |
| --------------- | ------------------------------------------------------------------------------------------------------------------ |
| Test Case ID    | TC-110-12                                                                                                          |
| Test Scenario   | [Negative] AC 6: the Organiser sees the item names and states but not internal reasons                             |
| Pre-conditions  | As TC-110-04.                                                                                                      |
| Test Steps      | 1. Sign in as `organiser@test.local`. <br> 2. Open the event's details.                                            |
| Test Data       | —                                                                                                                  |
| Expected Result | "Venue booking — Rejected" and "Equipment — Not fully reserved: Projector" are shown; the rejection reason is not. |

**Automated by:** `tests/unit/readiness-actions.test.ts` › "SCRUM-110 [AC6] TC-110-12: …"; `e2e/readiness.spec.ts` › "SCRUM-110 [AC2, AC3, AC6] TC-110-04, TC-110-07, TC-110-11, TC-110-12: …"

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

### TC-110-14

| Item            | Content                                                                                                                                                                                                                        |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Test Case ID    | TC-110-14                                                                                                                                                                                                                      |
| Test Scenario   | [Boundary] AC 1, AC 2: an approved venue booking completes the item only if it covers the whole event. One for another time, such as the old date after the event moved, shows "Approved for a different time"                 |
| Pre-conditions  | The event runs 09:00–17:00 on 1 Jun 2031.                                                                                                                                                                                      |
| Test Steps      | 1. Read the checklist for each booking below.                                                                                                                                                                                  |
| Test Data       | (a) APPROVED, exactly 09:00–17:00 <br> (b) APPROVED, 10:00–17:00 <br> (c) APPROVED, 09:00–12:00 <br> (d) APPROVED on another day <br> (e) (d), plus a newer PENDING booking for the right time <br> (f) the event has no dates |
| Expected Result | (a) Approved, complete, ready. (b)–(d), (f) "Approved for a different time", incomplete, not ready. (e) Pending.                                                                                                               |

**Automated by:** `tests/unit/event-readiness.test.ts` › "SCRUM-110 [AC1, AC2] TC-110-14: …" (both TC-110-14 tests)

### TC-110-15

| Item            | Content                                                                                                                                            |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Test Case ID    | TC-110-15                                                                                                                                          |
| Test Scenario   | [Negative] AC 4: every item not reserved in full is named, in the order requested, and an item reserved in full is not                             |
| Pre-conditions  | Venue booking approved. One request for 1 Projector, 2 Wireless Microphones and 1 Laptop; only the 2 microphones are reserved for the whole event. |
| Test Steps      | 1. Open the event's details. <br> 2. Read the Readiness checklist.                                                                                 |
| Test Data       | Lines Projector × 1, Wireless Microphone × 2, Laptop × 1; reservation Wireless Microphone × 2                                                      |
| Expected Result | "Equipment — Not fully reserved: Projector, Laptop", incomplete. Not ready.                                                                        |

**Automated by:** `tests/unit/event-readiness.test.ts` › "SCRUM-110 [AC4] TC-110-15: …"
