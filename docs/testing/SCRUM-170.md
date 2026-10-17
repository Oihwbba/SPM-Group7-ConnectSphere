# SCRUM-170 — Show the Organiser's requirements to the people planning the event

Test cases for [docs/backlog/SCRUM-170.md](../backlog/SCRUM-170.md). Format:
[README](README.md). Seeded accounts share the password `Password123!`.

The Organiser's answers are free text from the request form: venue
requirements, preferred room layout, accessibility needs (Venue &
Accessibility Requirements) and equipment requirements (Equipment & Technical
Support). They are shown read-only, never used to pre-fill anything. AC1 was
removed on 2026-10-08. AC6 needs SCRUM-38's venue search, which isn't built
yet.

| ID | Type | Criterion | Automated |
|---|---|---|---|
| [TC-170-01](#tc-170-01) | Positive | AC 2 | e2e |
| [TC-170-02](#tc-170-02) | Positive | AC 2 | Unit, e2e |
| [TC-170-03](#tc-170-03) | Positive | AC 3 | Unit, e2e |
| [TC-170-04](#tc-170-04) | Positive | AC 3 | Unit, e2e |
| [TC-170-05](#tc-170-05) | Positive, Boundary | AC 5 | Unit, e2e |
| [TC-170-06](#tc-170-06) | Positive | AC 4 | Unit, integration, e2e |
| [TC-170-07](#tc-170-07) | Negative | AC 4 | Unit, integration, e2e |
| [TC-170-08](#tc-170-08) | Positive | AC 4 | Unit, integration, e2e |
| [TC-170-09](#tc-170-09) | Boundary | AC 4 | Unit |
| [TC-170-10](#tc-170-10) | Negative | AC 4 | Unit, integration |
| [TC-170-11](#tc-170-11) | Concurrency | AC 4 | Unit, integration |
| [TC-170-12](#tc-170-12) | Positive | AC 4 | Unit, integration |
| [TC-170-13](#tc-170-13) | Positive | AC 6 | Manual, waits for SCRUM-38 |

### TC-170-01

| Item | Content |
|---|---|
| Test Case ID | TC-170-01 |
| Test Scenario | [Positive] AC 2: the Coordinator sees the Organiser's venue answers on the venue request form, and enters the layout and facilities themselves |
| Pre-conditions | Signed in as the assigned Coordinator of a Planning event whose Organiser answered "A hall near the lobby, with a stage", "Banquet, round tables" and "Hearing loop for the speeches". |
| Test Steps | 1. Open **Request a venue**. <br> 2. Choose the event. |
| Test Data | `coordinator@test.local` |
| Expected Result | "What the Organiser asked for" shows the three answers read-only. Room layout stays at No preference and no facility is selected: nothing is copied from the answers. |

**Automated by:** `e2e/organiser-requirements.spec.ts` › "SCRUM-170 [AC2, AC5] TC-170-01, TC-170-02, TC-170-05: …"

### TC-170-02

| Item | Content |
|---|---|
| Test Case ID | TC-170-02 |
| Test Scenario | [Positive] AC 2: Venue Staff see the same answers on the booking request they review |
| Pre-conditions | TC-170-01's request submitted for the Exhibition Hall, banquet layout. |
| Test Steps | 1. Sign in as Venue Staff and open **Bookings**. <br> 2. Find the request. |
| Test Data | `venuestaff@test.local` |
| Expected Result | Under "What the Organiser asked for", the request shows the venue requirements, preferred layout and accessibility needs exactly as entered, line breaks kept. |

**Automated by:** `tests/unit/booking-queue.test.tsx` › "SCRUM-170 [AC2] TC-170-02: …"; `e2e/organiser-requirements.spec.ts` › "SCRUM-170 [AC2, AC5] TC-170-01, TC-170-02, TC-170-05: …"

### TC-170-03

| Item | Content |
|---|---|
| Test Case ID | TC-170-03 |
| Test Scenario | [Positive] AC 3: the Coordinator sees the Organiser's equipment answer on the equipment request form, and enters the lines themselves |
| Pre-conditions | Signed in as the assigned Coordinator of a Planning event whose Organiser answered "Two wireless mics and a projector". |
| Test Steps | 1. Open **Equipment requests** and choose **New request**. <br> 2. Choose the event. |
| Test Data | `coordinator@test.local` |
| Expected Result | "What the Organiser asked for" shows "Equipment Requirements: Two wireless mics and a projector" read-only. No equipment line is added until the Coordinator adds one. |

**Automated by:** `tests/unit/equipment-request-queries.test.ts` › "SCRUM-27 [AC1] TC-27-01, SCRUM-170 [AC3] TC-170-03: …"; `tests/unit/organiser-answers.test.tsx` › "SCRUM-170 [AC3, AC5] TC-170-03, TC-170-05: …"; `e2e/organiser-requirements.spec.ts` › "SCRUM-170 [AC3] TC-170-03, TC-170-04: …"

### TC-170-04

| Item | Content |
|---|---|
| Test Case ID | TC-170-04 |
| Test Scenario | [Positive] AC 3: Technical Support see the same answer when they review the request |
| Pre-conditions | TC-170-03's request submitted with one projector. |
| Test Steps | 1. Sign in as Technical Support and open **Equipment requests**. <br> 2. Find the request. |
| Test Data | `techsupport@test.local` |
| Expected Result | The request shows the Organiser's equipment answer under "What the Organiser asked for". |

**Automated by:** `tests/unit/equipment-request-review-queries.test.ts` › "SCRUM-170 [AC3] TC-170-04: …"; `e2e/organiser-requirements.spec.ts` › "SCRUM-170 [AC3] TC-170-03, TC-170-04: …"

### TC-170-05

| Item | Content |
|---|---|
| Test Case ID | TC-170-05 |
| Test Scenario | [Positive] [Boundary] AC 5: every event's details show the Organiser's answers as entered, without Required Facilities |
| Pre-conditions | An event with the answers above and, from an older request, Required Facilities "stage"; another with a blank answer. |
| Test Steps | 1. Open the event's details. <br> 2. Open the other event's details. |
| Test Data | — |
| Expected Result | Venue & Accessibility Requirements lists Venue Requirements, Preferred Room Layout and Accessibility Needs; Equipment & Technical Support lists Equipment Requirements; each exactly as typed, line breaks kept. Required Facilities is not shown. A blank answer, or one of only spaces, shows "—". |

**Automated by:** `tests/unit/organiser-answers.test.tsx` › "SCRUM-170 [AC5] TC-170-05: …" (2 tests); `e2e/organiser-requirements.spec.ts` › "SCRUM-170 [AC2, AC5] TC-170-01, TC-170-02, TC-170-05: …"

### TC-170-06

| Item | Content |
|---|---|
| Test Case ID | TC-170-06 |
| Test Scenario | [Positive] AC 4: the assigned Coordinator records No equipment needed, which keeps who and when |
| Pre-conditions | A Planning event with an Approved venue booking and no equipment request. |
| Test Steps | 1. Open the event's details. <br> 2. On the readiness checklist, choose **No equipment needed**. <br> 3. Choose it again. |
| Test Data | `coordinator@test.local` |
| Expected Result | "Recorded: no equipment needed." The event stores who recorded it and when, and one audit entry records the change. Step 3 changes nothing and keeps the first time. |

**Automated by:** `tests/unit/equipment-decision.test.ts` › "SCRUM-170 [AC4] TC-170-06: …" (2 tests); `tests/integration/equipment-decision.test.ts` › "SCRUM-170 [AC4] TC-170-06, TC-170-07, TC-170-08: …"; `e2e/organiser-requirements.spec.ts` › "SCRUM-170 [AC4] TC-170-06, TC-170-07, TC-170-08: …"

### TC-170-07

| Item | Content |
|---|---|
| Test Case ID | TC-170-07 |
| Test Scenario | [Negative] AC 4: with no equipment request and nothing decided, Equipment is listed as Not decided and blocks confirmation |
| Pre-conditions | A Planning event with an Approved venue booking and no live equipment request: none, or only a cancelled one. |
| Test Steps | 1. Open the event's details. |
| Test Data | — |
| Expected Result | The checklist lists Equipment as "Not decided", incomplete, with **No equipment needed** offered to the Coordinator; the summary says "Not ready to confirm yet". An event with only a rejected request shows "Rejected" and is offered the same. (SCRUM-110 AC 3, which left the item out, is superseded.) |

**Automated by:** `tests/unit/event-readiness.test.ts` › "SCRUM-170 [AC4] TC-170-07: …", "SCRUM-110 TC-110-09, SCRUM-170 [AC4] TC-170-07: …"; `tests/integration/equipment-decision.test.ts`; `e2e/organiser-requirements.spec.ts`

### TC-170-08

| Item | Content |
|---|---|
| Test Case ID | TC-170-08 |
| Test Scenario | [Positive] AC 4: No equipment needed completes Equipment, so the event can be ready to confirm |
| Pre-conditions | TC-170-06 done. |
| Test Steps | 1. Look at the checklist as the Coordinator. <br> 2. Open the event as its Organiser. |
| Test Data | `organiser@test.local` |
| Expected Result | 1: Equipment is complete, "No equipment needed – Recorded by Cody Coordinator, …", and the summary reads "Ready to confirm". 2: the Organiser sees "No equipment needed" without who recorded it, and isn't offered the button. |

**Automated by:** `tests/unit/event-readiness.test.ts` › "SCRUM-110 [AC1, AC5] TC-110-01, SCRUM-170 [AC4] TC-170-08: …"; `tests/integration/equipment-decision.test.ts`; `e2e/organiser-requirements.spec.ts`

### TC-170-09

| Item | Content |
|---|---|
| Test Case ID | TC-170-09 |
| Test Scenario | [Boundary] AC 4: a live equipment request decides the item; No equipment needed isn't offered beside it |
| Pre-conditions | A Planning event with a Pending Review request. |
| Test Steps | 1. Open the event's details. |
| Test Data | — |
| Expected Result | Equipment reads from the request ("Not fully reserved: Projector"), and **No equipment needed** is not offered. |

**Automated by:** `tests/unit/event-readiness.test.ts` › "SCRUM-170 [AC4] TC-170-09: …"

### TC-170-10

| Item | Content |
|---|---|
| Test Case ID | TC-170-10 |
| Test Scenario | [Negative] AC 4: who can't record No equipment needed, and when it is refused |
| Pre-conditions | Planning events with and without a live request; events in other statuses. |
| Test Steps | 1. Record it on an event with a live request. <br> 2. On a Submitted, Under Review, Confirmed or Cancelled event. <br> 3. As another Coordinator, or on an unassigned event. <br> 4. As the Organiser, Venue Staff, Technical Support or an Attendee. |
| Test Data | — |
| Expected Result | 1: "This event has an equipment request. Withdraw it before recording that no equipment is needed." 2: "Equipment can only be decided while the event is in Planning." 3: "Event not found.", the same as a missing event, and the button isn't offered. 4: "You do not have permission to do that." Nothing is written in any case. |

**Automated by:** `tests/unit/equipment-decision.test.ts` › "SCRUM-170 [AC4] TC-170-10: …"; `tests/unit/readiness-actions.test.ts` › "SCRUM-170 [AC4] TC-170-10: …"; `tests/integration/equipment-decision.test.ts` › "SCRUM-170 [AC4] TC-170-10: …"

### TC-170-11

| Item | Content |
|---|---|
| Test Case ID | TC-170-11 |
| Test Scenario | [Concurrency] AC 4: a decision and an equipment request never stand together |
| Pre-conditions | A Planning event with No equipment needed recorded; another where it is being recorded. |
| Test Steps | 1. Create an equipment request for the first event. <br> 2. For the second, create a request while the decision is being recorded and its transaction is still open. |
| Test Data | One projector |
| Expected Result | 1: the decision is cleared, both who and when, and Equipment reads from the request. 2: the request waits for the event row, then clears the decision: the event ends with the request and no decision. |

**Automated by:** `tests/unit/equipment-request.test.ts` › "SCRUM-170 [AC4] TC-170-11: …"; `tests/unit/equipment-decision.test.ts` › "SCRUM-170 [AC4] TC-170-11: …"; `tests/integration/equipment-decision.test.ts` › "SCRUM-170 [AC4] TC-170-11: …" (2 tests)

### TC-170-12

| Item | Content |
|---|---|
| Test Case ID | TC-170-12 |
| Test Scenario | [Positive] AC 4: changing the event's equipment requirements puts Equipment back to Not decided |
| Pre-conditions | A Planning event with No equipment needed recorded. |
| Test Steps | 1. Change the equipment requirements directly (SCRUM-25). <br> 2. Approve a change request that changes them (SCRUM-128). |
| Test Data | — |
| Expected Result | Both clear who and when together, and Equipment shows "Not decided" again. |

**Automated by:** step 1 by `tests/unit/event-edit.test.ts` and `tests/integration/event-edit.test.ts` › "SCRUM-25 [AC3] TC-25-15: …" on SCRUM-25's branch (PR #186); step 2 by `tests/unit/change-decision.test.ts` and `tests/integration/change-decision.test.ts` › "SCRUM-170 [AC4] TC-170-12: …" on SCRUM-128's branch (PR #181).

### TC-170-13

| Item | Content |
|---|---|
| Test Case ID | TC-170-13 |
| Test Scenario | [Positive] AC 6: venue search opened from an event or its booking shows the Organiser's venue answers beside the filters |
| Pre-conditions | SCRUM-38's venue search (and SCRUM-161's Find a replacement venue). |
| Test Steps | 1. Open venue search from an event. <br> 2. Open it from one of the event's bookings. |
| Test Data | — |
| Expected Result | The venue requirements, preferred room layout and accessibility needs are shown read-only beside the filters, as in TC-170-01. |

**Automated by:** Manual. Not built: it waits for SCRUM-38, which will reuse `OrganiserVenueAnswers` from `components/events/organiser-answers.tsx`.
