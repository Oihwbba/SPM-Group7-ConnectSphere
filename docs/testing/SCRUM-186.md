# SCRUM-186 — One active equipment request per event: test cases

Story and acceptance criteria: [docs/backlog/SCRUM-186.md](../backlog/SCRUM-186.md).
Format and conventions: [README.md](README.md). The rule is in
`createEquipmentRequest` in
[app/(app)/equipment-requests/actions.ts](<../../app/(app)/equipment-requests/actions.ts>):
an event's active requests are those in `CHANGEABLE_REQUEST_STATUSES`
([lib/equipment/requests.ts](../../lib/equipment/requests.ts)), Pending Review,
In Review and Approved.

Written on 2026-10-22 with the story. It extends SCRUM-27 AC 7, which blocked a
second request only while the first was Pending Review or In Review, so
[TC-27-11](SCRUM-27.md#tc-27-11) now frees the event with a rejection, not an
approval.

**Why there is no new unique index.** The partial unique index
`EquipmentRequest_one_open_per_event` still covers Pending Review and In
Review. Adding Approved to it would fail on events that already have two
active requests from before this story, which AC 5 keeps. Instead the action
looks for an active request again after locking the event's row, the lock it
already takes (SCRUM-170 AC4). Of two submissions at once, the second waits
for the first and then finds it (TC-186-04, TC-186-05).

**Shared pre-conditions for every case:** the database is migrated and seeded
and the app is running. Signed in as `coordinator@test.local`
(`Password123!`), the Coordinator of the seeded "Approved — Research
Symposium" (`evt_approved`), unless the case says otherwise.

| ID | Type | Criterion | Automated |
|---|---|---|---|
| [TC-186-01](#tc-186-01) | Positive | AC 1 | e2e |
| [TC-186-02](#tc-186-02) | Negative | AC 1, AC 4 | Unit, integration |
| [TC-186-03](#tc-186-03) | Boundary | AC 2 | Integration |
| [TC-186-04](#tc-186-04) | Concurrency | AC 4 | Integration |
| [TC-186-05](#tc-186-05) | Concurrency | AC 4 | Unit |
| [TC-186-06](#tc-186-06) | Positive | AC 5 | Integration |
| [TC-186-07](#tc-186-07) | Positive | AC 3 | Integration, e2e (SCRUM-142's) |
| [TC-186-08](#tc-186-08) | Positive | AC 5, AC 6 | Unit, integration, e2e (SCRUM-110's and SCRUM-156's) |

---

### TC-186-01

| Item | Content |
|---|---|
| Test Case ID | TC-186-01 |
| Test Scenario | [Positive] AC 1: submitting for an event with an Approved request shows that request and points to changing its lines |
| Pre-conditions | An approved event of the Coordinator's whose only equipment request is Approved (Lectern × 1). |
| Test Steps | 1. On Equipment Requests, choose New request. <br> 2. Choose the event, add Projector × 2. <br> 3. Submit request. |
| Test Data | Lectern × 1 already approved; Projector × 2 submitted |
| Expected Result | "This event already has an equipment request, so no new one was made. It's highlighted below: use Change lines on it to add or change equipment." The Approved request is scrolled into view and highlighted, and opening its details offers Change lines (since SCRUM-207 the actions sit in the details dialog). The event still has exactly that one request, still Approved. |

**Automated by:** `e2e/equipment-requests.spec.ts` › "SCRUM-186 [AC1] TC-186-01: submitting for an event with an Approved request shows that request and points to changing its lines"

### TC-186-02

| Item | Content |
|---|---|
| Test Case ID | TC-186-02 |
| Test Scenario | [Negative] AC 1, AC 4: with a request Pending Review, In Review or Approved, a submission made directly to the server is shown that request and writes nothing |
| Pre-conditions | `evt_approved` has one equipment request, in turn Pending Review, In Review and Approved. |
| Test Steps | 1. Call `createEquipmentRequest` for the event, bypassing the form. |
| Test Data | Projector × 2 (HDMI), Wireless Microphone × 3 |
| Expected Result | The result is the existing request with `existing: true`. No request, history entry or "An equipment request was submitted" notice is written, and the existing request keeps its status. When the event has more than one active request (TC-186-06), the oldest is shown. |

**Automated by:** `tests/integration/equipment-request.test.ts` › "SCRUM-186 [AC1, AC4] TC-186-02: with a %s request, a direct submission is shown that request, and nothing is written" (run for PENDING_REVIEW, IN_REVIEW and APPROVED); `tests/unit/equipment-request.test.ts` › "SCRUM-27 [AC7] TC-27-09, SCRUM-186 [AC1] TC-186-02: an event with an active request (Pending Review, In Review or Approved) shows the oldest instead of creating a second"

### TC-186-03

| Item | Content |
|---|---|
| Test Case ID | TC-186-03 |
| Test Scenario | [Boundary] AC 2: when the event's only requests are Rejected and Cancelled, a new request is created |
| Pre-conditions | `evt_approved` has one Rejected and one Cancelled equipment request, and no other. |
| Test Steps | 1. Submit a new request for the event. |
| Test Data | Projector × 2 (HDMI), Wireless Microphone × 3 |
| Expected Result | A new request is created in Pending Review (`existing: false`). The event has three requests: Rejected, Cancelled, Pending Review. |

**Automated by:** `tests/integration/equipment-request.test.ts` › "SCRUM-186 [AC2] TC-186-03: when the event's only requests are Rejected and Cancelled, a new request is created"; also `tests/integration/equipment-request.test.ts` › "SCRUM-27 [AC7] TC-27-11: once the open request is rejected, a new one can be raised"

### TC-186-04

| Item | Content |
|---|---|
| Test Case ID | TC-186-04 |
| Test Scenario | [Concurrency] AC 4: two submissions at the same moment leave one new request |
| Pre-conditions | `evt_approved`'s only request is Rejected. |
| Test Steps | 1. Submit two requests for the event at the same moment. |
| Test Data | The same lines twice |
| Expected Result | Both submissions return the same request id. The event has two requests: the Rejected one and one in Pending Review. |

**Automated by:** `tests/integration/equipment-request.test.ts` › "SCRUM-186 [AC4] TC-186-04: two submissions at the same moment for an event with only a rejected request leave one new request"

### TC-186-05

| Item | Content |
|---|---|
| Test Case ID | TC-186-05 |
| Test Scenario | [Concurrency] AC 4: a request that became active after the first check is found again under the event's lock, and nothing is written |
| Pre-conditions | The first check finds no active request; by the time the event's row is locked, another submission has committed one. This can't be timed by hand: the partial unique index already stops two Pending requests, so the case that needs the lock is a request created and approved in between. |
| Test Steps | 1. Submit a request. |
| Test Data | The lock-time read returns an active request (database mocked) |
| Expected Result | The result is that request with `existing: true`. The check runs after the event's row is locked. No request, history entry or notice is written, and the No equipment needed decision is not cleared. |

**Automated by:** `tests/unit/equipment-request.test.ts` › "SCRUM-186 [AC4] TC-186-05: a request that became active after the first check is found again under the event's lock, and nothing is written"

### TC-186-06

| Item | Content |
|---|---|
| Test Case ID | TC-186-06 |
| Test Scenario | [Positive] AC 5: an event that already has two Approved requests keeps both, and a submission is shown the older one |
| Pre-conditions | `evt_approved` has two Approved requests from before this story, written directly (the database allows it: its index covers only Pending Review and In Review). |
| Test Steps | 1. Submit a new request for the event. |
| Test Data | Older request created 1 Jan 2026, newer 2 Jan 2026 |
| Expected Result | The older request is shown (`existing: true`). Both requests are still there and still Approved; nothing is cancelled or written. |

**Automated by:** `tests/integration/equipment-request.test.ts` › "SCRUM-186 [AC5] TC-186-06: an event that already has two Approved requests keeps both, and a submission is shown the older one"

### TC-186-07

| Item | Content |
|---|---|
| Test Case ID | TC-186-07 |
| Test Scenario | [Positive] AC 3: more or different equipment is added by changing the active request's lines, which returns it to Technical Support |
| Pre-conditions | As SCRUM-142's TC-142-01: the event's request is Approved. |
| Test Steps | As TC-142-01. |
| Test Data | As TC-142-01 |
| Expected Result | As TC-142-01: the request is back in Pending Review with the new lines, and Technical Support are told. |

**Automated by:** SCRUM-142's tests, which this story relies on unchanged: `tests/integration/change-or-withdraw.test.ts` › "SCRUM-142 [AC1, AC2, AC7] TC-142-01, TC-142-02: changing lines sends the request back to Pending Review, releases what changed lines had reserved, records it and tells Technical Support"; `e2e/change-or-withdraw.spec.ts` › "SCRUM-142 [AC1, AC2] TC-142-01, TC-142-02: …"

### TC-186-08

| Item | Content |
|---|---|
| Test Case ID | TC-186-08 |
| Test Scenario | [Positive] AC 5, AC 6: each of an event's two legacy active requests counts towards the readiness checklist and is reserved line by line in its own right |
| Pre-conditions | An event with two Approved requests from before this story. |
| Test Steps | 1. Open the event's readiness checklist. <br> 2. As Technical Support, reserve each request. |
| Test Data | As SCRUM-110's TC-110-09 and SCRUM-156's TC-156-08 |
| Expected Result | The checklist adds the two requests' lines together (TC-110-09). The second request is offered as "(event already partly reserved)", because the first request's reservations don't count for it, and is reserved in its own right (TC-156-08). |

**Automated by:** SCRUM-110's and SCRUM-156's tests, unchanged: `tests/unit/event-readiness.test.ts` › "SCRUM-110 [AC3] TC-110-09: a new request after a rejection replaces it, and live requests for the same item add up"; `tests/integration/request-reservation.test.ts` › "SCRUM-156 [AC5] TC-156-08: a second approved request for an event already reserved for is offered and reserved in its own right"; `e2e/request-reservation.spec.ts` › "SCRUM-156 [AC5] TC-156-08: a second request for an event already reserved for is marked as its event partly reserved"
