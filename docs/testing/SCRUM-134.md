# SCRUM-134 — Decide competing venue and equipment requests in the order they were made: test cases

Story and acceptance criteria: [docs/backlog/SCRUM-134.md](../backlog/SCRUM-134.md).
Format and conventions: [README.md](README.md).

Two Pending venue requests compete when they are for the same venue and
their occupied periods (SCRUM-159) overlap; two open equipment requests
(Pending Review, In Review or Approved) compete when they ask for the same
type and their events overlap. The earlier submission comes first; requests
submitted in the same instant are ordered by id. Built by
`findCompetingRequests` in [lib/venue-availability.ts](../../lib/venue-availability.ts),
[lib/equipment/competing.ts](../../lib/equipment/competing.ts), and the
checks in `decideBookingRequest`, `holdBookingRequest` and
`reserveEquipmentRequest`.

**Shared pre-conditions for every case:** the database is migrated and
seeded. Two Planning events at the same time, each with a request: the
"earlier" one submitted on 1 Jan, the "later" one on 2 Jan. Venue Staff are
signed in as `venuestaff@test.local`, Technical Support as
`techsupport@test.local` (`Password123!`). For equipment, a pool of 4 units
of one type.

| ID | Type | Criterion | Automated |
|---|---|---|---|
| [TC-134-01](#tc-134-01) | Positive | AC 1 | Unit, integration, e2e |
| [TC-134-02](#tc-134-02) | Negative | AC 2 | Unit, integration, e2e |
| [TC-134-03](#tc-134-03) | Boundary | AC 3 | Unit, integration |
| [TC-134-04](#tc-134-04) | Positive | AC 4 | Unit, integration |
| [TC-134-05](#tc-134-05) | Negative, Boundary | AC 5 | Unit, integration |
| [TC-134-06](#tc-134-06) | Positive | AC 6 | Unit, integration, e2e |

---

### TC-134-01

| Item | Content |
|---|---|
| Test Case ID | TC-134-01 |
| Test Scenario | [Positive] AC 1: a pending venue request shows every other Pending request for the venue whose occupied period overlaps it, with when each was submitted |
| Pre-conditions | Both requests are Pending, for the Exhibition Hall, at overlapping times. |
| Test Steps | 1. Open Bookings. <br> 2. Read each request's card. |
| Test Data | — |
| Expected Result | The later request's card lists "Competing requests": '"[earlier event]", submitted 1 Jan 2036, 9:00 am SGT — earlier, so decide it first'. The earlier one's card lists the later one, marked "— later". A request with no competitor shows no such list, and a hold lists none. |

**Automated by:** `tests/unit/first-come.test.ts` › "SCRUM-134 [AC1, AC3] TC-134-01, TC-134-03: lists the other Pending requests whose occupied periods overlap, not ones that only touch" and "SCRUM-134 [AC1] TC-134-01: each pending request carries its competitors, marked earlier or later; a hold carries none"; `tests/unit/booking-queue.test.tsx` › the two "SCRUM-134 … TC-134-01" tests; `tests/integration/first-come.test.ts` › "SCRUM-134 [AC1] TC-134-01: the queue shows each pending request's competitors with when they were submitted, the earlier marked"; `e2e/first-come.spec.ts` › "SCRUM-134 [AC1, AC2, AC6] TC-134-01, TC-134-02, TC-134-06: the later request shows the earlier one, can't be approved before it, and the earlier is approved first"

### TC-134-02

| Item | Content |
|---|---|
| Test Case ID | TC-134-02 |
| Test Scenario | [Negative] AC 2: the later of two competing requests can't be approved or held while the earlier is Pending; a Held booking blocks later requests like an Approved one |
| Pre-conditions | As TC-134-01. |
| Test Steps | 1. Approve the later request. <br> 2. Hold it instead. <br> 3. Approve the earlier request, then the later again. <br> 4. Approve both at the same moment. |
| Test Data | — |
| Expected Result | 1–2: 'An earlier request for Exhibition Hall overlapping this period is still pending: "[earlier event]", submitted [time]. Approve, hold or reject it first. This request is still pending.'; nothing is written. 3: the earlier is approved; the later is then refused as conflicting (SCRUM-53). 4: the earlier is approved and the later refused. |

**Automated by:** `tests/unit/first-come.test.ts` › "SCRUM-134 [AC2] TC-134-02: approving the later of two competing requests is refused, and nothing is written", "SCRUM-134 [AC2] TC-134-02: holding the later of two competing requests is refused, and nothing is written", "SCRUM-134 [AC2] TC-134-02: the earlier request can be approved with a later one still pending" and "SCRUM-134 [AC2] TC-134-02: the earlier submission comes first, and the id settles a tie"; `tests/integration/first-come.test.ts` › "SCRUM-134 [AC2] TC-134-02: the later of two overlapping requests can't be approved while the earlier is pending; once the earlier is approved, the later conflicts"; `tests/integration/concurrency.test.ts` › "SCRUM-53 [AC5] TC-53-05: two staff approve overlapping requests at the same moment: one succeeds, one is returned as conflicting" (step 4); `e2e/first-come.spec.ts` › "SCRUM-134 [AC1, AC2, AC6] TC-134-01, TC-134-02, TC-134-06: …"

### TC-134-03

| Item | Content |
|---|---|
| Test Case ID | TC-134-03 |
| Test Scenario | [Boundary] AC 3: requests whose occupied periods only touch at an endpoint don't compete |
| Pre-conditions | The earlier request ends exactly when the later one starts, and the venue has no setup or turnaround time. |
| Test Steps | 1. Approve the later request. <br> 2. Give the venue 30 minutes of turnaround, and look again. |
| Test Data | — |
| Expected Result | 1: approved, since they don't compete. 2: their occupied periods now overlap, so they compete (SCRUM-159). |

**Automated by:** `tests/unit/first-come.test.ts` › "SCRUM-134 [AC1, AC3] TC-134-01, TC-134-03: …" and "SCRUM-134 [AC1, AC3] TC-134-03: with the venue's setup and turnaround, requests that touched now compete (SCRUM-159)"; `tests/integration/first-come.test.ts` › "SCRUM-134 [AC3] TC-134-03: requests that only touch don't compete"

### TC-134-04

| Item | Content |
|---|---|
| Test Case ID | TC-134-04 |
| Test Scenario | [Positive] AC 4: an equipment request's line shows the other open requests for the type whose events overlap, with when each was submitted and how much is reserved for it |
| Pre-conditions | Two Approved requests for the type: the earlier asks for 3, the later for 2. 3 are reserved for the earlier. |
| Test Steps | 1. Open Equipment Requests and read each line. |
| Test Data | — |
| Expected Result | The later request's line: "Also wanted for overlapping events, earliest first:" '"[earlier event]", submitted 1 Jan 2036, 8:00 am SGT: 3 requested, 3 reserved'. The earlier one's line lists the later one with 0 reserved. Requests whose events only touch, for other types, or that are rejected or cancelled, are not listed. |

**Automated by:** `tests/unit/first-come.test.ts` › "SCRUM-134 [AC4] TC-134-04: other open requests for the type whose events overlap, earliest first; touching events, other types and the request itself are left out" and "SCRUM-134 [AC4] TC-134-04: reads each open request's lines with how much is reserved for each, from Pending Review, In Review and Approved requests with a dated event"; `tests/integration/first-come.test.ts` › "SCRUM-134 [AC4] TC-134-04: the review queue shows, on each line, the other open requests for the type with when they were submitted and what is reserved"

### TC-134-05

| Item | Content |
|---|---|
| Test Case ID | TC-134-05 |
| Test Scenario | [Negative, Boundary] AC 5: reserving for a later request is refused when it would leave too little for an earlier open request whose event overlaps, until that one is reserved in full, rejected or cancelled |
| Pre-conditions | As TC-134-04, nothing reserved yet. |
| Test Steps | 1. Reserve 2 for the later request. <br> 2. With 1 already reserved for the earlier, reserve 2 for the later. <br> 3. Reserve 3 for the earlier request, then 2 for the later. <br> 4. Reject the earlier request, then reserve 2 for the later. |
| Test Data | — |
| Expected Result | 1: "Nothing was reserved: an earlier request comes first for the rows marked below." with 'Reserving 2 would leave 2 free, but an earlier request still needs 3: "[earlier event]", submitted [time]. Reserve it first, or wait until it is rejected or cancelled.' Nothing is reserved. 2: allowed, since exactly what the earlier still needs is left. 3: the earlier is reserved; the later is then short (SCRUM-155). 4: reserved. |

**Automated by:** `tests/unit/first-come.test.ts` › the three "SCRUM-134 [AC5] TC-134-05" tests; `tests/integration/first-come.test.ts` › "SCRUM-134 [AC5] TC-134-05: stock can't be reserved for a later request while an earlier one still needs it; once the earlier is reserved, the later fits what is left or not" and "SCRUM-134 [AC5] TC-134-05: once the earlier request is rejected, the later one is reserved"

### TC-134-06

| Item | Content |
|---|---|
| Test Case ID | TC-134-06 |
| Test Scenario | [Positive] AC 6: rejecting a request is never blocked by this rule |
| Pre-conditions | As TC-134-01. |
| Test Steps | 1. Reject the later request while the earlier is Pending. <br> 2. On another pair, reject the earlier, then approve the later. |
| Test Data | Reason "The hall went to an earlier request." |
| Expected Result | 1: rejected. 2: the earlier is rejected and the later is then approved. |

**Automated by:** `tests/unit/first-come.test.ts` › "SCRUM-134 [AC6] TC-134-06: rejecting the later request is never blocked, and the lookup isn't even made"; `tests/integration/first-come.test.ts` › "SCRUM-134 [AC6] TC-134-06: the later request can be rejected while the earlier is pending, and the earlier rejected, after which the later can be approved"; `e2e/first-come.spec.ts` › "SCRUM-134 [AC1, AC2, AC6] TC-134-01, TC-134-02, TC-134-06: …"
