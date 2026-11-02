# SCRUM-264 — Seven text boxes over 2,000 characters are refused with no error at the field: test cases

SCRUM-264 is a Bug task in Jira, raised on 2 Nov from the TC-132-09 audit
(SCRUM-132 AC 4). Its Done when items, numbered as AC 1 to AC 5 here, are in
[docs/backlog/SCRUM-264.md](../backlog/SCRUM-264.md).

Format and conventions: [README.md](README.md).

**Why it failed:** the server limits these seven boxes to 2,000 characters and
the browser doesn't, so a long text reached the server's check. Four actions
answered with a message about the event or the decision instead, two with
Zod's default text, and none of the seven forms showed a field's error. The fix
gives each limit a message of its own, returns it for the field, and shows it
at the box with the shared `FieldError`. The boxes have no `maxLength`, because
that would cut a pasted text short without saying so.

**Shared pre-conditions:** the database is migrated and seeded. Every account's
password is `Password123!`. The unit cases mock the session and the database,
and each e2e case creates its own event.

| ID | Type | Criterion | Automated |
|---|---|---|---|
| [TC-264-01](#tc-264-01) | Negative | AC 1, AC 2 | E2E |
| [TC-264-02](#tc-264-02) | Negative | AC 1, AC 2 | Unit |
| [TC-264-03](#tc-264-03) | Boundary | AC 3 | Unit |
| [TC-264-04](#tc-264-04) | Negative | AC 4 | Unit |
| [TC-264-05](#tc-264-05) | Positive | AC 1 | E2E |
| [TC-264-06](#tc-264-06) | Positive | AC 5 | Manual (review) |

---

### TC-264-01

| Item | Content |
|---|---|
| Test Case ID | TC-264-01 |
| Test Scenario | [Negative] AC 1, AC 2: over the limit, each box shows why beside it, keeps the text and writes nothing |
| Pre-conditions | An event in the box's status, made by the test; for a change request or a booking, one pending on it; for a safety check, one awaiting review. Rejecting also has an outcome chosen. |
| Test Steps | 1. Open the form, as below. <br> 2. Enter 2,001 characters in the box and send. <br> 3. Shorten the text to 2,000 characters. |
| Test Data | **Clarification message** (Ask, `coordinator@test.local`); **Rejection reason** (Reject on a request Under Review; Reject event on a Planning event's Arrangements, `coordinator@test.local`); **Cancellation reason** (Cancel event, `coordinator@test.local`); **Reason for rejecting the change request** (Reject on the Changes tab, `coordinator@test.local`); **Rejection reason** (Reject on a booking, `venuestaff@test.local`); **Note** (Reject on a safety check, `safety@test.local`) |
| Expected Result | 2: the form stays open with the text, the box is marked invalid, and beside it: "Keep the message under 2000 characters." (clarification), "Keep the rejection reason under 2000 characters." (the four rejections), "Keep the cancellation reason under 2000 characters." (cancelling) or "Keep the note under 2000 characters." (safety check). The event, request, booking or check is unchanged. 3: the mark and the message clear. |

**Automated by:** `e2e/text-limit-errors.spec.ts` › "SCRUM-264 [AC1, AC2] TC-264-01: asking for clarification", "SCRUM-264 [AC1, AC2] TC-264-01: rejecting an event request", "SCRUM-264 [AC1, AC2] TC-264-01: rejecting a Planning event", "SCRUM-264 [AC1, AC2] TC-264-01: cancelling an event", "SCRUM-264 [AC1, AC2] TC-264-01, TC-264-05: rejecting a change request; the text left by Back doesn't stop an approval", "SCRUM-264 [AC1, AC2] TC-264-01: rejecting a booking request", "SCRUM-264 [AC1, AC2] TC-264-01: recording a safety check's note"

### TC-264-02

| Item | Content |
|---|---|
| Test Case ID | TC-264-02 |
| Test Scenario | [Negative] AC 1, AC 2: each action refuses 2,001 characters with the field's message |
| Pre-conditions | Signed in as the role that may take the action |
| Test Steps | 1. Send each action 2,001 characters. |
| Test Data | `requestClarification`, `transitionEventStatus`, `rejectPlanningEvent`, `cancelEvent`, `decideChangeRequest`, `decideBookingRequest`, `recordSafetyCheckOutcome` |
| Expected Result | Each returns its message for the field (`message`, `decisionReason`, `reason` or `note`), as TC-264-01 lists them. The refusal says the same, except `requestClarification`'s, "Please fix the highlighted fields.", which is now true. Nothing is read or written. |

**Automated by:** `tests/unit/text-limit-errors.test.ts` › "SCRUM-264 [AC1, AC2] TC-264-02: $action refuses 2,001 characters with the field's message, and reads and writes nothing"

### TC-264-03

| Item | Content |
|---|---|
| Test Case ID | TC-264-03 |
| Test Scenario | [Boundary] AC 3: 2,000 characters pass each action's validation |
| Pre-conditions | Signed in as the role that may take the action; the row asked for doesn't exist, so the action stops at its first read |
| Test Steps | 1. Send each action 2,000 characters. |
| Test Data | The seven actions in TC-264-02 |
| Expected Result | Each goes on to look for its row and answers "not found", so the text wasn't refused. |

**Automated by:** `tests/unit/text-limit-errors.test.ts` › "SCRUM-264 [AC3] TC-264-03: $action takes exactly 2,000 characters"

### TC-264-04

| Item | Content |
|---|---|
| Test Case ID | TC-264-04 |
| Test Scenario | [Negative] AC 4: input the user can't fix keeps the action's own refusal |
| Pre-conditions | Signed in as a Coordinator |
| Test Steps | 1. Call each action below directly with the input shown. This can't be done in the browser: the forms take the event from the page and the decision from the button clicked, so the unit test is how this case runs. |
| Test Data | `transitionEventStatus`, `rejectPlanningEvent` and `cancelEvent` with no event; `decideChangeRequest` with `MAYBE` |
| Expected Result | "Please provide a valid event status action.", "Please provide a valid event to reject.", "Please provide a valid event to cancel." and "Please choose Approve or Reject.", with no field error, and nothing is read. |

**Automated by:** `tests/unit/text-limit-errors.test.ts` › "SCRUM-264 [AC4] TC-264-04: $action keeps its own refusal for input the user can't fix"

### TC-264-05

| Item | Content |
|---|---|
| Test Case ID | TC-264-05 |
| Test Scenario | [Positive] AC 1: text left in the change request's reason box doesn't stop an approval |
| Pre-conditions | A Confirmed event with a change request pending; signed in as `coordinator@test.local` |
| Test Steps | 1. Click **Reject** and enter 2,001 characters. <br> 2. Click **Back**, where the box is no longer shown. <br> 3. Click **Approve**. |
| Test Data | As the steps |
| Expected Result | "Change request approved and applied." The rejection's text isn't sent, so no error can land on a box that isn't there. |

**Automated by:** `e2e/text-limit-errors.spec.ts` › "SCRUM-264 [AC1, AC2] TC-264-01, TC-264-05: rejecting a change request; the text left by Back doesn't stop an approval"

### TC-264-06

| Item | Content |
|---|---|
| Test Case ID | TC-264-06 |
| Test Scenario | [Positive] AC 5: TC-132-09 records this failure and its fix |
| Pre-conditions | — |
| Test Steps | 1. Read TC-132-09 in [SCRUM-132.md](SCRUM-132.md#tc-132-09). |
| Test Data | — |
| Expected Result | It names the seven actions' failure and points here. |

**Automated by:** Manual (review)
