# SCRUM-28 — Review and Update Equipment Request: test cases

Story and acceptance criteria: [docs/backlog/SCRUM-28.md](../backlog/SCRUM-28.md).
Format and conventions: [README.md](README.md).

**Shared pre-conditions for every case:** the database is migrated and seeded
(`npm run db:deploy && npm run db:seed`), the app is running, and the tester
signs in as Technical Support (`techsupport@test.local` / `Password123!`)
unless the case says otherwise. Requests are reviewed on the **Equipment
Requests** page (`/equipment-requests`). The seed has one request waiting for
review: `eqr_planning`, for "Planning — Freshman Orientation", in Pending
Review.

**How a review runs.** A request is raised as **Pending Review** (SCRUM-27).
Technical Support clicks **Start review** to take it **In Review**, which tells
the coordinator someone is working on it; only a request in review can be
**Approved** or **Rejected**, and a decision is final. "Available" means free
for the event's own period, counted the way SCRUM-29 counts it: confirmed
reservations and maintenance holds at the busiest moment.

| ID | Type | Criterion | Automated |
|---|---|---|---|
| [TC-28-01](#tc-28-01) | Positive | AC 1 | Unit, integration, e2e |
| [TC-28-02](#tc-28-02) | Positive | AC 2 | Unit, integration, e2e |
| [TC-28-03](#tc-28-03) | Positive | AC 3 | Unit, integration, e2e |
| [TC-28-04](#tc-28-04) | Negative | AC 3 | Unit, e2e |
| [TC-28-05](#tc-28-05) | Negative | AC 2, AC 3 | Unit, integration |
| [TC-28-06](#tc-28-06) | Concurrency | AC 7 | Unit, integration |
| [TC-28-07](#tc-28-07) | Positive | AC 4 | Unit, integration, e2e |
| [TC-28-08](#tc-28-08) | Negative, Boundary | AC 4 | Unit, integration, e2e |
| [TC-28-09](#tc-28-09) | Positive | AC 5 | Unit, integration, e2e |
| [TC-28-10](#tc-28-10) | Positive | AC 6 | Unit, integration, e2e |
| [TC-28-11](#tc-28-11) | Negative | Technical Support only | Unit, e2e |

---

### TC-28-01

| Item | Content |
|---|---|
| Test Case ID | TC-28-01 |
| Test Scenario | [Positive] AC 1: the queue lists requests oldest first, each line with its equipment details, technical requirements and what is free |
| Pre-conditions | A request in Pending Review whose lines include one that fits and one that doesn't. |
| Test Steps | 1. Open **Equipment Requests**. <br> 2. Find the request under **Waiting for review**. |
| Test Data | Request lines: Lectern × 5 "Gooseneck mic" (pool of 4); Projector × 1 |
| Expected Result | The request shows its event and dates, who asked and when, and its notes. Each line shows the type, its specs, the quantity and the technical requirements ("None given" when blank), and how it stands for the event: "Available: 10 of 10 free for this event." for the Projector, "Unavailable: only 4 of 4 free for this event, 1 short." for the Lectern. |

**Automated by:** `e2e/equipment-request-review.spec.ts` › "SCRUM-28 [AC1] TC-28-01: a pending request shows every line's equipment details, requirements and availability"; `tests/unit/equipment-request-review-queries.test.ts` › "SCRUM-28 [AC1, AC6] TC-28-01, TC-28-10: reads every request, oldest first, with each line's equipment details and the history", "SCRUM-28 [AC1, AC4] TC-28-01, TC-28-07: an open request's lines carry what is free for the event, and a short line its alternatives"; `tests/integration/equipment-request-review.test.ts` › "SCRUM-28 [AC1, AC4] TC-28-01, TC-28-07: the queue shows each line against real reservations, and offers alternatives for a short one"; `e2e/equipment-request-review.spec.ts` › "SCRUM-28 [AC1] TC-28-01: Technical Support finds the queue in their navigation, with requests waiting for review first" (step 1: **Equipment Requests** is in the navigation and opens on **Waiting for review**)

### TC-28-02

| Item | Content |
|---|---|
| Test Case ID | TC-28-02 |
| Test Scenario | [Positive] AC 2: taking a request into review |
| Pre-conditions | As TC-28-01. |
| Test Steps | 1. Click **Start review** on the request. |
| Test Data | Seeded `eqr_planning` |
| Expected Result | "Review started. The coordinator has been notified." The status becomes **In Review**, and the note, **Approve** and **Reject** appear. |

**Automated by:** `e2e/equipment-request-review.spec.ts` › "SCRUM-28 [AC2, AC3, AC5, AC6] TC-28-02, TC-28-03, TC-28-09, TC-28-10: reviewing then approving updates the status, notifies the coordinator and logs each change"; `tests/integration/equipment-request-review.test.ts` › "SCRUM-28 [AC2, AC3, AC5, AC6] TC-28-02, TC-28-03, TC-28-09, TC-28-10: review then approval each move the request, log one entry and notify the coordinator once"; `tests/unit/equipment-request-review.test.ts` › "SCRUM-28 [AC2, AC5, AC6] TC-28-02, TC-28-09, TC-28-10: takes a pending request into review, records it and tells the coordinator"; `tests/unit/equipment-request-review-rules.test.ts` › "allows %s → %s" (PENDING_REVIEW → IN_REVIEW)

### TC-28-03

| Item | Content |
|---|---|
| Test Case ID | TC-28-03 |
| Test Scenario | [Positive] AC 3: approving a request in review, with an optional note |
| Pre-conditions | The request is In Review (TC-28-02). |
| Test Steps | 1. Type the note below. <br> 2. Click **Approve**. <br> 3. Open **Decided**. |
| Test Data | Note: "Lecterns swapped for laptops." |
| Expected Result | "Request approved. The coordinator has been notified." The request moves to **Decided** as **Approved**, with the time it was decided. |

**Automated by:** `e2e/equipment-request-review.spec.ts` › "SCRUM-28 [AC2, AC3, AC5, AC6] TC-28-02, TC-28-03, TC-28-09, TC-28-10: …"; `tests/unit/equipment-request-review.test.ts` › "SCRUM-28 [AC3, AC5] TC-28-03, TC-28-09: approves a request in review, stamping the decision and passing on the note"; `tests/integration/equipment-request-review.test.ts` › "SCRUM-28 [AC2, AC3, AC5, AC6] TC-28-02, TC-28-03, TC-28-09, TC-28-10: review then approval each move the request, log one entry and notify the coordinator once"

### TC-28-04

| Item | Content |
|---|---|
| Test Case ID | TC-28-04 |
| Test Scenario | [Negative] AC 3: rejecting needs a reason |
| Pre-conditions | The request is In Review. |
| Test Steps | 1. Click **Reject** with the note empty. <br> 2. Type the reason below and click **Reject** again. |
| Test Data | Reason: "Not enough lecterns that day." |
| Expected Result | Step 1 shows "Give the coordinator a reason for rejecting the request." under the note, and the request stays In Review. Step 2 shows "Request rejected. The coordinator has been notified." and the request is **Rejected**, with the reason in its history. |

**Automated by:** `e2e/equipment-request-review.spec.ts` › "SCRUM-28 [AC3] TC-28-04: rejecting needs a reason, and the reason is recorded"; `tests/unit/equipment-request-review.test.ts` › "SCRUM-28 [AC3] TC-28-04: a rejection without a reason is refused next to the note, and nothing is written", "SCRUM-28 [AC3, AC6] TC-28-04, TC-28-10: rejects a request in review with the reason"; `tests/unit/equipment-request-review-rules.test.ts` › "SCRUM-28 [AC3] TC-28-04: requires a reason to reject, so the coordinator knows why"

### TC-28-05

| Item | Content |
|---|---|
| Test Case ID | TC-28-05 |
| Test Scenario | [Negative] AC 2, AC 3: a decision is final, and a request can't skip being reviewed first |
| Pre-conditions | Requests in the statuses below. |
| Test Steps | 1. Send each status change directly to the action (the page never offers them). |
| Test Data | Pending Review → Approved; Pending Review → Rejected; Approved → Rejected; Rejected → In Review |
| Expected Result | Each is refused with "This request is &lt;current&gt;, so it can't be marked &lt;new&gt;." and nothing is written. |

**Automated by:** `tests/unit/equipment-request-review.test.ts` › "SCRUM-28 [AC2, AC3] TC-28-05: refuses %s → %s, and writes nothing"; `tests/unit/equipment-request-review-rules.test.ts` › "refuses %s → %s"; `tests/integration/equipment-request-review.test.ts` › "SCRUM-28 [AC2, AC3] TC-28-05: a request cannot be approved before it is reviewed, and stays Pending Review"

### TC-28-06

| Item | Content |
|---|---|
| Test Case ID | TC-28-06 |
| Test Scenario | [Concurrency] AC 7: two reviewers act on the same request at the same moment; only the first update is saved |
| Pre-conditions | A request in Pending Review. Two Technical Support sessions. |
| Test Steps | 1. In both sessions, click **Start review** at the same moment. |
| Test Data | Any pending request |
| Expected Result | One session is told the review started. The other gets "Someone else updated this request first. Refresh to see its current status." The request has one history entry and the coordinator one notification, not two. |

**Automated by:** `tests/integration/equipment-request-review.test.ts` › "SCRUM-28 [AC7] TC-28-06: two reviewers taking the same request at once — one succeeds, one is told, nothing is doubled"; `tests/unit/equipment-request-review.test.ts` › "SCRUM-28 [AC7] TC-28-06: when another reviewer changes the request first, says so and records nothing"

### TC-28-07

| Item | Content |
|---|---|
| Test Case ID | TC-28-07 |
| Test Scenario | [Positive] AC 4: an unavailable line gets an alternative chosen from the inventory |
| Pre-conditions | The request is In Review and its Lectern line is short. |
| Test Steps | 1. Under the Lectern line, open **Suggest instead of Lectern**. <br> 2. Choose Laptop and click **Suggest**. |
| Test Data | Lectern × 5 (4 free); Laptop (15 free) |
| Expected Result | The list offers only other types with at least 5 free for the event, never Lectern itself. "Laptop suggested to the coordinator." The line shows "Suggested instead: Laptop", and so does the coordinator's view of the request. |

**Automated by:** `e2e/equipment-request-review.spec.ts` › "SCRUM-28 [AC4, AC5, AC6] TC-28-07, TC-28-09, TC-28-10: an unavailable line gets an alternative, and the coordinator sees it and the history"; `tests/unit/equipment-request-review.test.ts` › "SCRUM-28 [AC4, AC5] TC-28-07, TC-28-09: records the alternative on the short line, logs it and tells the coordinator"; `tests/unit/equipment-request-review-rules.test.ts` › "SCRUM-28 [AC4] TC-28-07: a line that is short offers every other type that could cover the whole quantity"; `tests/integration/equipment-request-review.test.ts` › "SCRUM-28 [AC4, AC5] TC-28-07, TC-28-09: suggesting an alternative for the short line saves it, logs it and tells the coordinator"

### TC-28-08

| Item | Content |
|---|---|
| Test Case ID | TC-28-08 |
| Test Scenario | [Negative] [Boundary] AC 4: an alternative is only for unavailable equipment, and must itself be available |
| Pre-conditions | As TC-28-07. |
| Test Steps | 1. Look for the suggestion list on a line that fits. <br> 2. Before starting the review, look at the short line. <br> 3. Send the suggestions below directly to the action. |
| Test Data | (a) the Projector line, which fits <br> (b) Lectern as its own alternative <br> (c) an alternative with fewer free than the quantity <br> (d) an alternative with exactly the quantity free |
| Expected Result | Step 1: no suggestion list. Step 2: "Start the review to suggest an alternative." (a) "Projector has enough free for this event, so there is nothing to replace." (b) "Choose a different equipment type." (c) "Only N of M &lt;type&gt; are free for this event: K short." (d) is offered in the list. Nothing is written for (a) to (c). |

**Automated by:** `e2e/equipment-request-review.spec.ts` › "SCRUM-28 [AC4, AC5, AC6] TC-28-07, TC-28-09, TC-28-10: …" (steps 1 and 2); `tests/unit/equipment-request-review.test.ts` › "SCRUM-28 [AC4] TC-28-08: only for equipment that is unavailable", "SCRUM-28 [AC4] TC-28-08: the alternative must itself be available for the whole quantity", "SCRUM-28 [AC4] TC-28-08: the alternative must be a different type from the inventory", "SCRUM-28 [AC4] TC-28-08: only while the request is in review"; `tests/unit/equipment-request-review-rules.test.ts` › "SCRUM-28 [AC4] TC-28-08: an alternative with exactly the quantity free is offered, one fewer is not"; `tests/integration/equipment-request-review.test.ts` › "SCRUM-28 [AC4] TC-28-08: no alternative is taken for a line that is available"

### TC-28-09

| Item | Content |
|---|---|
| Test Case ID | TC-28-09 |
| Test Scenario | [Positive] AC 5: every saved update notifies the Event Coordinator once |
| Pre-conditions | As TC-28-02. |
| Test Steps | 1. Start the review. <br> 2. Suggest an alternative. <br> 3. Approve. <br> 4. Check the coordinator's notifications. |
| Test Data | As TC-28-02, TC-28-07, TC-28-03 |
| Expected Result | The coordinator who raised the request has one `EQUIPMENT_REQUEST_UPDATED` notification per update, linking to `/equipment-requests`: "Your equipment request for "…" is now In Review.", "Technical Support suggested Laptop instead of Lectern for "…": only 4 of 4 Lectern are free.", "… is now Approved. Note: …". The list that shows them is SCRUM-48. |

**Automated by:** `e2e/equipment-request-review.spec.ts` › "SCRUM-28 [AC2, AC3, AC5, AC6] TC-28-02, TC-28-03, TC-28-09, TC-28-10: …", "SCRUM-28 [AC4, AC5, AC6] TC-28-07, TC-28-09, TC-28-10: …"; `tests/unit/equipment-request-review.test.ts` › "SCRUM-28 [AC2, AC5, AC6] TC-28-02, TC-28-09, TC-28-10: takes a pending request into review, records it and tells the coordinator", "SCRUM-28 [AC4, AC5] TC-28-07, TC-28-09: …"; `tests/integration/equipment-request-review.test.ts` › "SCRUM-28 [AC2, AC3, AC5, AC6] TC-28-02, TC-28-03, TC-28-09, TC-28-10: …"

### TC-28-10

| Item | Content |
|---|---|
| Test Case ID | TC-28-10 |
| Test Scenario | [Positive] AC 6: a request shows a chronological history of all updates |
| Pre-conditions | A request that has been submitted, reviewed, given a suggestion and approved. |
| Test Steps | 1. Open **History** on the request, as Technical Support. <br> 2. Sign in as the coordinator and open **History** on the same request. |
| Test Data | As TC-28-09 |
| Expected Result | Both show the same entries, oldest first, each with its time and who made it: "Submitted as Pending Review", "Pending Review → In Review", "Suggested Laptop instead of Lectern (only 4 of 4 free).", "In Review → Approved" with its note. |

**Automated by:** `e2e/equipment-request-review.spec.ts` › "SCRUM-28 [AC2, AC3, AC5, AC6] TC-28-02, TC-28-03, TC-28-09, TC-28-10: …", "SCRUM-28 [AC4, AC5, AC6] TC-28-07, TC-28-09, TC-28-10: …"; `tests/unit/equipment-request-queries.test.ts` › "SCRUM-28 [AC4, AC6] TC-28-07, TC-28-10: includes suggested alternatives and the history, oldest first"; `tests/integration/equipment-request-review.test.ts` › "SCRUM-28 [AC2, AC3, AC5, AC6] TC-28-02, TC-28-03, TC-28-09, TC-28-10: …"

### TC-28-11

| Item | Content |
|---|---|
| Test Case ID | TC-28-11 |
| Test Scenario | [Negative] only Technical Support can review a request |
| Pre-conditions | Seeded users for each role. |
| Test Steps | 1. Sign in as each role below. <br> 2. Call the review actions directly. <br> 3. As the coordinator, open the request on the page. |
| Test Data | Roles: ORGANISER, COORDINATOR, VENUE_STAFF, ATTENDEE |
| Expected Result | Each call is refused with "You do not have permission to do that." before anything is read. The coordinator's page shows the request with no **Start review**, **Approve** or **Reject**. |

**Automated by:** `tests/unit/equipment-request-review.test.ts` › "refuses %s before reading anything" (both actions, all four roles); `tests/unit/auth.test.ts` › "does not let %s review an equipment request"; `e2e/equipment-request-review.spec.ts` › "SCRUM-28 [AC4, AC5, AC6] TC-28-07, TC-28-09, TC-28-10: …" (coordinator view)
