# SCRUM-27 — Create Equipment Request: test cases

Story and acceptance criteria: [docs/backlog/SCRUM-27.md](../backlog/SCRUM-27.md).
Format and conventions: [README.md](README.md).

**Shared pre-conditions for every case:** the database is migrated and seeded
(`npm run db:deploy && npm run db:seed`), the app is running, and the tester
signs in as the Event Coordinator (`coordinator@test.local` / `Password123!`)
unless the case says otherwise. Requests are raised on the **Equipment
Requests** page (`/equipment-requests`) with **New request**. An event can
hold only one active request (Pending Review, In Review or Approved, since
SCRUM-186), so a case that submits one needs an event without one:
"Approved — Research Symposium" (`evt_approved`) has none in the seed.

**SCRUM-186 extended AC 7** to Approved requests: more equipment is added by
changing the request's lines (SCRUM-142), not by a second request. TC-27-09's
message changed with it, and TC-27-11 now frees the event with a rejection.
SCRUM-186's own cases are in [SCRUM-186.md](SCRUM-186.md).

| ID | Type | Criterion | Automated |
|---|---|---|---|
| [TC-27-01](#tc-27-01) | Positive | AC 1 | Unit, integration, e2e |
| [TC-27-02](#tc-27-02) | Negative | AC 1 | Unit, integration |
| [TC-27-03](#tc-27-03) | Positive | AC 2 | Unit, e2e |
| [TC-27-04](#tc-27-04) | Negative | AC 2 | Unit |
| [TC-27-05](#tc-27-05) | Negative, Boundary | AC 3 | Unit, e2e |
| [TC-27-06](#tc-27-06) | Negative | AC 4 | Unit, integration, e2e |
| [TC-27-07](#tc-27-07) | Positive | AC 5 | Unit, integration, e2e |
| [TC-27-08](#tc-27-08) | Positive | AC 6 | Unit, integration, e2e |
| [TC-27-09](#tc-27-09) | Positive | AC 7 | Unit, integration, e2e |
| [TC-27-10](#tc-27-10) | Concurrency | AC 7 | Unit, integration |
| [TC-27-11](#tc-27-11) | Boundary | AC 7 | Integration |
| [TC-27-12](#tc-27-12) | Negative | Coordinators only | Unit, e2e |
| [TC-27-13](#tc-27-13) | Negative | A complete request | Unit, e2e |
| [TC-27-14](#tc-27-14) | Positive | AC 8 | Unit, e2e |
| [TC-27-15](#tc-27-15) | Negative | AC 8 | e2e |
| [TC-27-16](#tc-27-16) | Positive | AC 6 | e2e |
| [TC-27-17](#tc-27-17) | Negative, Concurrency | AC 1 | Unit |

---

### TC-27-01

| Item | Content |
|---|---|
| Test Case ID | TC-27-01 |
| Test Scenario | [Positive] AC 1: the coordinator links the request to one of their events, chosen by its name and date |
| Pre-conditions | Signed in as the coordinator. The coordinator is assigned to "Approved — Research Symposium" (APPROVED). |
| Test Steps | 1. Open **Equipment Requests** and click **New request**. <br> 2. Open the **Event** list. <br> 3. Choose the event. |
| Test Data | Event: Approved — Research Symposium |
| Expected Result | The list shows each of the coordinator's approved and planning events as "name — date", and nothing confirmed, still under review, or assigned to another coordinator. After step 3, "Runs …" shows the event's full start and end. The saved request's `eventId` is that event. |

**Automated by:** `e2e/equipment-requests.spec.ts` › "SCRUM-27 [AC1, AC2, AC5, AC6] TC-27-01, TC-27-03, TC-27-07, TC-27-08: a coordinator requests equipment for their event and it is saved as Pending Review"; `tests/unit/equipment-request-queries.test.ts` › "SCRUM-27 [AC1] TC-27-01, SCRUM-170 [AC3] TC-170-03: offers only this coordinator's events that are going ahead, soonest first, with the Organiser's equipment answer"; `tests/integration/equipment-request.test.ts` › "SCRUM-27 [AC1] TC-27-01: offers the coordinator their going-ahead events, and not one still under review or someone else's"; `e2e/equipment-requests.spec.ts` › "SCRUM-27 [AC1] TC-27-01: a coordinator finds Equipment Requests in their navigation" (step 1: the page is reached from the navigation)

### TC-27-02

| Item | Content |
|---|---|
| Test Case ID | TC-27-02 |
| Test Scenario | [Negative] AC 1: a request for an event that isn't the coordinator's, doesn't exist or can't still take one is refused, with one message for every case |
| Pre-conditions | Signed in as the coordinator. |
| Test Steps | 1. Submit a request directly to the action (the page never offers these events) for each event below. |
| Test Data | Another coordinator's event; a made-up event id; an UNDER_REVIEW event; a CONFIRMED event; a CANCELLED event |
| Expected Result | Each is refused with "Choose one of your approved events." next to **Event**. No request is created. The same message for every case means the refusal can't be used to find out which event ids exist. |

**Automated by:** `tests/unit/equipment-request.test.ts` › "SCRUM-27 [AC1] TC-27-02: refuses %s with the same message, and saves nothing" (all five); `tests/integration/equipment-request.test.ts` › "SCRUM-27 [AC1] TC-27-02: another coordinator cannot raise a request for this event, and nothing is written"

### TC-27-03

| Item | Content |
|---|---|
| Test Case ID | TC-27-03 |
| Test Scenario | [Positive] AC 2: the equipment type is selected from the predefined system list |
| Pre-conditions | As TC-27-01. |
| Test Steps | 1. Open **New request**. <br> 2. Open the **Equipment type** list. |
| Test Data | Seeded equipment: Laptop, Lectern, PA Speaker, Projector, Wireless Microphone |
| Expected Result | The list holds exactly the active equipment types, alphabetically, each with the size of its pool. There is no free-text type field. |

**Automated by:** `e2e/equipment-requests.spec.ts` › "SCRUM-27 [AC2] TC-27-03: equipment is chosen from the predefined list of active types"; `tests/unit/equipment-request-queries.test.ts` › "SCRUM-27 [AC2] TC-27-03: is the predefined list: every active equipment type, alphabetically"

### TC-27-04

| Item | Content |
|---|---|
| Test Case ID | TC-27-04 |
| Test Scenario | [Negative] AC 2: a type that is not on the list, or no longer active, is refused |
| Pre-conditions | As TC-27-01. |
| Test Steps | 1. Submit a request directly to the action with an equipment id that isn't an active type. |
| Test Data | Line 2: `equipmentId` = `eqp_retired` |
| Expected Result | "Please fix the highlighted fields.", with "Select an equipment type from the list." on that line. Nothing is saved. |

**Automated by:** `tests/unit/equipment-request.test.ts` › "SCRUM-27 [AC2] TC-27-04: refuses a type that is not on the predefined list, naming the line"

### TC-27-05

| Item | Content |
|---|---|
| Test Case ID | TC-27-05 |
| Test Scenario | [Negative] [Boundary] AC 3: the quantity must be a positive whole number |
| Pre-conditions | As TC-27-01, with **New request** open. |
| Test Steps | 1. Choose Projector. <br> 2. Enter each quantity below and click **Add equipment**. |
| Test Data | Refused: 0, -1, 1.5, blank, "two", 1001 <br> Accepted: 1 |
| Expected Result | Each refused value shows "Quantity must be a positive whole number." under **Quantity** (1001 shows "Quantity can be at most 1,000.") and adds no line. 1 is added. The server refuses the same values if they are sent directly. |

**Automated by:** `e2e/equipment-requests.spec.ts` › "SCRUM-27 [AC3] TC-27-05: a quantity that is not a positive whole number is refused next to the field" (0, -1, 1.5, then 1); `tests/unit/equipment-request-schema.test.ts` › "SCRUM-27 [AC3] TC-27-05: refuses %s as the quantity", "SCRUM-27 [AC3] TC-27-05: accepts exactly 1, the smallest quantity", "SCRUM-27 [AC3] TC-27-05: refuses a quantity above 1,000, so the database column can never overflow"; `tests/unit/equipment-request.test.ts` › "SCRUM-27 [AC3] TC-27-05: quantity %j is refused next to its line, and nothing is saved"

### TC-27-06

| Item | Content |
|---|---|
| Test Case ID | TC-27-06 |
| Test Scenario | [Negative] AC 4: adding a type already on the request creates no second line and says why |
| Pre-conditions | As TC-27-01, with **New request** open. |
| Test Steps | 1. Add Projector × 2. <br> 2. Add Projector × 1. |
| Test Data | Equipment type: Projector |
| Expected Result | Step 2 shows "Projector is already on this request." and the request still has one Projector line, × 2. Sent directly, the server refuses the repeat with "This equipment type is already on the request.", and the database's unique line index refuses it too. |

**Automated by:** `e2e/equipment-requests.spec.ts` › "SCRUM-27 [AC4] TC-27-06: adding a type already on the request says so and adds no second line"; `tests/unit/equipment-request.test.ts` › "SCRUM-27 [AC4] TC-27-06: the same type twice creates no duplicate line and says the type is already on the request"; `tests/integration/equipment-request.test.ts` › "SCRUM-27 [AC4] TC-27-06: the database itself refuses a second line of the same type on one request"

### TC-27-07

| Item | Content |
|---|---|
| Test Case ID | TC-27-07 |
| Test Scenario | [Positive] AC 5: free-text technical requirements are saved with the line they belong to |
| Pre-conditions | As TC-27-01, with **New request** open. |
| Test Steps | 1. Add Projector × 2 with the requirements below. <br> 2. Add Wireless Microphone × 3 with none. <br> 3. Submit. |
| Test Data | Requirements: "HDMI to the lectern" |
| Expected Result | The saved request lists Projector with "HDMI to the lectern" and the microphone with "None given". Blank requirements are stored as none, not as empty text. |

**Automated by:** `e2e/equipment-requests.spec.ts` › "SCRUM-27 [AC1, AC2, AC5, AC6] TC-27-01, TC-27-03, TC-27-07, TC-27-08: …"; `tests/unit/equipment-request-schema.test.ts` › "SCRUM-27 [AC5] TC-27-07: keeps free-text technical requirements, trimmed", "SCRUM-27 [AC5] TC-27-07: technical requirements are optional, and a blank one is stored as none"; `tests/integration/equipment-request.test.ts` › "SCRUM-27 [AC5, AC6] TC-27-07, TC-27-08: saves the request, its lines and its first history entry as Pending Review"

### TC-27-08

| Item | Content |
|---|---|
| Test Case ID | TC-27-08 |
| Test Scenario | [Positive] AC 6: a submitted request is saved as Pending Review |
| Pre-conditions | As TC-27-07. |
| Test Steps | 1. Submit the request from TC-27-07. |
| Test Data | As TC-27-07 |
| Expected Result | "Request submitted. It's now Pending Review." The new request is highlighted in the list with the status **Pending Review**. The database holds it as `PENDING_REVIEW`, with one history entry: no previous status → `PENDING_REVIEW`, "Request submitted.", by the coordinator. |

**Automated by:** `e2e/equipment-requests.spec.ts` › "SCRUM-27 [AC1, AC2, AC5, AC6] TC-27-01, TC-27-03, TC-27-07, TC-27-08: …"; `tests/unit/equipment-request.test.ts` › "SCRUM-27 [AC1, AC2, AC5, AC6] TC-27-01, TC-27-03, TC-27-07, TC-27-08: saves the request for the event, with each line's type, quantity and requirements, as Pending Review", "SCRUM-27 [AC6] TC-27-08: records the submission as the first entry in the request's history"; `tests/integration/equipment-request.test.ts` › "SCRUM-27 [AC5, AC6] TC-27-07, TC-27-08: …"

### TC-27-09

| Item | Content |
|---|---|
| Test Case ID | TC-27-09 |
| Test Scenario | [Positive] AC 7: submitting for an event that already has a request pending review shows that request instead of creating a second |
| Pre-conditions | As TC-27-01. The event already has a request in Pending Review. |
| Test Steps | 1. Open **New request**. <br> 2. Choose the same event, add any equipment and submit. |
| Test Data | Seeded: "Planning — Freshman Orientation" already has `eqr_planning` in Pending Review |
| Expected Result | "This event already has an equipment request, so no new one was made. It's highlighted below: use Change lines on it to add or change equipment." (since SCRUM-186) The existing request is scrolled into view and highlighted. The event still has exactly one request. |

**Automated by:** `e2e/equipment-requests.spec.ts` › "SCRUM-27 [AC7] TC-27-09: submitting for an event with a request pending review shows that request instead"; `tests/unit/equipment-request.test.ts` › "SCRUM-27 [AC7] TC-27-09, SCRUM-186 [AC1] TC-186-02: an event with an active request (Pending Review, In Review or Approved) shows the oldest instead of creating a second"; `tests/integration/equipment-request.test.ts` › "SCRUM-27 [AC7] TC-27-09: a second submission for the same event returns the request pending review"

### TC-27-10

| Item | Content |
|---|---|
| Test Case ID | TC-27-10 |
| Test Scenario | [Concurrency] AC 7: two submissions for one event at the same moment leave one request |
| Pre-conditions | An event with no open request. Two coordinator sessions. |
| Test Steps | 1. In both sessions, fill a request for the same event. <br> 2. Submit both at the same moment. |
| Test Data | Any requestable event |
| Expected Result | The event has exactly one request. One session is told its request was submitted; the other is shown that same request. The partial unique index `EquipmentRequest_one_open_per_event` is what guarantees this, so it also holds for a write that bypasses the action. |

**Automated by:** `tests/integration/equipment-request.test.ts` › "SCRUM-27 [AC7] TC-27-10: two submissions at the same moment leave one request, and both are shown it", "SCRUM-27 [AC7] TC-27-10: the index is what enforces one open request, not just the action"; `tests/unit/equipment-request.test.ts` › "SCRUM-27 [AC7] TC-27-10: when a simultaneous submission wins the race, the loser is shown the winner's request"

### TC-27-11

| Item | Content |
|---|---|
| Test Case ID | TC-27-11 |
| Test Scenario | [Boundary] AC 7: once an event's request has been rejected, a new one can be raised |
| Pre-conditions | The event's only request is REJECTED. (Until SCRUM-186 an APPROVED request freed the event too; it no longer does, see TC-186-02.) |
| Test Steps | 1. Submit a new request for the event. |
| Test Data | Seeded "Approved — Research Symposium" (`evt_approved`), still requestable under AC 1 |
| Expected Result | A new request is created in Pending Review. The event now has two requests, one of them open. |

**Automated by:** `tests/integration/equipment-request.test.ts` › "SCRUM-27 [AC7] TC-27-11: once the open request is rejected, a new one can be raised"

### TC-27-12

| Item | Content |
|---|---|
| Test Case ID | TC-27-12 |
| Test Scenario | [Negative] only an Event Coordinator can raise an equipment request |
| Pre-conditions | Seeded users for each role. |
| Test Steps | 1. Sign in as each role below. <br> 2. Open `/equipment-requests` by typing the URL. <br> 3. Call the action directly. |
| Test Data | Roles: ORGANISER, VENUE_STAFF, TECH_SUPPORT, ATTENDEE |
| Expected Result | The page shows "Access denied", and the action is refused with "You do not have permission to do that." before anything is read or written. |

**Automated by:** `tests/unit/equipment-request.test.ts` › "SCRUM-27 TC-27-12: refuses %s before reading anything" (all four), "SCRUM-27 TC-27-12: refuses a signed-out caller"; `tests/unit/auth.test.ts` › "SCRUM-27 TC-27-12: does not let %s create an equipment request"; `e2e/equipment-requests.spec.ts` › "SCRUM-27 TC-27-12: an organiser typing the URL is refused server-side"

### TC-27-13

| Item | Content |
|---|---|
| Test Case ID | TC-27-13 |
| Test Scenario | [Negative] a request needs an event and at least one item |
| Pre-conditions | As TC-27-01, with **New request** open. |
| Test Steps | 1. Click **Submit request** without choosing anything. |
| Test Data | None |
| Expected Result | "Select an event." under **Event** and "Add at least one equipment item." under **Equipment**. The dialog stays open and nothing is sent. |

**Automated by:** `e2e/equipment-requests.spec.ts` › "SCRUM-27 TC-27-13: a request needs an event and at least one item before it is sent"; `tests/unit/equipment-request-schema.test.ts` › "SCRUM-27 TC-27-13: requires the event the request is for", "SCRUM-27 TC-27-13: requires at least one equipment item"

### TC-27-14

| Item | Content |
|---|---|
| Test Case ID | TC-27-14 |
| Test Scenario | [Positive] AC 8: the coordinator sees each request's lines, status, any suggested alternative and its history, and a rejected request carries its reason |
| Pre-conditions | A coordinator has raised a request. Technical Support has suggested an alternative for one line and then rejected the request with a reason. |
| Test Steps | 1. Sign in as the coordinator. <br> 2. Open **Equipment Requests**. |
| Test Data | The rig from `e2e/equipment-request-review.spec.ts`, rejected with "Not enough lecterns that day." |
| Expected Result | The request's details show each line's type, quantity and technical requirements; the status badge; the suggested alternative; and, on their History tab, the history. When the status is Rejected, the reason is in the details themselves, not only in the history log. |

**Automated by:** `e2e/equipment-request-review.spec.ts` › "SCRUM-27 [AC8] TC-27-14: the coordinator sees a rejected request with its reason, without opening the history"; `e2e/equipment-requests.spec.ts` › "SCRUM-27 [AC1, AC2, AC5, AC6] TC-27-01, TC-27-03, TC-27-07, TC-27-08: …" (lines and status); `tests/unit/equipment-request-queries.test.ts` › "SCRUM-28 [AC4, AC6] TC-28-07, TC-28-10: includes suggested alternatives and the history, oldest first"

### TC-27-15

| Item | Content |
|---|---|
| Test Case ID | TC-27-15 |
| Test Scenario | [Negative] AC 8: a coordinator with no requests is told so, not shown an empty list |
| Pre-conditions | Signed in as a coordinator who has raised none. |
| Test Steps | 1. Open **Equipment Requests**. |
| Test Data | `coordinator2@test.local`, who has no requests. |
| Expected Result | "No equipment requests yet" is shown and no request cards appear. |

**Automated by:** `e2e/equipment-requests.spec.ts` › "SCRUM-27 [AC8] TC-27-15: a coordinator with no requests is told how to raise one, not shown an empty list"

### TC-27-16

| Item | Content |
|---|---|
| Test Case ID | TC-27-16 |
| Test Scenario | [Positive] AC 6: an item chosen but not yet added is sent with the request |
| Pre-conditions | As TC-27-01, with **New request** open. |
| Test Steps | 1. Choose the event. <br> 2. Choose an **Equipment type** and enter a **Quantity**, without clicking **Add equipment**. <br> 3. Click **Submit request**. |
| Test Data | Laptop × 2 |
| Expected Result | The request is submitted with the item on it: its details show the line "Laptop 2". Nothing the coordinator entered is dropped. |

**Automated by:** `e2e/equipment-requests.spec.ts` › "SCRUM-27 [AC6] TC-27-16: equipment picked but not yet added is included when the request is submitted"

### TC-27-17

| Item | Content |
|---|---|
| Test Case ID | TC-27-17 |
| Test Scenario | [Negative, Concurrency] AC 1: an event confirmed, rejected, cancelled or reassigned while the request is being sent gets no request |
| Pre-conditions | A Planning event. Its Coordinator fills the equipment request; before they send it, the event is confirmed, rejected or cancelled. |
| Test Steps | Click **Submit request**. |
| Test Data | — |
| Expected Result | "Choose one of your approved events." The status and Coordinator are re-read under the lock the request already takes on the event (SCRUM-170 AC4), so a reassignment to another Coordinator is seen too; no request is created and a No equipment needed decision is left as it was. |

**Automated by:** `tests/unit/equipment-request.test.ts` › "SCRUM-27 [AC1] TC-27-17: an event that became %s after its status was read gets no request, and nothing is written" (Confirmed, Rejected, Cancelled) and "SCRUM-27 [AC1] TC-27-17: an event reassigned to another Coordinator after it was read gets no request from the previous one"
