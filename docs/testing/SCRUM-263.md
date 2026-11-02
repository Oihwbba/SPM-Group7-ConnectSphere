# SCRUM-263 — The event request form says to fix the highlighted fields but highlights none: test cases

SCRUM-263 is a Bug task in Jira under SCRUM-6, raised on 2 Nov from an
Organiser form check of SCRUM-13 AC 11. Its acceptance criteria are in
[docs/backlog/SCRUM-263.md](../backlog/SCRUM-263.md).

Format and conventions: [README.md](README.md).

**Why it failed:** Event Programme and Special Requests were the only text
boxes on the form with no error display, so the action's message for either
was never shown. And an error shows only on its field's step, while a request
is submitted from Review, which flags missing fields and nothing else. The fix
adds the two fields' errors, and `firstStepWithError` in
`app/(app)/events/create-event-dialog.tsx` opens the first step with an error
after a refused submission or draft. The limits themselves were already right,
except that Registration Notes had none on a draft and no message of its own.

**A second failure, found on 2 Nov:** Venue Requirements, Accessibility Needs,
Equipment Requirements and Room Layout had no limit on the form or the
Coordinator's edit, though a clarification answer and a change request limit
them. They now share one limit each, in `lib/schemas/event.ts`, and the
Coordinator's edit limits Registration Notes too.

**Shared pre-conditions:** signed in as `organiser@test.local` /
`Password123!` on the seeded database. The unit cases mock the database.

| ID | Type | Criterion | Automated |
|---|---|---|---|
| [TC-263-01](#tc-263-01) | Negative | AC 1 | E2E |
| [TC-263-02](#tc-263-02) | Boundary | AC 1 | Unit |
| [TC-263-03](#tc-263-03) | Negative | AC 2 | E2E |
| [TC-263-04](#tc-263-04) | Negative | AC 2 | E2E |
| [TC-263-05](#tc-263-05) | Positive | AC 2 | Unit |
| [TC-263-08](#tc-263-08) | Boundary | AC 3 | Unit |
| [TC-263-09](#tc-263-09) | Boundary | AC 3 | Unit |
| [TC-263-10](#tc-263-10) | Negative | AC 3 | E2E |
| [TC-263-11](#tc-263-11) | Negative | AC 3 | E2E |

---

### TC-263-01

| Item | Content |
|---|---|
| Test Case ID | TC-263-01 |
| Test Scenario | [Negative] AC 1: Registration Notes, Event Programme or Special Requests over the limit shows why beside the field |
| Pre-conditions | Shared pre-conditions |
| Test Steps | 1. Open Create Event Request and enter a name. <br> 2. Go to step 5 - Details. <br> 3. Enter 5,001 characters in the field. <br> 4. Click **Save as Draft**. <br> 5. Shorten the text to 5,000 characters. |
| Test Data | **Registration Notes (Optional)**; then **Event Programme (Optional)**; then **Special Requests / Arrangements (Optional)** |
| Expected Result | 4: "Please fix the highlighted fields.", the field is marked invalid, "Keep registration notes under 5000 characters.", "Keep programme under 5000 characters." or "Keep special requests under 5000 characters." shows beside it, and nothing is saved. 5: the mark and the message clear. |

**Automated by:** `e2e/request-form-errors.spec.ts` › "SCRUM-263 [AC1] TC-263-01: ${label} over its limit shows why beside the field, and clears once shortened"

### TC-263-02

| Item | Content |
|---|---|
| Test Case ID | TC-263-02 |
| Test Scenario | [Boundary] AC 1: 5,000 characters are accepted and 5,001 refused, submitting or saving a draft |
| Pre-conditions | Shared pre-conditions |
| Test Steps | 1. Send a submission, then a draft, with 5,000 characters in the field. <br> 2. Send each with 5,001. |
| Test Data | `programme`; then `specialRequests`; then `registrationNotes` |
| Expected Result | 1: saved with the text whole. 2: refused with the field's message and nothing is written. |

**Automated by:** `tests/unit/events.test.ts` › "SCRUM-263 [AC1] TC-263-02: %s accepts exactly 5,000 characters of ${field}", "SCRUM-263 [AC1] TC-263-02: %s refuses 5,001 characters of ${field}, names the field, and writes nothing"

### TC-263-03

| Item | Content |
|---|---|
| Test Case ID | TC-263-03 |
| Test Scenario | [Negative] AC 2: a refused submission opens the step with the error |
| Pre-conditions | Shared pre-conditions |
| Test Steps | 1. Fill every required field. <br> 2. Enter 5,001 characters in **Event Programme (Optional)**. <br> 3. Go to step 6 - Review and click **Submit Request for Review**. <br> 4. Shorten the text to 5,000 characters, return to Review and submit. |
| Test Data | A date in the future, 09:00 to 18:00; attendance 150 |
| Expected Result | 3: "Please fix the highlighted fields before submitting.", the form opens step 5 with the field marked and its message beside it, and nothing is created. 4: the request is submitted and listed on **My Events**. |

**Automated by:** `e2e/request-form-errors.spec.ts` › "SCRUM-263 [AC2] TC-263-03: a refused submission opens the step with the error, and the request goes through once it is fixed"

### TC-263-04

| Item | Content |
|---|---|
| Test Case ID | TC-263-04 |
| Test Scenario | [Negative] AC 2: a refused draft opens the step with the error, wherever it was saved from |
| Pre-conditions | Shared pre-conditions |
| Test Steps | 1. Enter a name and 5,001 characters in **Special Requests / Arrangements (Optional)**. <br> 2. Go back to step 1 - Basics. <br> 3. Click **Save as Draft**. |
| Test Data | As the steps |
| Expected Result | The form opens step 5 with the field marked and "Keep special requests under 5000 characters." beside it, and nothing is saved. |

**Automated by:** `e2e/request-form-errors.spec.ts` › "SCRUM-263 [AC2] TC-263-04: a refused draft opens the step with the error, wherever it was saved from"

### TC-263-05

| Item | Content |
|---|---|
| Test Case ID | TC-263-05 |
| Test Scenario | [Positive] AC 2: every field's error leads to the step that shows it, and the earliest step wins |
| Pre-conditions | None |
| Test Steps | 1. Give `firstStepWithError` an error on each field in turn. <br> 2. Give it errors on two steps. <br> 3. Give it none, an empty list, and an error on a field no step shows. |
| Test Data | The form's 14 fields; `specialRequests` with `equipmentRequirements`; `id` |
| Expected Result | 1: steps 1 to 5, as the form lays the fields out. 2: step 4. 3: no step, so the form stays where it is. |

**Automated by:** `tests/unit/create-event-dialog.test.ts` › "SCRUM-263 [AC2] TC-263-05: an error on %s opens step %i", "SCRUM-263 [AC2] TC-263-05: errors on several steps open the earliest", "SCRUM-263 [AC2] TC-263-05: with no field to show, the form stays where it is"

### TC-263-08

| Item | Content |
|---|---|
| Test Case ID | TC-263-08 |
| Test Scenario | [Boundary] AC 3: each open-text field accepts its limit and refuses one more, submitting or saving a draft |
| Pre-conditions | Shared pre-conditions |
| Test Steps | 1. Send a submission, then a draft, with the field at its limit. <br> 2. Send each with one character more. |
| Test Data | `venueRequirements`, `accessibilityNeeds` and `equipmentRequirements` at 5,000 and 5,001; `preferredLayout` at 200 and 201 |
| Expected Result | 1: saved with the text whole. 2: refused with the field's message, for example "Keep room layout under 200 characters.", and nothing is written. |

**Automated by:** `tests/unit/events.test.ts` › "SCRUM-263 [AC3] TC-263-08: %s accepts exactly ${limit} characters of ${field}", "SCRUM-263 [AC3] TC-263-08: %s refuses ${limit + 1} characters of ${field}, names the field, and writes nothing"

### TC-263-09

| Item | Content |
|---|---|
| Test Case ID | TC-263-09 |
| Test Scenario | [Boundary] AC 3: the Coordinator's edit accepts each limit and refuses one more |
| Pre-conditions | Signed in as the assigned Coordinator. The database is mocked. |
| Test Steps | 1. Save the edit with the field at its limit. <br> 2. Save it with one character more. |
| Test Data | `venueRequirements`, `accessibilityNeeds`, `equipmentRequirements` and `registrationNotes` at 5,000 and 5,001; `preferredLayout` at 200 and 201 |
| Expected Result | 1: saved. 2: "Please fix the highlighted fields." with the field's message, and nothing is written. |

**Automated by:** `tests/unit/event-edit.test.ts` › "SCRUM-263 [AC3] TC-263-09: the Coordinator's edit accepts exactly ${limit} characters of ${field}", "SCRUM-263 [AC3] TC-263-09: the Coordinator's edit refuses ${limit + 1} characters of ${field}, names the field, and writes nothing"

### TC-263-10

| Item | Content |
|---|---|
| Test Case ID | TC-263-10 |
| Test Scenario | [Negative] AC 3: open-text fields over their limits are highlighted step by step, and the request goes through once they fit |
| Pre-conditions | Shared pre-conditions |
| Test Steps | 1. Fill every required field. <br> 2. Choose Other and enter 5,001 characters in **Venue Requirements**, **Accessibility Needs** and **Equipment & Technical Support Requirements**, and 201 in **Preferred Room Layout**. <br> 3. Go to step 6 - Review and click **Submit Request for Review**. <br> 4. Shorten the three on step 3 to their limits, return to Review and submit. <br> 5. Shorten the equipment text, return to Review and submit. |
| Test Data | A date in the future, 09:00 to 18:00; attendance 150 |
| Expected Result | 3: the form opens step 3 with its three fields marked and their messages beside them, and nothing is created. 4: it opens step 4 with the equipment field marked and its message beside it, and nothing is created. 5: the request is submitted and listed on **My Events**. |

**Automated by:** `e2e/request-form-errors.spec.ts` › "SCRUM-263 [AC3] TC-263-10: open-text fields over their limits are highlighted step by step, and the request goes through once they fit"

### TC-263-11

| Item | Content |
|---|---|
| Test Case ID | TC-263-11 |
| Test Scenario | [Negative] AC 3: the Coordinator's edit over a limit shows why beside the field and saves nothing |
| Pre-conditions | Signed in as `coordinator@test.local`, the assigned Coordinator of an event in Planning. |
| Test Steps | 1. Open the event and click **Edit details**. <br> 2. Enter 5,001 characters in **Venue requirements**. <br> 3. Click **Save details**. |
| Test Data | The spec's own event, removed afterwards |
| Expected Result | "Please fix the highlighted fields.", the field is marked invalid, "Keep venue requirements under 5000 characters." shows beside it, and the event keeps its venue requirements. |

**Automated by:** `e2e/request-form-errors.spec.ts` › "SCRUM-263 [AC3] TC-263-11: the Coordinator's edit over a limit shows why beside the field and saves nothing"
