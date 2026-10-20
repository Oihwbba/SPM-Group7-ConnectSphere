# SCRUM-53 — Approve or Reject Booking Request: test cases

Story and acceptance criteria: [docs/backlog/SCRUM-53.md](../backlog/SCRUM-53.md).
Format and conventions: [README.md](README.md). Why the database, not the
application, settles simultaneous approvals:
[ADR 0010](../adr/0010-database-prevents-venue-double-booking.md).

> **Week 7 (SCRUM-158).** AC 1 and AC 7 know only Approve and Reject, and AC 4–AC 6 and AC 8 compare bare periods. SCRUM-163 adds the Held and Expired outcomes (replacing AC 1 and AC 7), and SCRUM-159 compares AC 4–AC 6 and AC 8 against occupied periods. The cases below test the behaviour as built before those stories land.

**Shared pre-conditions for every case:** the database is migrated and seeded,
the app is running, and the tester signs in as Venue Staff
(`venuestaff@test.local` / `Password123!`) unless the case says otherwise.

| ID | Type | Criterion | Automated |
|---|---|---|---|
| [TC-53-01](#tc-53-01) | Positive | AC 1, AC 4 | Unit, integration, e2e |
| [TC-53-02](#tc-53-02) | Positive | AC 1, AC 2 | Unit, integration, e2e |
| [TC-53-03](#tc-53-03) | Negative | AC 2 | Unit, integration, e2e |
| [TC-53-04](#tc-53-04) | Negative | AC 8 (sequential) | Unit, integration |
| [TC-53-05](#tc-53-05) | Concurrency | AC 5 | Unit, integration |
| [TC-53-06](#tc-53-06) | Boundary, Concurrency | AC 6 | Integration |
| [TC-53-07](#tc-53-07) | Negative | AC 7 | Unit, integration |
| [TC-53-08](#tc-53-08) | Negative | Venue Staff only | Unit |
| [TC-53-09](#tc-53-09) | Positive | AC 9 | Integration |

**Criteria with no case of their own:**

- **AC 3** (suggest an alternative in the reason): the suggestion is written in
  the free-text reason that TC-53-02 saves; there is no separate field to test.
- **AC 10** (the Coordinator sees the decision and reason on the readiness
  checklist) is shown by SCRUM-110's checklist:
  [TC-110-04](SCRUM-110.md#tc-110-04) shows the Coordinator a rejected booking
  as "Rejected – _reason_", and [TC-110-01](SCRUM-110.md#tc-110-01) an approved
  one as complete. Those tests write the decided booking directly, not through
  the decision action.

---

### TC-53-01

| Item | Content |
|---|---|
| Test Case ID | TC-53-01 |
| Test Scenario | [Positive] AC 1, AC 4: approving makes the venue unavailable for that period |
| Pre-conditions | TC-50-01 is pending. |
| Test Steps | 1. Open **Bookings**. <br> 2. Click **Approve** on the request. <br> 3. As the Coordinator, request an overlapping period (TC-50-02). |
| Test Data | As TC-50-01 |
| Expected Result | "Approved: Exhibition Hall is now booked for …" and the card leaves the queue. The booking is APPROVED with the deciding user and time, and one audit entry is written. Step 3 is refused. The availability calendar (SCRUM-36) arrives in the next pull request; until then, the refusal is the evidence. |

**Automated by:** `tests/integration/bookings.test.ts` › "SCRUM-53 [AC1, AC4] TC-53-01: approving makes the venue unavailable: a later overlapping request is refused"; `tests/unit/bookings.test.ts` › "SCRUM-53 [AC1, AC4] TC-53-01: approving sets the request APPROVED and records who decided, when, and an audit entry"; `e2e/bookings.spec.ts` › "SCRUM-50 [AC2], SCRUM-52 [AC1-AC3], SCRUM-53 [AC1, AC4]: a coordinator requests, staff approve, and the venue becomes unavailable"

### TC-53-02

| Item | Content |
|---|---|
| Test Case ID | TC-53-02 |
| Test Scenario | [Positive] AC 1, AC 2: rejecting with a free-text reason saves the rejection and the reason |
| Pre-conditions | A pending request. |
| Test Steps | 1. Click **Reject**. <br> 2. Type a reason. <br> 3. Click **Reject request**. |
| Test Data | Reason: "The hall is set for an exhibition that week." |
| Expected Result | "Rejected the request for …". The booking is REJECTED with the trimmed reason, the deciding user and time, and one audit entry. |

**Automated by:** `tests/integration/bookings.test.ts` › "SCRUM-53 [AC1, AC2] TC-53-02: rejecting with a reason saves the rejection, the reason, and an audit entry"; `tests/unit/bookings.test.ts` › "SCRUM-53 [AC2] TC-53-02: rejecting saves the trimmed free-text reason"; `e2e/bookings.spec.ts` › "SCRUM-53 [AC2] TC-53-02, TC-53-03: rejecting needs a written reason, and the reason is saved"

### TC-53-03

| Item | Content |
|---|---|
| Test Case ID | TC-53-03 |
| Test Scenario | [Negative] AC 2: a rejection cannot be saved without a reason |
| Pre-conditions | A pending request. |
| Test Steps | 1. Click **Reject**. <br> 2. Leave the reason blank, then enter only spaces. |
| Test Data | "", "   " |
| Expected Result | **Reject request** stays disabled. Called directly, the action refuses with "A reason is required to reject a booking request." and the database's `booking_rejection_has_reason` check refuses too. The request stays pending. |

**Automated by:** `tests/integration/bookings.test.ts` › "SCRUM-53 [AC2] TC-53-03: rejecting with a blank reason is refused and the request stays pending" and "SCRUM-53 [AC2] TC-53-03: the database itself refuses a rejection without a reason"; `tests/unit/bookings.test.ts` › "SCRUM-53 [AC2] TC-53-03: rejecting with a blank reason is refused and nothing is read or written"; `e2e/bookings.spec.ts` › "SCRUM-53 [AC2] TC-53-02, TC-53-03: …"

### TC-53-04

| Item | Content |
|---|---|
| Test Case ID | TC-53-04 |
| Test Scenario | [Negative] AC 8: approving over an approved booking or recorded unavailability is returned as conflicting |
| Pre-conditions | Two pending requests overlapping on one venue; one is approved. Or: maintenance recorded over the pending request. |
| Test Steps | 1. Approve the second request. |
| Test Data | — |
| Expected Result | "Conflicting: … is already booked from … to …. This request is still pending." (or "unavailable (maintenance) …"). The request stays pending so it can be rejected with a reason. |

**Automated by:** `tests/integration/bookings.test.ts` › "SCRUM-53 [AC8] TC-53-04: approving a request that overlaps an already-approved booking is returned as conflicting" and "SCRUM-53 [AC8] TC-53-04: approving over recorded unavailability is returned as conflicting"; `tests/unit/bookings.test.ts` › "SCRUM-53 [AC8] TC-53-04: approving over an approved booking or recorded unavailability is returned as conflicting"

### TC-53-05

| Item | Content |
|---|---|
| Test Case ID | TC-53-05 |
| Test Scenario | [Concurrency] AC 5: two staff approve overlapping requests at the same moment; exactly one succeeds and the venue is never double-booked |
| Pre-conditions | Real PostgreSQL. Two pending requests on one venue, 10:00–14:00 and 12:00–16:00. Two Venue Staff users. |
| Test Steps | 1. Both approve at once. The test holds each approval after the application's own conflict check until both have passed it, so only the database can separate them. <br> 2. Separately, approve both with raw SQL in two open transactions, bypassing the application. |
| Test Data | — |
| Expected Result | One approval succeeds. The other returns "Conflicting: …" and stays pending. Exactly one APPROVED row and one audit entry exist. In step 2 the second transaction fails on `booking_no_double_booking`. Dropping the constraint makes both tests fail (verified 2026-09-27). |

**Automated by:** `tests/integration/concurrency.test.ts` › "SCRUM-53 [AC5] TC-53-05: two staff approve overlapping requests at the same moment: one succeeds, one is returned as conflicting" and "SCRUM-53 [AC5] TC-53-05: the database alone refuses the second of two simultaneous overlapping approvals, however the rows are written"; `tests/unit/bookings.test.ts` › "SCRUM-53 [AC5] TC-53-05: when the database refuses a simultaneous overlapping approval, it is returned as conflicting" and "SCRUM-53 [AC5] TC-53-05: a deadlock between simultaneous approvals is retried once"

### TC-53-06

| Item | Content |
|---|---|
| Test Case ID | TC-53-06 |
| Test Scenario | [Boundary, Concurrency] AC 6: requests that touch at an endpoint can both be approved, one after the other or at once |
| Pre-conditions | Two pending requests, 10:00–14:00 and 14:00–18:00, same venue. |
| Test Steps | 1. Approve both. |
| Test Data | — |
| Expected Result | Both are APPROVED. |

**Automated by:** `tests/integration/bookings.test.ts` › "SCRUM-53 [AC6] TC-53-06: two requests that touch at an endpoint can both be approved"; `tests/integration/concurrency.test.ts` › "SCRUM-53 [AC6] TC-53-06: two staff approve requests that touch at an endpoint at the same moment: both succeed"

### TC-53-07

| Item | Content |
|---|---|
| Test Case ID | TC-53-07 |
| Test Scenario | [Negative] AC 7: a request already approved or rejected keeps its first decision |
| Pre-conditions | A request that has been decided. |
| Test Steps | 1. Submit the opposite decision for it. <br> 2. Separately, approve and reject one pending request at the same instant. |
| Test Data | — |
| Expected Result | "This request has already been approved; the original decision stands." (or "rejected"). Status, reason and the single audit entry are unchanged. In step 2 exactly one decision and one audit entry are recorded. |

**Automated by:** `tests/integration/bookings.test.ts` › "SCRUM-53 [AC7] TC-53-07: deciding an already-approved request leaves the approval standing and records no second outcome", "SCRUM-53 [AC7] TC-53-07: deciding an already-rejected request leaves the rejection standing" and "SCRUM-53 [AC7] TC-53-07: an approve and a reject of the same request at the same instant: exactly one outcome is recorded"; `tests/unit/bookings.test.ts` › both "SCRUM-53 [AC7] TC-53-07: …" cases

### TC-53-08

| Item | Content |
|---|---|
| Test Case ID | TC-53-08 |
| Test Scenario | [Negative] Only Venue Staff may decide |
| Pre-conditions | — |
| Test Steps | 1. Call the decision action as each other role. |
| Test Data | — |
| Expected Result | "You do not have permission to do that." Nothing is written. |

**Automated by:** `tests/unit/bookings.test.ts` › "SCRUM-53 TC-53-08: every role except Venue Staff is refused"; `tests/unit/auth.test.ts` › "SCRUM-53 TC-53-08: only venue staff may approve or reject a request"

### TC-53-09

| Item | Content |
|---|---|
| Test Case ID | TC-53-09 |
| Test Scenario | [Positive] AC 9: after a booking is rejected, the event stays in Planning and the Coordinator can request a venue again, which creates a new booking record |
| Pre-conditions | A pending request for a Planning event (TC-50-01). |
| Test Steps | 1. As Venue Staff, reject the request with a reason. <br> 2. As the Coordinator, open the event. <br> 3. Request a venue for the event again. |
| Test Data | Reason: "The hall is set for an exhibition that week." |
| Expected Result | Step 2: the event is still Planning. Step 3: a new PENDING booking is created with a new id, and the rejected booking is kept with its reason. |

**Automated by:** `tests/integration/bookings.test.ts` › "SCRUM-53 [AC9] TC-53-09: after Venue Staff reject a request, the event stays in Planning and asking again creates a new booking; the rejected one keeps its reason" (the rejection goes through the decision action). SCRUM-50's TC-50-14 covers asking again after a cancellation too.
