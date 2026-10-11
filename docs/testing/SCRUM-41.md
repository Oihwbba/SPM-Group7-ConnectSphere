# SCRUM-41 — Raise and track a change request: test cases

Story and acceptance criteria: [docs/backlog/SCRUM-41.md](../backlog/SCRUM-41.md).
Format and conventions: [README.md](README.md). Change requests are raised in
[app/(app)/events/change-request-actions.ts](<../../app/(app)/events/change-request-actions.ts>),
validated by [lib/schemas/change-request.ts](../../lib/schemas/change-request.ts),
and shown in the event details dialog by
[components/events/change-request-panel.tsx](../../components/events/change-request-panel.tsx).
Deciding and applying them is SCRUM-128.

**Shared pre-conditions for every case:** the database is migrated and seeded
and the app is running. Unless the case says otherwise, the event is owned by
`organiser2@test.local` and assigned to `coordinator2@test.local` (both
`Password123!`), starts in the future, and has an expected attendance of 40.

**Two notes on the criteria:**

- **AC 4** was reworded on 2026-10-11 (conflict review with SCRUM-170): the
  request form's rules from SCRUM-13, with venue and equipment requirements as
  free text. It no longer asks for catalogue choices, since SCRUM-127, which
  would have made them so, was dropped on 2026-10-08. The change form offers
  the request form's catalogue suggestions to the Organiser.
- **AC 8, cancellation:** cancelling an event is SCRUM-82, not built yet. Its
  AC 3 rejects any Submitted change request with the cancellation reason, and
  its tests will cover that half. Rejecting from Under Review (this story) and
  from Planning (SCRUM-117, TC-117-08) are covered.

| ID                    | Type        | Criterion          | Automated                |
| --------------------- | ----------- | ------------------ | ------------------------ |
| [TC-41-01](#tc-41-01) | Positive    | AC 1, AC 5, AC 6   | Unit, integration        |
| [TC-41-02](#tc-41-02) | Positive    | AC 1               | Unit, e2e                |
| [TC-41-03](#tc-41-03) | Negative    | AC 1               | Unit, integration        |
| [TC-41-04](#tc-41-04) | Positive    | AC 1               | Unit                     |
| [TC-41-05](#tc-41-05) | Negative    | AC 2               | Unit                     |
| [TC-41-06](#tc-41-06) | Negative    | AC 3               | Unit, integration        |
| [TC-41-07](#tc-41-07) | Boundary    | AC 4               | Unit, e2e                |
| [TC-41-08](#tc-41-08) | Positive    | AC 5               | Unit                     |
| [TC-41-09](#tc-41-09) | Positive    | AC 6               | Unit, e2e                |
| [TC-41-10](#tc-41-10) | Negative    | AC 7               | Unit, integration, e2e   |
| [TC-41-11](#tc-41-11) | Concurrency | AC 7               | Unit, integration        |
| [TC-41-12](#tc-41-12) | Positive    | AC 8               | Unit, integration        |
| [TC-41-13](#tc-41-13) | Positive    | AC 9               | Unit, integration, e2e   |
| [TC-41-14](#tc-41-14) | Negative    | AC 10              | Unit                     |
| [TC-41-15](#tc-41-15) | Negative    | AC 1               | Unit                     |
| [TC-41-16](#tc-41-16) | Concurrency | AC 2, AC 10        | Unit                     |

---

### TC-41-01

| Item | Content |
|---|---|
| Test Case ID | TC-41-01 |
| Test Scenario | [Positive] AC 1, AC 5, AC 6: the Organiser asks to change two fields; the request is Submitted with each field's old and new value, and the event keeps its own values |
| Pre-conditions | Signed in as the Organiser. The event is in Planning, with the description "Booths and talks." |
| Test Steps | 1. Open the event from Event Requests and choose **Request a change**. <br> 2. Change Expected attendance and Description. <br> 3. Choose **Submit change request**. |
| Test Data | Expected attendance 60; Description "Booths, talks and a panel." |
| Expected Result | The request shows as Submitted. It records `expectedAttendance` 40 → 60, marked impactful, and `description` "Booths and talks." → "Booths, talks and a panel.", not impactful. The event's attendance is still 40 and its description unchanged. Clearing an optional field (Programme) records it with no new value. |

**Automated by:** `tests/unit/change-requests.test.ts` › "SCRUM-41 [AC1, AC5, AC6] TC-41-01: records each changed field with its old and new value, marks attendance impactful, and leaves the event unchanged", "SCRUM-41 [AC1] TC-41-01: an optional field can be cleared, and is recorded as having no value", "SCRUM-41 [AC1] TC-41-01: an unexpected database failure is not swallowed"; `tests/integration/change-requests.test.ts` › "SCRUM-41 [AC1, AC5, AC6] TC-41-01: the request is Submitted with its old and new values, and the event keeps its own"

### TC-41-02

| Item | Content |
|---|---|
| Test Case ID | TC-41-02 |
| Test Scenario | [Positive] AC 1: a request to cancel the event, with a reason |
| Pre-conditions | Signed in as the Organiser (unit) or the assigned Coordinator (e2e). The event is Confirmed (unit) or in Planning (e2e). |
| Test Steps | 1. Choose **Request a change**. <br> 2. Tick **Ask to cancel the event instead**. <br> 3. Enter the reason and submit. |
| Test Data | Reason "The sponsor withdrew." |
| Expected Result | A Submitted request that asks for cancellation, with the reason and no fields. It reads "Asks for the event to be cancelled." The event's status is unchanged. |

**Automated by:** `tests/unit/change-requests.test.ts` › "SCRUM-41 [AC1] TC-41-02: a cancellation request records the reason and no fields"; `e2e/change-requests.spec.ts` › "SCRUM-41 [AC1, AC9] TC-41-02, TC-41-13: the assigned Coordinator asks to cancel on the Organiser's behalf, and the Organiser sees it labelled"

### TC-41-03

| Item | Content |
|---|---|
| Test Case ID | TC-41-03 |
| Test Scenario | [Negative] AC 1: a cancellation request needs a reason and changes no fields |
| Pre-conditions | Signed in as the Organiser. |
| Test Steps | 1. Ask to cancel with a blank reason. <br> 2. Ask to cancel and also change a field. <br> 3. Insert a cancellation request with no reason straight into the database. |
| Test Data | Reasons: none, "   " |
| Expected Result | 1: refused with "Give a reason for cancelling the event." 2: refused with "A cancellation request can't also change fields." 3: refused by the CHECK `event_change_request_cancellation_has_reason`. No request is written. A blank reason on a change request (not a cancellation) is treated as no reason. |

**Automated by:** `tests/unit/change-requests.test.ts` › "SCRUM-41 [AC1] TC-41-03: a cancellation needs a reason", "SCRUM-41 [AC1] TC-41-03: a cancellation can't also change fields", "SCRUM-41 [AC1] TC-41-03: a blank reason on a change request is no reason"; `tests/integration/change-requests.test.ts` › "SCRUM-41 [AC1] TC-41-03: the database refuses a cancellation request without a reason"; `e2e/change-requests.spec.ts` (step 1)

### TC-41-04

| Item | Content |
|---|---|
| Test Case ID | TC-41-04 |
| Test Scenario | [Positive] AC 1: a change request can be raised on an event Under Review, in Planning or Confirmed |
| Pre-conditions | Signed in as the Organiser. The event is assigned. |
| Test Steps | 1. Raise a change request on each event. |
| Test Data | Statuses Under Review, Planning, Confirmed; new name "Career Fair 2031" |
| Expected Result | Each request is created. |

**Automated by:** `tests/unit/change-requests.test.ts` › "SCRUM-41 [AC1] TC-41-04: a change request can be raised on a %s event"

### TC-41-05

| Item | Content |
|---|---|
| Test Case ID | TC-41-05 |
| Test Scenario | [Negative] AC 2: no change request on a Draft, Submitted, Rejected, Cancelled or Completed event, or on one with no Coordinator yet |
| Pre-conditions | Signed in as the Organiser. |
| Test Steps | 1. Try to raise a change request on each event. <br> 2. Open a Cancelled event's details. |
| Test Data | Statuses Draft, Submitted, Rejected, Cancelled, Completed; Under Review with no Coordinator |
| Expected Result | Each is refused before anything is locked or written: Draft "A draft isn't submitted yet. Edit it directly instead."; Rejected "This request was rejected. Follow the next step under the rejection reason to amend it."; Cancelled and Completed "A cancelled or completed event can't be changed."; Submitted, or no Coordinator, "This request is waiting for a coordinator to be assigned. It can't be changed until then." The Cancelled event shows its existing requests but no **Request a change**. |

**Automated by:** `tests/unit/change-requests.test.ts` › "SCRUM-41 [AC2] TC-41-05: a %s event is refused before anything is locked or written", "SCRUM-41 [AC2] TC-41-05: an event Under Review with no coordinator yet can't be changed", "SCRUM-41 [AC2] TC-41-05: a Cancelled event's requests are shown, but no new one can be raised"

### TC-41-06

| Item | Content |
|---|---|
| Test Case ID | TC-41-06 |
| Test Scenario | [Negative] AC 3: a field named by the open clarification is changed in its answer, not by a change request |
| Pre-conditions | Signed in as the Organiser. The event is Under Review, with an open clarification that names Expected attendance. |
| Test Steps | 1. Ask to change Expected attendance. <br> 2. Ask to change Description. |
| Test Data | Attendance 60; Description "Booths only." |
| Expected Result | 1: refused with "The open clarification request covers Expected attendance, so change it in the answer to it instead." and nothing is written. A new date and time is covered when the clarification names the schedule. 2: created. A cancellation request isn't blocked, and outside Under Review no clarification is consulted. |

**Automated by:** `tests/unit/change-requests.test.ts` › the five "SCRUM-41 [AC3] TC-41-06" tests; `tests/integration/change-requests.test.ts` › "SCRUM-41 [AC3] TC-41-06: a field the open clarification names is refused, and one it doesn't name is accepted"

### TC-41-07

| Item | Content |
|---|---|
| Test Case ID | TC-41-07 |
| Test Scenario | [Boundary] AC 4: requested values follow the request form's rules |
| Pre-conditions | Signed in as the Organiser. |
| Test Steps | 1. Ask for each invalid value. <br> 2. Ask for the allowed boundaries. |
| Test Data | Invalid: attendance 0, -5, 1.5; a blank name; a start with no end; an end before, or equal to, the start; a start a minute in the past; a date that isn't one; a programme of 5001 characters; a field the form doesn't have. Allowed: attendance 1; an end one minute after the start; an empty programme. |
| Expected Result | Each invalid value is refused, with the form's own message next to its field ("Attendance must be a positive whole number.", "Proposed date cannot be in the past.", "Proposed end date and time must be strictly after the start date and time.", …), and nothing is read or written. The boundaries are accepted. For the Organiser, Venue requirements and Equipment requirements offer the request form's catalogue suggestions; choosing a venue fills "Preferred venue: [name]". Venue and equipment requirements are free text, as AC 4 says, under the request form's own rules (not blank). A Coordinator gets no suggestions: only the Organiser may read the catalogue (SCRUM-13). |

**Automated by:** `tests/unit/change-requests.test.ts` › "SCRUM-41 [AC4] TC-41-07: %j is refused: %s", "SCRUM-41 [AC4] TC-41-07: the boundaries that are allowed: attendance 1, an end one minute after the start, an empty programme", "SCRUM-41 [AC4] TC-41-07: invalid values are refused next to their field, before anything is read"; `e2e/change-requests.spec.ts` › "SCRUM-41 [AC1, AC4, AC5, AC6, AC7] TC-41-07, TC-41-09: …"

### TC-41-08

| Item | Content |
|---|---|
| Test Case ID | TC-41-08 |
| Test Scenario | [Positive] AC 5: date, time, expected attendance, venue and equipment are marked impactful |
| Pre-conditions | Signed in as the Organiser. |
| Test Steps | 1. Ask to change every field at once. |
| Test Data | New start and end a day later, Venue requirements "Two halls", Equipment requirements "Four projectors", and new values for every other field |
| Expected Result | `startAt`, `endAt`, `expectedAttendance`, `venueRequirements` and `equipmentRequirements` are impactful; name, purpose, accessibility needs, room layout, registration needs, programme and special requests are not. The dialog tags impactful fields "Impactful". |

**Automated by:** `tests/unit/change-requests.test.ts` › "SCRUM-41 [AC5] TC-41-08: date, time, venue and equipment are impactful; the other fields are not"; the e2e checks the tag

### TC-41-09

| Item | Content |
|---|---|
| Test Case ID | TC-41-09 |
| Test Scenario | [Positive] AC 6: the Organiser sees each request's status: Submitted, Approved, or Rejected with the reason |
| Pre-conditions | Signed in as the Organiser. The event has an Approved request and a newer Rejected one. |
| Test Steps | 1. Open the event's details. |
| Test Data | Rejection reason "No hall that size." |
| Expected Result | The requests are listed newest first, as "Rejected" with "Rejected because: No hall that size." and "Approved". A Submitted one reads "Submitted", with each field's old → new value. |

**Automated by:** `tests/unit/change-requests.test.ts` › "SCRUM-41 [AC6, AC9] TC-41-09: lists the event's requests newest first, labelling one the Coordinator raised", "SCRUM-41 [AC6] TC-41-09: the statuses read Submitted, Approved and Rejected", "SCRUM-41 [AC6] TC-41-09: the field %s reads %s"; `e2e/change-requests.spec.ts` › "SCRUM-41 [AC1, AC4, AC5, AC6, AC7] TC-41-07, TC-41-09: …"

### TC-41-10

| Item | Content |
|---|---|
| Test Case ID | TC-41-10 |
| Test Scenario | [Negative] AC 7: a second request is refused while one is Submitted, and allowed once it is decided |
| Pre-conditions | Signed in as the Organiser. The event is Confirmed, with a Submitted request. |
| Test Steps | 1. Raise another request. <br> 2. Reject the first (it is decided), then raise another. |
| Test Data | A cancellation with reason "The sponsor withdrew." |
| Expected Result | 1: refused with "This event already has a change request waiting for a decision. It's shown below."; the event still has one request, and the dialog no longer offers **Request a change**. 2: created; the event has two. |

**Automated by:** `tests/unit/change-requests.test.ts` › "SCRUM-41 [AC7] TC-41-10: a second request while one is Submitted is refused, and nothing is written", "SCRUM-41 [AC7] TC-41-10: no new request can be raised while one is Submitted"; `tests/integration/change-requests.test.ts` › "SCRUM-41 [AC7] TC-41-10: a second request is refused while one is Submitted, and allowed once that one is decided"; `e2e/change-requests.spec.ts`

### TC-41-11

| Item | Content |
|---|---|
| Test Case ID | TC-41-11 |
| Test Scenario | [Concurrency] AC 7: two requests raised at the same moment create one |
| Pre-conditions | Signed in as the Organiser. The event is in Planning with no requests. |
| Test Steps | 1. Raise two requests at once. <br> 2. Insert a second Submitted request straight into the database. |
| Test Data | Attendance 60 and 70 |
| Expected Result | 1: exactly one is created; the other gets the AC 7 message. The check for an open request runs after the event row is locked. 2: refused by the unique index `event_change_request_one_submitted`. |

**Automated by:** `tests/unit/change-requests.test.ts` › "SCRUM-41 [AC7] TC-41-11: the open-request check runs after the event row is locked"; `tests/integration/change-requests.test.ts` › "SCRUM-41 [AC7] TC-41-11: of two requests raised at the same moment, exactly one is created", "SCRUM-41 [AC7] TC-41-11: the database itself refuses a second Submitted request for an event"

### TC-41-12

| Item | Content |
|---|---|
| Test Case ID | TC-41-12 |
| Test Scenario | [Positive] AC 8: rejecting the event rejects its Submitted change request with the same reason |
| Pre-conditions | The event is Under Review with a Submitted request. Signed in as the assigned Coordinator. |
| Test Steps | 1. Reject the event. |
| Test Data | Reason "No venue can take this event."; outcome Submit as a new request |
| Expected Result | The change request is Rejected, with the event's reason, decided by the Coordinator. Approving the event leaves the request Submitted. |

**Automated by:** `tests/unit/event-status.test.ts` › "SCRUM-41 [AC8] TC-41-12: rejecting the event rejects its Submitted change request with the same reason", "SCRUM-41 [AC8] TC-41-12: approving the event leaves its change request waiting"; `tests/integration/change-requests.test.ts` › "SCRUM-41 [AC8] TC-41-12: rejecting an event Under Review rejects its Submitted change request with the event's reason". From Planning: TC-117-08. On cancellation: SCRUM-82.

### TC-41-13

| Item | Content |
|---|---|
| Test Case ID | TC-41-13 |
| Test Scenario | [Positive] AC 9: the assigned Coordinator raises a request on the Organiser's behalf, labelled for the Organiser |
| Pre-conditions | Signed in as the assigned Coordinator. The event is in Planning. |
| Test Steps | 1. Open the event and raise a request. <br> 2. Sign in as the Organiser and open the event. |
| Test Data | Attendance 55, reason "Agreed with the organiser by phone."; or a cancellation |
| Expected Result | The request is recorded as raised by the Coordinator. The Organiser sees it as Submitted, labelled "Raised by Coordinator for [Organiser name]". |

**Automated by:** `tests/unit/change-requests.test.ts` › "SCRUM-41 [AC9] TC-41-13: the assigned Coordinator raises a change request on the Organiser's behalf"; `tests/integration/change-requests.test.ts` › "SCRUM-41 [AC6, AC9] TC-41-13: the assigned Coordinator's request is shown to the Organiser as raised for them"; `e2e/change-requests.spec.ts` › "SCRUM-41 [AC1, AC9] TC-41-02, TC-41-13: …"

### TC-41-14

| Item | Content |
|---|---|
| Test Case ID | TC-41-14 |
| Test Scenario | [Negative] AC 10: only the event's Organiser and its assigned Coordinator can raise a change request |
| Pre-conditions | Each caller below. |
| Test Steps | 1. Try to raise, and to list, a change request on the event. |
| Test Data | A Coordinator who isn't assigned; another Organiser; a missing and a discarded event; Venue Staff, Technical Support, Attendee, Coordinator Lead, Safety Officer; signed out |
| Expected Result | The unassigned Coordinator is refused with "Only the event's organiser or its assigned coordinator can raise a change request." and is offered no **Request a change**. Another Organiser's, a missing and a discarded event all read "Event not found." The other roles and a signed-out caller are refused before anything is read. Nothing is written. |

**Automated by:** `tests/unit/change-requests.test.ts` › the "SCRUM-41 [AC10] TC-41-14" tests

### TC-41-15

| Item | Content |
|---|---|
| Test Case ID | TC-41-15 |
| Test Scenario | [Negative] AC 1: a request that changes nothing is refused |
| Pre-conditions | Signed in as the Organiser. |
| Test Steps | 1. Submit with nothing edited. <br> 2. Submit values equal to the event's. |
| Test Data | Attendance 40, the event's own start and end, empty special requests |
| Expected Result | Refused with "Change at least one field, or ask to cancel the event." Nothing is written. |

**Automated by:** `tests/unit/change-requests.test.ts` › "SCRUM-41 [AC1] TC-41-15: values equal to the event's are not a change, and nothing is written", "SCRUM-41 [AC1] TC-41-15: a request with no changes at all is refused under the changes field"

### TC-41-16

| Item | Content |
|---|---|
| Test Case ID | TC-41-16 |
| Test Scenario | [Concurrency] AC 2, AC 10: an event rejected, or reassigned, after it was read is refused under the lock |
| Pre-conditions | The event is in Planning when first read. |
| Test Steps | 1. The event is rejected before the lock is taken. <br> 2. The Coordinator raising the request is unassigned before the lock is taken. |
| Test Data | — |
| Expected Result | 1: refused with the Rejected message from TC-41-05. 2: refused with "This event was updated by another user. Refresh and try again." Nothing is written. |

**Automated by:** `tests/unit/change-requests.test.ts` › "SCRUM-41 [AC2] TC-41-16: an event rejected after it was read is refused under the lock, and nothing is written", "SCRUM-41 [AC10] TC-41-16: a Coordinator unassigned after reading the event is refused, and nothing is written"
