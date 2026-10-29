# SCRUM-142 — Change equipment lines or withdraw a venue request before confirmation: test cases

Story and acceptance criteria: [docs/backlog/SCRUM-142.md](../backlog/SCRUM-142.md).
Format and conventions: [README.md](README.md).

**Shared pre-conditions for every case:** a local PostgreSQL migrated with
`npm run db:deploy` and seeded with `npm run db:seed`. Accounts use the
password `Password123!`. Each automated case makes its own Planning event,
assigned to a seeded Coordinator, with an Approved equipment request for
Projector × 2, Microphone × 3 and Lectern × 1, each reserved, or with its own
venue requests; the suite removes them.

| ID | Type | Criterion | Automated |
|---|---|---|---|
| [TC-142-01](#tc-142-01) | Positive | AC 1, AC 7 | Unit, integration, e2e |
| [TC-142-02](#tc-142-02) | Positive | AC 2 | Integration, e2e |
| [TC-142-03](#tc-142-03) | Boundary | AC 1 | Integration |
| [TC-142-04](#tc-142-04) | Boundary | AC 8 | Integration |
| [TC-142-05](#tc-142-05) | Positive, Negative | AC 3, AC 7, AC 8 | Unit, integration, e2e |
| [TC-142-06](#tc-142-06) | Negative | AC 3 | Integration |
| [TC-142-07](#tc-142-07) | Positive, Negative | AC 4, AC 7, AC 8 | Unit, integration, e2e |
| [TC-142-08](#tc-142-08) | Positive | AC 4 | Integration |
| [TC-142-09](#tc-142-09) | Negative | AC 5 | Unit, integration, e2e |
| [TC-142-10](#tc-142-10) | Negative | AC 6 | Integration |
| [TC-142-11](#tc-142-11) | Negative | AC 7 | Unit, integration |
| [TC-142-12](#tc-142-12) | Positive, Negative | AC 9 | Integration |
| [TC-142-13](#tc-142-13) | Concurrency | AC 3, AC 8 | Unit, integration |
| [TC-142-14](#tc-142-14) | Negative | AC 1 | Integration |
| [TC-142-15](#tc-142-15) | Negative | AC 1, AC 3, AC 4 | Unit, e2e |
| [TC-142-16](#tc-142-16) | Concurrency | AC 5 | Unit, integration |
| [TC-142-17](#tc-142-17) | Negative | AC 1, AC 2 | Integration |
| [TC-142-18](#tc-142-18) | Positive, Negative | AC 10 | Unit, integration, e2e |
| [TC-142-19](#tc-142-19) | Positive, Negative | AC 2, AC 10 | Unit, integration |

---

### TC-142-01

| Item | Content |
|---|---|
| Test Case ID | TC-142-01 |
| Test Scenario | [Positive] AC 1, AC 7: changing an equipment request's lines sends it back to Pending Review, records it, and tells Technical Support |
| Pre-conditions | Signed in as the event's Coordinator; the request is Approved. |
| Test Steps | 1. On Equipment Requests, choose Change lines. <br> 2. Keep Projector × 2, change Microphone to 4, remove Lectern and add Laptop × 1. <br> 3. Save changes. |
| Test Data | `coordinator@test.local` |
| Expected Result | The request is Pending Review, with Projector × 2, Microphone × 4 and Laptop × 1; Lectern is kept marked removed. Its history has one entry, Approved → Pending Review: "Changed by the Coordinator: added Laptop × 1; Microphone 3 → 4; removed Lectern. 2 reservation(s) cancelled." Every Technical Support member gets "An equipment request changed". Changing only a line's technical requirements is recorded as "changed the requirements for Microphone". |

**Automated by:** `tests/integration/change-or-withdraw.test.ts` › "SCRUM-142 [AC1, AC2, AC7] TC-142-01, TC-142-02: …"; `e2e/change-or-withdraw.spec.ts` › "SCRUM-142 [AC1, AC2] TC-142-01, TC-142-02: …"; `tests/unit/change-or-withdraw.test.ts` › "SCRUM-142 [AC1] TC-142-01: changing only a line's technical requirements says so in the history"

### TC-142-02

| Item | Content |
|---|---|
| Test Case ID | TC-142-02 |
| Test Scenario | [Positive] AC 2: what a changed or removed line had reserved returns to the pool, in the same operation |
| Pre-conditions | As TC-142-01. |
| Test Steps | 1. As TC-142-01. |
| Test Data | — |
| Expected Result | The Microphone and Lectern reservations are Cancelled; the unchanged Projector reservation stays Reserved. |

**Automated by:** as TC-142-01 (integration and e2e).

### TC-142-03

| Item | Content |
|---|---|
| Test Case ID | TC-142-03 |
| Test Scenario | [Boundary] AC 1: a type removed and then added again comes back as the same line |
| Pre-conditions | As TC-142-01. |
| Test Steps | 1. Remove Lectern. <br> 2. Add Lectern × 2. |
| Test Data | — |
| Expected Result | One Lectern line, the same row as before, live again with quantity 2. |

**Automated by:** `tests/integration/change-or-withdraw.test.ts` › "SCRUM-142 [AC1] TC-142-03: adding a removed type again brings its line back rather than adding a second"

### TC-142-04

| Item | Content |
|---|---|
| Test Case ID | TC-142-04 |
| Test Scenario | [Boundary] AC 8: saving the same lines changes nothing |
| Pre-conditions | As TC-142-01. |
| Test Steps | 1. Save the request's own lines, in another order. |
| Test Data | — |
| Expected Result | "Nothing changed, so the request is as it was." It stays Approved, with no history entry, no reservation released and no notice. |

**Automated by:** `tests/integration/change-or-withdraw.test.ts` › "SCRUM-142 [AC8] TC-142-04: …"

### TC-142-05

| Item | Content |
|---|---|
| Test Case ID | TC-142-05 |
| Test Scenario | [Positive, Negative] AC 3, AC 7, AC 8: withdrawing the whole equipment request cancels it and returns everything reserved for it, once |
| Pre-conditions | As TC-142-01. |
| Test Steps | 1. Choose Withdraw request, then Keep it. <br> 2. Choose Withdraw request, then confirm. <br> 3. Withdraw it again. |
| Test Data | — |
| Expected Result | Step 1: nothing changes. Step 2: Cancelled, and it offers no more changes; all three reservations Cancelled; history "Withdrawn by the Coordinator. 3 reservation(s) cancelled."; Technical Support get "An equipment request was withdrawn". With nothing reserved the history says just "Withdrawn by the Coordinator." Step 3: "This request has already been withdrawn." and nothing more is written. |

**Automated by:** `e2e/change-or-withdraw.spec.ts` › "SCRUM-142 [AC3] TC-142-05: the Coordinator withdraws a whole equipment request after confirming, and its reservation is released"; `tests/integration/change-or-withdraw.test.ts` › "SCRUM-142 [AC3, AC7, AC8] TC-142-05: …"; `tests/unit/change-or-withdraw.test.ts` › "SCRUM-142 [AC3] TC-142-05: …"

### TC-142-06

| Item | Content |
|---|---|
| Test Case ID | TC-142-06 |
| Test Scenario | [Negative] AC 3: a Rejected request is replaced by a new one, not changed |
| Pre-conditions | The request is Rejected. |
| Test Steps | 1. Change its lines. <br> 2. Withdraw it. |
| Test Data | — |
| Expected Result | Both: "This request was rejected. Raise a new request instead." Nothing is written. |

**Automated by:** `tests/integration/change-or-withdraw.test.ts` › "SCRUM-142 [AC3] TC-142-06: …"

### TC-142-07

| Item | Content |
|---|---|
| Test Case ID | TC-142-07 |
| Test Scenario | [Positive, Negative] AC 4, AC 7, AC 8: withdrawing a pending venue request cancels only it |
| Pre-conditions | The event has a pending venue request and an approved booking at another venue. |
| Test Steps | 1. In the event's readiness checklist, choose Withdraw request, and confirm. <br> 2. Withdraw it again. <br> 3. Request the same venue again. |
| Test Data | — |
| Expected Result | Step 1: it is Cancelled and leaves the Venue Staff queue; the other booking stays Approved; every Venue Staff member gets "A venue request was withdrawn"; the checklist reads "Not requested" when it was the only one. Step 2: "This request has already been withdrawn." Step 3: a new request is made. A request that was rejected, or a hold that expired, isn't withdrawn; one decided at the same moment keeps that decision. |

**Automated by:** `tests/integration/change-or-withdraw.test.ts` › "SCRUM-142 [AC4, AC7, AC8] TC-142-07: …"; `e2e/change-or-withdraw.spec.ts` › "SCRUM-142 [AC4] TC-142-07: …"; `tests/unit/change-or-withdraw.test.ts` › the "TC-142-07" and "TC-142-13" withdrawBookingRequest tests

### TC-142-08

| Item | Content |
|---|---|
| Test Case ID | TC-142-08 |
| Test Scenario | [Positive] AC 4: a Held booking is released instead |
| Pre-conditions | The event has a live hold. |
| Test Steps | 1. Withdraw it. |
| Test Data | — |
| Expected Result | It is Cancelled, as releasing the hold does (SCRUM-163). |

**Automated by:** `tests/integration/change-or-withdraw.test.ts` › "SCRUM-142 [AC4, AC6] TC-142-08, TC-142-10: …"

### TC-142-09

| Item | Content |
|---|---|
| Test Case ID | TC-142-09 |
| Test Scenario | [Negative] AC 5: once the event is Confirmed, changes go through a change request |
| Pre-conditions | The event is Confirmed, with a reserved equipment request and a pending venue request. |
| Test Steps | 1. Change the equipment lines. <br> 2. Withdraw the equipment request. <br> 3. Withdraw the venue request. |
| Test Data | — |
| Expected Result | Each: "This event is confirmed, so its arrangements change through a change request." Nothing changes. For an event that isn't being planned at all (e.g. Rejected): "This event isn't being planned, …". |

**Automated by:** `tests/integration/change-or-withdraw.test.ts` › "SCRUM-142 [AC5] TC-142-09: …"; `tests/unit/change-or-withdraw.test.ts` › the "TC-142-09" tests; `e2e/change-or-withdraw.spec.ts` › "SCRUM-142 [AC5] TC-142-09: once the event is Confirmed, its Coordinator is offered no way to change or withdraw its equipment or venue requests, and nothing changes"

### TC-142-10

| Item | Content |
|---|---|
| Test Case ID | TC-142-10 |
| Test Scenario | [Negative] AC 6: an Approved booking isn't withdrawn here |
| Pre-conditions | The event has an approved booking. |
| Test Steps | 1. Withdraw it. |
| Test Data | — |
| Expected Result | "An approved booking isn't withdrawn here. It is cancelled by resolving its flag, or by cancelling or rejecting the event." It stays Approved. |

**Automated by:** as TC-142-08.

### TC-142-11

| Item | Content |
|---|---|
| Test Case ID | TC-142-11 |
| Test Scenario | [Negative] AC 7: only the event's assigned Coordinator can change or withdraw |
| Pre-conditions | — |
| Test Steps | 1. As another Coordinator, withdraw the request. <br> 2. Withdraw a request that doesn't exist. <br> 3. On an event with no Coordinator assigned, change it. <br> 4. As Technical Support, Venue Staff or an Organiser, try each action. |
| Test Data | — |
| Expected Result | Steps 1–3: "Equipment request not found." / "Venue request not found.", the same as a missing one. Step 4: "You do not have permission to do that." Nothing is written. |

**Automated by:** `tests/integration/change-or-withdraw.test.ts` › "SCRUM-142 [AC7] TC-142-11: …"; `tests/unit/change-or-withdraw.test.ts` › the "TC-142-11" tests

### TC-142-12

| Item | Content |
|---|---|
| Test Case ID | TC-142-12 |
| Test Scenario | [Positive, Negative] AC 9: a change or withdrawal puts the safety check out of date |
| Pre-conditions | One event has a check awaiting review and a rejected one; another an approved check. |
| Test Steps | 1. Change the first event's equipment lines. <br> 2. Withdraw the second event's equipment request. |
| Test Data | — |
| Expected Result | The awaiting and approved checks become Outdated, with the time; the rejected one is unchanged. Withdrawing a venue request, or releasing a hold, does the same; confirming a hold does too, though only releasing is tested. |

**Automated by:** `tests/integration/change-or-withdraw.test.ts` › "SCRUM-142 [AC9] TC-142-12: a change or withdrawal puts …" and "SCRUM-142 [AC9] TC-142-12: withdrawing a venue request, or releasing a hold, puts the event's safety check out of date"

### TC-142-13

| Item | Content |
|---|---|
| Test Case ID | TC-142-13 |
| Test Scenario | [Concurrency] AC 3, AC 8: two withdrawals at the same moment, or a change that loses a race |
| Pre-conditions | As TC-142-01. |
| Test Steps | 1. Withdraw the request twice at the same instant. <br> 2. Send the same change twice at the same instant, to a request already in Pending Review. <br> 3. Change or withdraw it while another update moves it first. |
| Test Data | — |
| Expected Result | Step 1: one succeeds; one history entry; each reservation is released once. Step 2: one succeeds and the other gets "Someone else updated this request first. …" (the lines it worked from changed under it); one history entry, and the added line exists once. Step 3: "Someone else updated this request first. …", and no history, reservation or notice is written. |

**Automated by:** `tests/integration/change-or-withdraw.test.ts` › "SCRUM-142 [AC3] TC-142-13: …" and "SCRUM-142 [AC8] TC-142-13: the same change sent twice at once, on a request already in Pending Review, is written once"; `tests/unit/change-or-withdraw.test.ts` › the "TC-142-13" tests

### TC-142-14

| Item | Content |
|---|---|
| Test Case ID | TC-142-14 |
| Test Scenario | [Negative] AC 1: an Approved request can't go back to review while the event has another waiting |
| Pre-conditions | The event also has a request in Pending Review. |
| Test Steps | 1. Change the Approved request's lines. |
| Test Data | — |
| Expected Result | "This event already has another equipment request waiting for review. Change that one instead." Nothing changes. |

**Automated by:** `tests/integration/change-or-withdraw.test.ts` › "SCRUM-142 [AC1] TC-142-14: …"

### TC-142-15

| Item | Content |
|---|---|
| Test Case ID | TC-142-15 |
| Test Scenario | [Negative] AC 1, AC 3, AC 4: invalid input is refused before anything is written |
| Pre-conditions | — |
| Test Steps | 1. Change with no lines, no request, or an equipment type that isn't on the list. <br> 2. In Change lines, add Microphone with quantity 0 and save. <br> 3. Withdraw with no request or booking id. |
| Test Data | — |
| Expected Result | Step 1: "Please fix the highlighted fields." Step 2: "Quantity must be a positive whole number." next to the quantity; the request stays Approved and its reservation Reserved. Step 3: not found, before anything is read. A database failure is reported, not swallowed. |

**Automated by:** `tests/unit/change-or-withdraw.test.ts` › the "TC-142-15" tests; `e2e/change-or-withdraw.spec.ts` › "SCRUM-142 [AC1] TC-142-15: a line with an invalid quantity is refused next to the field, and nothing is changed"

### TC-142-16

| Item | Content |
|---|---|
| Test Case ID | TC-142-16 |
| Test Scenario | [Concurrency] AC 5: a change waiting behind a Confirm is refused once the event is Confirmed |
| Pre-conditions | As TC-142-01. |
| Test Steps | 1. While the event is being confirmed (its lock held), withdraw the equipment request. <br> 2. Let the confirmation commit. |
| Test Data | — |
| Expected Result | The withdrawal, which read the event before the confirmation committed, re-reads it under the lock and is refused: "This event is confirmed, so its arrangements change through a change request." The request stays Approved and its reservations Reserved. Changing lines and withdrawing a venue request re-check the same way, whether the venue request is Pending or Held; a Held one stays Held. |

**Automated by:** `tests/integration/change-or-withdraw.test.ts` › "SCRUM-142 [AC5] TC-142-16: a withdrawal waiting behind a Confirm for the event lock is refused once the event is Confirmed"; `tests/unit/change-or-withdraw.test.ts` › the "TC-142-16" tests

### TC-142-17

| Item | Content |
|---|---|
| Test Case ID | TC-142-17 |
| Test Scenario | [Negative] AC 1, AC 2: a reserve form opened before the request's lines changed doesn't reserve the old lines |
| Pre-conditions | An Approved request for Speaker × 3 with nothing reserved; Technical Support has opened it on the reserve form. |
| Test Steps | 1. As the Coordinator, change it to Speaker × 1. <br> 2. As Technical Support, approve it again. <br> 3. Submit the form opened before step 1. <br> 4. Choose the request again and reserve it. |
| Test Data | `techsupport@test.local` |
| Expected Result | Step 3: "This request has changed since you opened it. Choose it again to see it as it is now.", and nothing is reserved. Step 4: the form shows Speaker × 1, and it is reserved. (Technical Support may still edit rows before reserving, SCRUM-155 AC2; only a stale form is refused.) |

**Automated by:** `tests/integration/change-or-withdraw.test.ts` › "SCRUM-142 [AC1, AC2] TC-142-17: a reserve form opened before the lines changed is refused, even once the request is approved again"

### TC-142-18

| Item | Content |
|---|---|
| Test Case ID | TC-142-18 |
| Test Scenario | [Positive, Negative] AC 10: a request awaiting Technical Support's re-check keeps Equipment incomplete, so Confirm waits for it |
| Pre-conditions | The venue is approved, and an Approved request with two or more lines has every line reserved, so the event is Ready to confirm. Signed in as the assigned Coordinator. |
| Test Steps | 1. Remove one line and save. <br> 2. Open the event's readiness checklist, and try to confirm. <br> 3. As Technical Support, start the review and approve the request. <br> 4. Open the checklist again. |
| Test Data | `techsupport@test.local` |
| Expected Result | Step 1: the request is Pending Review and the other lines stay reserved. Step 2: Equipment shows "Awaiting Technical Support review" and is incomplete, and Confirm is disabled. The server refuses a confirmation with "This event isn't ready to confirm yet. Outstanding: Equipment (Awaiting Technical Support review).", and the event stays in Planning. Step 4: Equipment is Reserved and the event is Ready to confirm. While an item isn't reserved in full, Equipment names it instead ("Not fully reserved: …"), as before. |

**Automated by:** `tests/unit/event-readiness.test.ts` › "SCRUM-142 [AC10] TC-142-18: a %s request keeps Equipment incomplete even with every line reserved, so the event isn't ready", "SCRUM-142 [AC10] TC-142-18: a request awaiting review holds back an approved one, and an item not reserved in full is named first"; `tests/integration/change-or-withdraw.test.ts` › "SCRUM-142 [AC10] TC-142-18: after a line is only removed, Confirm waits for Technical Support to approve the request again"; `e2e/change-or-withdraw.spec.ts` › "SCRUM-142 [AC10] TC-142-18: after only removing a line, the checklist waits for Technical Support's re-check before Confirm"

### TC-142-19

| Item | Content |
|---|---|
| Test Case ID | TC-142-19 |
| Test Scenario | [Positive, Negative] AC 2, AC 10: rejecting a changed request releases what its unchanged lines still reserve |
| Pre-conditions | An Approved request for a Planning event, with 2 projectors, 3 microphones and 1 lectern reserved. The Coordinator removes the lectern, so the request returns to Pending Review and the projectors and microphones stay reserved (AC 10). |
| Test Steps | As `techsupport@test.local`: 1. Mark the request In Review. 2. Reject it with a note. 3. Reject it again. |
| Test Data | Note: "Not enough microphones." |
| Expected Result | Step 2: every reservation for the event is Cancelled and its stock returns to the pool. The history says "Not enough microphones. 2 reservation(s) cancelled.", and the Coordinator is told the request is Rejected and its reserved equipment was released. Step 3 is refused and releases nothing. Approving instead keeps the reservations. |

**Automated by:** `tests/unit/equipment-request-review.test.ts` › "SCRUM-142 [AC2, AC10] TC-142-19: …" (3 tests); `tests/integration/change-or-withdraw.test.ts` › "SCRUM-142 [AC2, AC10] TC-142-19: when Technical Support rejects a changed request, what its unchanged lines still reserve returns to the pool, once"
