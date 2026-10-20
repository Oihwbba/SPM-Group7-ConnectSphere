# SCRUM-108 — Answer a clarification, or amend and resubmit a rejected request: test cases

Story and acceptance criteria: [docs/backlog/SCRUM-108.md](../backlog/SCRUM-108.md)
(AC 11's 4 Oct extension, where rejecting an unassigned request made the
rejecting Coordinator its coordinator, is superseded by SCRUM-135 AC 4: see
TC-108-07). Format and conventions: [README.md](README.md).
Clarifications are handled in
[app/(app)/events/clarification-actions.ts](<../../app/(app)/events/clarification-actions.ts>),
resubmission and decisions in
[app/(app)/events/actions.ts](<../../app/(app)/events/actions.ts>). The
decisions behind them are [ADR 0014](../adr/0014-clarification-fields-and-resubmission.md).

**Shared pre-conditions for every case:** the database is migrated and seeded
and the app is running. Unless the case says otherwise, the event is owned by
`organiser@test.local` and assigned to `coordinator@test.local` (both
`Password123!`).

| ID                      | Type     | Criterion                       | Automated            |
| ----------------------- | -------- | ------------------------------- | -------------------- |
| [TC-108-01](#tc-108-01) | Positive | AC 1                            | Unit                 |
| [TC-108-02](#tc-108-02) | Positive | AC 2, AC 3, AC 14               | Unit                 |
| [TC-108-03](#tc-108-03) | Boundary | AC 4                            | Unit                 |
| [TC-108-04](#tc-108-04) | Negative | AC 5                            | Unit                 |
| [TC-108-05](#tc-108-05) | Positive | AC 9, AC 11, AC 14              | Unit                 |
| [TC-108-06](#tc-108-06) | Superseded | AC 11                         | —                    |
| [TC-108-07](#tc-108-07) | Superseded | AC 11                         | —                    |
| [TC-108-08](#tc-108-08) | Negative | AC 12                           | Unit                 |
| [TC-108-09](#tc-108-09) | Negative | AC 13                           | Unit                 |
| [TC-108-10](#tc-108-10) | Positive | AC 1, AC 2, AC 3, AC 14         | e2e                  |
| [TC-108-11](#tc-108-11) | Positive | AC 7, AC 9, AC 10, AC 11, AC 14 | e2e                  |
| [TC-108-12](#tc-108-12) | Positive | AC 6, AC 8, AC 10               | Unit, e2e (existing) |
| [TC-108-13](#tc-108-13) | Boundary | AC 9, AC 11, AC 14              | Unit                 |
| [TC-108-14](#tc-108-14) | Boundary | AC 11, AC 14                    | Unit                 |

---

### TC-108-01

| Item            | Content                                                                                                                         |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Test Case ID    | TC-108-01                                                                                                                       |
| Test Scenario   | [Positive] AC 1: the Coordinator ticks which request-form fields the Organiser may change; none ticked means a text answer only |
| Pre-conditions  | Signed in as the assigned Coordinator. The event is Under Review.                                                               |
| Test Steps      | 1. Click **Ask** on the event. <br> 2. Write the question and tick fields (or none). <br> 3. Send.                              |
| Test Data       | (a) Expected attendance and Date and time <br> (b) no fields <br> (c) a field that isn't on the form (direct request)           |
| Expected Result | (a) Both are stored with the question, each once. (b) Stored with no fields: text answer only. (c) Refused; nothing created.    |

**Automated by:** `tests/unit/clarification-and-amend.test.ts` › "SCRUM-108 [AC1] TC-108-01: …" (three tests)

### TC-108-02

| Item            | Content                                                                                                                                                                                                                                                                                                                |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Test Scenario   | [Positive] AC 2, AC 3, AC 14: the answer changes the named fields; only changed values are written and each change is recorded with who; the event stays Under Review and the Coordinator is notified                                                                                                                  |
| Pre-conditions  | An open clarification naming Expected attendance and Room layout. Signed in as the Organiser.                                                                                                                                                                                                                          |
| Test Steps      | 1. Open the event. <br> 2. Change the named fields, write a response, send.                                                                                                                                                                                                                                            |
| Test Data       | Attendance 400 → 350, layout unchanged; also a new date and time; also a text-only answer; and invalid values (start without end, past start, end not after start, attendance 0, blank name, a field not on the form)                                                                                                  |
| Expected Result | Only attendance is written; history has the answer and one change (400 → 350) by the Organiser; the event stays Under Review; the Coordinator is notified. A new date writes start and end together. A text-only answer writes nothing to the event. Invalid values are refused as the request form would refuse them. |

**Automated by:** `tests/unit/clarification-and-amend.test.ts` › "SCRUM-108 [AC2, AC3, AC14] TC-108-02: …", "SCRUM-108 [AC2, AC14] TC-108-02: …", "SCRUM-108 [AC2] TC-108-02: …" (text-only, the validation cases, and each error returned under its own field)

### TC-108-03

| Item            | Content                                                                                                         |
| --------------- | --------------------------------------------------------------------------------------------------------------- |
| Test Scenario   | [Boundary] AC 4: saving the same answer again changes nothing                                                   |
| Pre-conditions  | The clarification was answered "Theatre layout."                                                                |
| Test Steps      | 1. Send the same answer again. <br> 2. Send a different answer.                                                 |
| Test Data       | —                                                                                                               |
| Expected Result | (1) Reported as saved; nothing is written. (2) Refused: "This clarification request has already been answered." |

**Automated by:** `tests/unit/clarification-and-amend.test.ts` › "SCRUM-108 [AC4] TC-108-03: …" (both)

### TC-108-04

| Item            | Content                                                                                                                            |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Test Scenario   | [Negative] AC 5: a field the clarification didn't name can't be changed through the answer                                         |
| Pre-conditions  | An open clarification naming Expected attendance and Room layout.                                                                  |
| Test Steps      | 1. Send an answer that also changes the event name (direct request).                                                               |
| Test Data       | name "Summit 2031"                                                                                                                 |
| Expected Result | Refused: "Only the fields your coordinator named can be changed here. Use a change request for anything else." Nothing is written. |

**Automated by:** `tests/unit/clarification-and-amend.test.ts` › "SCRUM-108 [AC5] TC-108-04: …"

### TC-108-05

| Item            | Content                                                                                                                                                                                                                                                                                                                                                                                                                    |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Test Scenario   | [Positive] AC 9, AC 11, AC 14: the amended request goes back Under Review to the same Coordinator, without automatic assignment, and the resubmission is recorded                                                                                                                                                                                                                                                          |
| Pre-conditions  | The event was rejected with Amend and resubmit; its Coordinator still holds the role.                                                                                                                                                                                                                                                                                                                                      |
| Test Steps      | 1. Amend and resubmit it, changing the description and the expected attendance.                                                                                                                                                                                                                                                                                                                                            |
| Test Data       | —                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Expected Result | The same event is updated (no new event); it ends Under Review with the same Coordinator, who is notified; automatic assignment doesn't run; history records Rejected → Submitted by the Organiser and Submitted → Under Review. The amendment changed the description and attendance, so history also has one change entry for each, by the Organiser, with the old and new value; fields left as they were get no entry. |

**Automated by:** `tests/unit/clarification-and-amend.test.ts` › "SCRUM-108 [AC9, AC11, AC14] TC-108-05, SCRUM-165 [AC9] TC-165-12: the amended request goes back to the same Coordinator, and the resubmission is recorded"

### TC-108-06

**Superseded** on 20 Oct 2026 by SCRUM-165 AC 9 ([TC-165-12](SCRUM-165.md#tc-165-12)). When the previous Coordinator no longer held the role, or there was none, automatic assignment picked the least-loaded Coordinator. Automatic assignment no longer exists: the resubmitted request waits in the Lead's queue, Submitted with no Coordinator.

**Automated by** (SCRUM-165's tests): `tests/unit/clarification-and-amend.test.ts` › "SCRUM-165 [AC9] TC-165-12 (supersedes SCRUM-108 AC11): when $when, the resubmitted request waits in the Lead's queue, Submitted with no Coordinator" (both cases)

### TC-108-07

**Superseded (14 Oct) by SCRUM-135 AC 4** (Week 7 change 5: Coordinators
manage only events assigned to them). A Submitted request with no Coordinator
can no longer be rejected, so nobody becomes its coordinator that way. See
[TC-135-04](SCRUM-135.md#tc-135-04).

### TC-108-08

| Item            | Content                                                                                             |
| --------------- | --------------------------------------------------------------------------------------------------- |
| Test Scenario   | [Negative] AC 12: resubmitting twice creates no duplicate submission, history entry or notification |
| Pre-conditions  | The event was already resubmitted.                                                                  |
| Test Steps      | 1. Send the resubmission again (e.g. a double-click or an older tab).                               |
| Test Data       | —                                                                                                   |
| Expected Result | Refused; no history entry or notification is written.                                               |

**Automated by:** `tests/unit/clarification-and-amend.test.ts` › "SCRUM-108 [AC12] TC-108-08: …"

### TC-108-09

| Item            | Content                                                          |
| --------------- | ---------------------------------------------------------------- |
| Test Scenario   | [Negative] AC 13: only the event's Organiser can answer or amend |
| Pre-conditions  | Signed in as a Coordinator.                                      |
| Test Steps      | 1. Send an answer. <br> 2. Send a resubmission.                  |
| Test Data       | —                                                                |
| Expected Result | Both refused for lack of permission; nothing is read.            |

**Automated by:** `tests/unit/clarification-and-amend.test.ts` › "SCRUM-108 [AC13] TC-108-09: …"

### TC-108-10

| Item            | Content                                                                                                                                                                                                                                                                                                                                                                             |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Test Scenario   | [Positive] AC 1, AC 2, AC 3, AC 14: the whole clarification journey with one named field                                                                                                                                                                                                                                                                                            |
| Pre-conditions  | The event is Under Review with 400 expected attendees, classroom layout.                                                                                                                                                                                                                                                                                                            |
| Test Steps      | 1. As the Coordinator, **Ask**, tick **Expected attendance**, send. <br> 2. As the Organiser, open the event, first try attendance 0, then change it to 300 and respond.                                                                                                                                                                                                            |
| Test Data       | —                                                                                                                                                                                                                                                                                                                                                                                   |
| Expected Result | The Organiser sees "The organiser may change: Expected attendance." and no other field to edit. Attendance 0 is refused with "Attendance must be a positive whole number." next to the box, and the clarification stays open. After sending 300, attendance is 300, the layout is unchanged, the event is Under Review, and history has the answer and the change by the Organiser. |

**Automated by:** `e2e/clarification-and-amend.spec.ts` › "SCRUM-108 [AC1, AC2, AC3, AC14] TC-108-10: …"

### TC-108-11

| Item            | Content                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Test Scenario   | [Positive] AC 7, AC 9, AC 10, AC 11, AC 14: amending shows the rejection reason throughout, and the request returns to the same Coordinator                                                                                                                                                                                                                                                                                                                                         |
| Pre-conditions  | The event was rejected by `coordinator@test.local` with Amend and resubmit and a reason.                                                                                                                                                                                                                                                                                                                                                                                            |
| Test Steps      | 1. As the Organiser, click **Amend & Resubmit**. <br> 2. First enter a start date in the past (refused), then the original dates; change the venue requirements and submit.                                                                                                                                                                                                                                                                                                         |
| Test Data       | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Expected Result | The rejection reason is shown on the form on every step. A past start date is refused with "Proposed date cannot be in the past.", as in a first submission (AC 10). The same event ends Under Review with the same Coordinator and no reassignment; history records the resubmission by the Organiser, and the venue requirements change by the Organiser with the old and new value. The rejection entry and its reason are still in history, and every history entry has a time. |

**Automated by:** `e2e/clarification-and-amend.spec.ts` › "SCRUM-108 [AC7, AC9, AC10, AC11, AC14] TC-108-11: …"

### TC-108-12

| Item            | Content                                                                                                                                                                             |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Test Scenario   | [Positive] AC 6, AC 8, AC 10: behaviour already built by earlier stories                                                                                                            |
| Pre-conditions  | —                                                                                                                                                                                   |
| Test Steps      | —                                                                                                                                                                                   |
| Test Data       | —                                                                                                                                                                                   |
| Expected Result | AC 6: a decision closes any open clarification. AC 8: after Submit as a new request, Amend & Resubmit isn't offered. AC 10: resubmitting applies the first submission's validation. |

**Automated by:** AC 6: `tests/unit/event-status.test.ts` › "SCRUM-18: deciding an event closes its still-OPEN clarification …". AC 8: `tests/unit/rejection-outcome.test.ts` › "SCRUM-126 [AC3] TC-126-04: …" and `e2e/rejection-outcome.spec.ts` › TC-126-08. AC 10: `e2e/clarification-and-amend.spec.ts` › "SCRUM-108 [AC7, AC9, AC10, AC11, AC14] TC-108-11: …" (an amended request with a start in the past is stopped with "Proposed date cannot be in the past.", as a first submission is).

### TC-108-13

| Item            | Content                                                                                                                                                                                                                                |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Test Scenario   | [Boundary] AC 9, AC 11, AC 14: a rejected request resubmitted without changing any field                                                                                                                                               |
| Pre-conditions  | The event was rejected with Amend and resubmit; its Coordinator still holds the role.                                                                                                                                                  |
| Test Steps      | 1. Amend and resubmit it, leaving every field as it was.                                                                                                                                                                               |
| Test Data       | —                                                                                                                                                                                                                                      |
| Expected Result | The resubmission succeeds: the event ends Under Review with the same Coordinator, who is notified, and history records Rejected → Submitted and Submitted → Under Review, with no change entries. Raised by the GLM review of PR #129. |

**Automated by:** `tests/unit/clarification-and-amend.test.ts` › "SCRUM-108 [AC9, AC11, AC14] TC-108-13: …"

### TC-108-14

| Item            | Content                                                                                                                                                                                                                                                              |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Test Scenario   | [Boundary] AC 11, AC 14: the previous Coordinator no longer holds the role and no Coordinator can be assigned                                                                                                                                                        |
| Pre-conditions  | The event was rejected with Amend and resubmit; its Coordinator has since lost the role, and no user holds it.                                                                                                                                                       |
| Test Steps      | 1. Amend and resubmit it.                                                                                                                                                                                                                                            |
| Test Data       | —                                                                                                                                                                                                                                                                    |
| Expected Result | The resubmission succeeds and the event stays Submitted with no Coordinator, like a first submission, so it waits in the Lead's Unassigned queue (SCRUM-165 AC 9, [TC-165-12](SCRUM-165.md#tc-165-12), which supersedes showing it in every Coordinator's queue). History records the unassignment from the previous Coordinator. Raised by the GLM review of PR #129. |

**Automated by:** `tests/unit/clarification-and-amend.test.ts` › "SCRUM-108 [AC14] TC-108-14, SCRUM-165 [AC9] TC-165-12: when its Coordinator lost the role, the resubmitted request returns to the queue and the history records who held it"
