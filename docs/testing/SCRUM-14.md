# SCRUM-14 — Submit an event request for review: test cases

Story and acceptance criteria: [docs/backlog/SCRUM-14.md](../backlog/SCRUM-14.md).
Format and conventions: [README.md](README.md). A request is submitted by
`submitEventRequest` in
[app/(app)/events/actions.ts](<../../app/(app)/events/actions.ts>), which locks
the draft row before checking its status. Since SCRUM-165 the request then
waits, Submitted with no Coordinator, in the Lead's Unassigned queue; before
that, SCRUM-20 assigned a Coordinator in the same transaction.

Written on 2026-10-12 from the acceptance criteria, then mapped to the tests
that already existed (SCRUM-176). The tests predate the `SCRUM-n [ACx] TC-n-xx`
title format, so each case names them by their current titles.

**Shared pre-conditions for every case:** the database is migrated and seeded
and the app is running. Signed in as `organiser@test.local` (`Password123!`),
unless the case says otherwise. The seed has active Coordinators.

| ID | Type | Criterion | Automated |
|---|---|---|---|
| [TC-14-01](#tc-14-01) | Positive | AC 1 | Unit, e2e |
| [TC-14-02](#tc-14-02) | Superseded | AC 1 | — (SCRUM-165: TC-165-01) |
| [TC-14-03](#tc-14-03) | Negative | AC 2 | Unit, e2e |
| [TC-14-04](#tc-14-04) | Negative | AC 3 | Unit, integration |
| [TC-14-05](#tc-14-05) | Concurrency | AC 3 | Unit, integration |
| [TC-14-06](#tc-14-06) | Negative | AC 4 | Unit |

---

### TC-14-01

| Item | Content |
|---|---|
| Test Case ID | TC-14-01 |
| Test Scenario | [Positive] AC 1: a complete request is submitted and becomes visible for assignment |
| Pre-conditions | Signed in as the Organiser. |
| Test Steps | 1. On **My Events**, click **Create Event Request**. <br> 2. Fill every field marked `*` on each step, clicking **Next** between steps. <br> 3. On **Review Entered Details**, click **Submit Request for Review**. <br> 4. Sign in as the Lead (`lead@test.local`) and open the Unassigned queue. |
| Test Data | Event name "Regional Innovation Summit", attendance 250, a start a month from now, an end two hours later |
| Expected Result | The request appears on the Organiser's list. It is Submitted with no Coordinator, and the Lead sees it in the Unassigned queue. |

**Superseded in part** on 20 Oct 2026 by SCRUM-165 AC 1 ([TC-165-01](SCRUM-165.md#tc-165-01)): a Coordinator was assigned in the same action and the request moved Under Review; it now waits for the Lead. The SCRUM-20 race test that covered the assignment was removed.

**Automated by:** `tests/unit/events.test.ts` › "SCRUM-13 [AC1, AC10] TC-13-01, SCRUM-14 [AC1] TC-14-01: [, Happy Path] successfully creates complete event request when all mandatory and optional fields are valid", "SCRUM-15 [AC5] TC-15-07, SCRUM-14 [AC1] TC-14-01: [State Transition] transitions draft status from DRAFT to SUBMITTED when draft is fully completed and submitted", "SCRUM-16 [AC2], SCRUM-14 [AC1] TC-14-01: [State Transition] updates status from DRAFT to SUBMITTED upon submission, removing draft state"; `e2e/events.spec.ts` › "SCRUM-13 [AC1, AC3, AC10] TC-13-01, TC-13-04, SCRUM-14 [AC1] TC-14-01: organiser fills event request sections, reviews details, and submits request"; `tests/unit/submission-queue.test.ts` › "SCRUM-165 [AC1] TC-165-01: [Positive] a new request stays Submitted with no Coordinator"; `e2e/lead-queue.spec.ts` › "SCRUM-14 [AC1] TC-14-01, SCRUM-135 [AC2, AC6] TC-135-02, SCRUM-164 [AC2] TC-164-05, SCRUM-165 [AC1, AC2, AC3, AC4, AC5, AC8, AC11] TC-165-01, TC-165-02, TC-165-04, TC-165-05, TC-165-07, TC-165-11, TC-165-14: a submitted request waits in the queue, the Lead assigns it, and only then does the Coordinator get it"

### TC-14-02

**Superseded** on 20 Oct 2026 by SCRUM-165 AC 1 ([TC-165-01](SCRUM-165.md#tc-165-01)). With no Coordinator to assign, the request stayed Submitted. Every request now stays Submitted with no Coordinator until the Lead assigns one, so TC-14-01 covers this case.

**Automated by** (SCRUM-165's tests): `tests/unit/submission-queue.test.ts` › "SCRUM-165 [AC1] TC-165-01: [Positive] a new request stays Submitted with no Coordinator" and "SCRUM-165 [AC1] TC-165-01: [Positive] nobody is recorded as assigned until the Lead chooses"

### TC-14-03

| Item | Content |
|---|---|
| Test Case ID | TC-14-03 |
| Test Scenario | [Negative] AC 2: a request with required fields missing is not submitted, and the missing fields are marked |
| Pre-conditions | Signed in as the Organiser. |
| Test Steps | 1. Click **Create Event Request**. <br> 2. Click **Next** through every step without filling anything. <br> 3. On **Review Entered Details**, click **Submit Request for Review**. <br> 4. Click **1. Basics**. |
| Test Data | Every field empty |
| Expected Result | The review step asks to complete all required fields highlighted in red. Submitting shows "Please fix the highlighted fields before submitting.", and no request is created. On Basics, **Event Name** is marked invalid with "Event name is required."; each other required field shows its own message, for example "Venue requirements are required." |

**Automated by:** `tests/unit/events.test.ts` › "SCRUM-13 [AC4] TC-13-05, SCRUM-14 [AC2] TC-14-03, SCRUM-171 [AC2] TC-171-02: [Business-Rule Negative] returns field errors when any mandatory field is missing upon submission"; `e2e/events.spec.ts` › "SCRUM-13 [AC4] TC-13-05, SCRUM-14 [AC2] TC-14-03: submitting with mandatory fields left blank is refused and missing fields are indicated"

### TC-14-04

| Item | Content |
|---|---|
| Test Case ID | TC-14-04 |
| Test Scenario | [Negative] AC 3: submitting an already-submitted request again creates nothing and notifies no one again |
| Pre-conditions | Signed in as the Organiser, with a request they submitted (TC-14-01). |
| Test Steps | 1. Send the submission for the same request again, for example from a second tab that still shows the draft. <br> 2. Count the Organiser's requests and the Coordinators' notifications. |
| Test Data | The submitted request's id |
| Expected Result | The second submission is refused with "Draft or rejected event not found or cannot be submitted.". There is still one request, its status is unchanged, and no further notification was sent. |

**Automated by:** `tests/integration/concurrency.test.ts` › "SCRUM-14 [AC3] TC-14-04: SCRUM-14 AC: submitting the same event again is refused, creates no second request and sends no additional notification"; `tests/unit/events.test.ts` › "SCRUM-14 [AC3] TC-14-04: SCRUM-14 AC: submitting an id that is not the caller's DRAFT/REJECTED event is refused and writes nothing"

### TC-14-05

| Item | Content |
|---|---|
| Test Case ID | TC-14-05 |
| Test Scenario | [Concurrency] AC 3: two submissions of one draft at the same moment submit it once |
| Pre-conditions | Signed in as the Organiser in two tabs, both showing the same complete draft. |
| Test Steps | 1. Click **Submit Request for Review** in both tabs at the same moment. |
| Test Data | One complete draft |
| Expected Result | One submission succeeds and the other is refused. There is one request, one Coordinator assigned, and one notification. |

**Automated by:** `tests/integration/concurrency.test.ts` › "SCRUM-124 [AC10] TC-124-10, SCRUM-14 [AC3] TC-14-05, SCRUM-45 [AC1] TC-45-01: SCRUM-14 AC: two simultaneous submissions of one draft succeed once and notify once"; `tests/unit/events.test.ts` › "SCRUM-14 [AC3] TC-14-05: SCRUM-14 AC: the draft row is locked BEFORE its status is checked, so two simultaneous submissions cannot both pass"

### TC-14-06

| Item | Content |
|---|---|
| Test Case ID | TC-14-06 |
| Test Scenario | [Negative] AC 4: a submitted request can no longer be saved as a draft |
| Pre-conditions | Signed in as the Organiser, with a request they submitted. |
| Test Steps | 1. From a tab that still shows the draft form, change the name and click **Save as Draft**. |
| Test Data | The submitted request's id, a new name |
| Expected Result | Saving is refused with "Draft event not found or cannot be modified.", and the submitted request is unchanged. |

**Automated by:** `tests/unit/events.test.ts` › "SCRUM-14 [AC4] TC-14-06, SCRUM-16 [AC7] TC-16-04: [Business-Rule Negative] refuses to edit a caller's own event as a draft once it has been submitted"
