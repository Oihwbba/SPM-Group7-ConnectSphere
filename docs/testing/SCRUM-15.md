# SCRUM-15 — Save an event request as a draft: test cases

Story and acceptance criteria: [docs/backlog/SCRUM-15.md](../backlog/SCRUM-15.md).
Format and conventions: [README.md](README.md). A draft is saved by
`createDraftEvent` in
[app/(app)/events/actions.ts](<../../app/(app)/events/actions.ts>), against
the relaxed `createDraftEventSchema` in
[lib/schemas/event.ts](../../lib/schemas/event.ts); the form is
[create-event-dialog.tsx](<../../app/(app)/events/create-event-dialog.tsx>).

Written on 2026-10-12 from the acceptance criteria, then mapped to the tests
that already existed (SCRUM-176). The tests predate the `SCRUM-n [ACx] TC-n-xx`
title format, so each case names them by their current titles.

**AC 9 was reworded on 21 Oct.** It used to also require a field naming an
inactive catalogue item to be marked for correction. Venue and equipment
requirements are free text (SCRUM-170), so a draft holds no catalogue
reference that could go stale, and AC 9 now asks only that a reopened draft
opens with what was saved (TC-15-10).

**Shared pre-conditions for every case:** the database is migrated and seeded
and the app is running. Signed in as `organiser@test.local` (`Password123!`),
unless the case says otherwise.

| ID | Type | Criterion | Automated |
|---|---|---|---|
| [TC-15-01](#tc-15-01) | Positive | AC 1, AC 4 | Unit, e2e |
| [TC-15-02](#tc-15-02) | Boundary | AC 4 | Unit |
| [TC-15-03](#tc-15-03) | Positive | AC 2, AC 5 | Unit, e2e |
| [TC-15-04](#tc-15-04) | Positive | AC 2 | Unit |
| [TC-15-05](#tc-15-05) | Positive | AC 3 | e2e |
| [TC-15-06](#tc-15-06) | Negative | AC 3 | Unit |
| [TC-15-07](#tc-15-07) | Positive | AC 5 | Unit, e2e |
| [TC-15-08](#tc-15-08) | Positive | AC 6 | e2e |
| [TC-15-09](#tc-15-09) | Positive | AC 7 | Unit, e2e |
| [TC-15-10](#tc-15-10) | Positive | AC 9 | Unit |
| [TC-15-11](#tc-15-11) | Negative | AC 8 | Unit |
| [TC-15-12](#tc-15-12) | Negative | AC 1 | Unit |

---

### TC-15-01

| Item | Content |
|---|---|
| Test Case ID | TC-15-01 |
| Test Scenario | [Positive] AC 1, AC 4: a draft saves with the mandatory submission fields empty |
| Pre-conditions | Signed in as the Organiser. |
| Test Steps | 1. Click **Create Event Request**. <br> 2. Fill only **Event Name**, and click **Next** through the steps leaving everything else empty. <br> 3. Click **Save as Draft**. |
| Test Data | Name "Partial planning draft" |
| Expected Result | "Draft event request saved successfully." The draft is listed with a **Resume Draft** button, its dates, attendance, venue and equipment still empty. |

**Automated by:** `tests/unit/events.test.ts` › "SCRUM-15 [AC1 - Happy Path]: allows saving a draft with mandatory submission fields left empty", "SCRUM-15 [AC4 - Relaxation Rule]: allows saving a draft with missing mandatory fields (dates/venue/equipment/attendance omitted)"; `e2e/events.spec.ts` › "SCRUM-15 [AC3] TC-15-05: organiser saves partial draft, locates and resumes draft with preserved fields, then completes and submits"

### TC-15-02

| Item | Content |
|---|---|
| Test Case ID | TC-15-02 |
| Test Scenario | [Boundary] AC 4: a value that is filled in must still be valid, even in a draft |
| Pre-conditions | Signed in as the Organiser. |
| Test Steps | 1. Create a draft with **Expected Attendance** 0 and save it. <br> 2. Create a draft with a 201-character name and save it. |
| Test Data | Attendance 0; a name of 201 characters |
| Expected Result | Both saves are refused at the field: "Attendance must be a positive whole number." and "Keep the name under 200 characters.". Leaving the field empty is allowed (TC-15-01); an invalid value is not. |

**Automated by:** `tests/unit/events.test.ts` › "SCRUM-15 [AC4 - Validation Rule]: draft schema rejects 0 attendance when attendance is provided in draft", "SCRUM-15 [AC4] / SCRUM-13 [AC11 - Draft Path Input Constraint]: createDraftEvent schema enforces character limits on over-limit draft fields (name max 200, purpose max 1000, description max 5000, programme max 5000, specialRequests max 5000)"

### TC-15-03

| Item | Content |
|---|---|
| Test Case ID | TC-15-03 |
| Test Scenario | [Positive] AC 2, AC 5: every saved field comes back when the draft is reopened |
| Pre-conditions | Signed in as the Organiser, with a draft saved with a name and both dates. |
| Test Steps | 1. On **My Events**, click **Resume Draft** on the draft's row. <br> 2. Step through the form. |
| Test Data | Start 20 Nov 2027 10:00, end 20 Nov 2027 18:00 |
| Expected Result | "Resume Draft Event Request" opens with the saved name, and the dates read 2027-11-20T10:00 and 2027-11-20T18:00. The review step shows "Start: 20 Nov 2027, 10:00 am SGT" and "End: 20 Nov 2027, 6:00 pm SGT". |

**Automated by:** `tests/unit/events.test.ts` › "SCRUM-15 [AC2 - Happy Path]: retains existing field values when updating an existing draft request", "SCRUM-15 [AC1, AC2 - Data retention]: a new draft saved with both proposed dates persists them as UTC instants"; `e2e/events.spec.ts` › "SCRUM-15 [AC3] TC-15-05: organiser saves partial draft, locates and resumes draft with preserved fields, then completes and submits"

### TC-15-04

| Item | Content |
|---|---|
| Test Case ID | TC-15-04 |
| Test Scenario | [Positive] AC 2: re-saving a draft keeps its dates exactly, and an empty date stays empty |
| Pre-conditions | Signed in as the Organiser, with a draft that has dates. |
| Test Steps | 1. Resume the draft, change only the name, and save. Repeat. <br> 2. Resume a draft with no dates, enter only an end, and save. |
| Test Data | A draft with a start at 10:00 SGT |
| Expected Result | After each save the start is the same instant, with no drift. In step 2 the end is saved and the start stays empty. |

**Automated by:** `tests/unit/events.test.ts` › "SCRUM-15 [AC2 - Cross-Cutting / Timezone]: preserves exact UTC datetime without offset drift across multiple draft updates", "SCRUM-15 [AC2, AC7 - Data retention on re-save]: updating a draft with only an end date persists that end and leaves the start empty"

### TC-15-05

| Item | Content |
|---|---|
| Test Case ID | TC-15-05 |
| Test Scenario | [Positive] AC 3: a draft with only a name saves, says so, and the Organiser can carry on |
| Pre-conditions | Signed in as the Organiser. |
| Test Steps | 1. Click **Create Event Request**, enter a name, and click **Save as Draft**. <br> 2. Click **Resume Draft** on its row. |
| Test Data | Name "Partial planning draft" |
| Expected Result | "Draft event request saved successfully." The draft is listed as a Draft, and resuming it opens the form to continue. |

**Automated by:** `e2e/events.spec.ts` › "organiser can navigate steps freely without mandatory fields and save partial draft", "SCRUM-15 [AC3] TC-15-05: organiser saves partial draft, locates and resumes draft with preserved fields, then completes and submits"

### TC-15-06

| Item | Content |
|---|---|
| Test Case ID | TC-15-06 |
| Test Scenario | [Negative] AC 3: a draft needs at least a name |
| Pre-conditions | Signed in as the Organiser. |
| Test Steps | 1. Click **Create Event Request** and click **Save as Draft** with the name empty. |
| Test Data | Every field empty |
| Expected Result | Saving is refused with "Give the event a name." at the name field, and nothing is created. |

**Automated by:** `tests/unit/events.test.ts` › "SCRUM-15 [AC3 - Business-Rule Negative]: returns field error when attempting to save a draft without an event name"

### TC-15-07

| Item | Content |
|---|---|
| Test Case ID | TC-15-07 |
| Test Scenario | [Positive] AC 5: a draft stays a Draft until it is submitted, then becomes Submitted |
| Pre-conditions | Signed in as the Organiser, with a draft. |
| Test Steps | 1. Resume the draft, fill every remaining required field, and save as a draft. <br> 2. Resume it again and click **Submit Request for Review**. |
| Test Data | A complete set of values |
| Expected Result | After step 1 it is still a Draft. After step 2 it is no longer a Draft: it is Submitted, or Under Review once a Coordinator is assigned (SCRUM-20). |

**Automated by:** `tests/unit/events.test.ts` › "SCRUM-15 [AC5 - State Transition]: transitions draft status from DRAFT to SUBMITTED when draft is fully completed and submitted"; `e2e/events.spec.ts` › "SCRUM-15 [AC3] TC-15-05: organiser saves partial draft, locates and resumes draft with preserved fields, then completes and submits"

### TC-15-08

| Item | Content |
|---|---|
| Test Case ID | TC-15-08 |
| Test Scenario | [Positive] AC 6: closing an edited draft without saving asks first |
| Pre-conditions | Signed in as the Organiser. |
| Test Steps | 1. Click **Create Event Request** and type a name. <br> 2. Close the dialog. <br> 3. In "Unsaved Changes", click **Continue Editing**. <br> 4. Close the dialog again. |
| Test Data | Any name |
| Expected Result | "Unsaved Changes" opens: "You have unsaved changes in this event request". **Continue Editing** returns to the form with the name still there; closing again asks again. |

**Automated by:** `e2e/events.spec.ts` › "SCRUM-15 [AC6 - Unsaved Changes Warning]: unsaved changes warning appears when closing an edited draft dialog"

### TC-15-09

| Item | Content |
|---|---|
| Test Case ID | TC-15-09 |
| Test Scenario | [Positive] AC 7: saving the same draft again updates it, and creates no copy |
| Pre-conditions | Signed in as the Organiser, with a draft. |
| Test Steps | 1. Resume the draft, change a field, and click **Save as Draft**. <br> 2. Count the Organiser's requests with that name. |
| Test Data | A new purpose |
| Expected Result | "Draft event request updated successfully." There is still one draft, holding the new value. |

**Automated by:** `e2e/events.spec.ts` › "SCRUM-15 [AC2, AC7 - Draft Save Idempotency]: saving an existing draft a second time updates the record in-place without creating duplicate rows"; `tests/unit/events.test.ts` › "SCRUM-15 [AC2, AC7 - Data retention on re-save]: updating a draft with only an end date persists that end and leaves the start empty"

### TC-15-10

| Item | Content |
|---|---|
| Test Case ID | TC-15-10 |
| Test Scenario | [Positive] AC 9: a draft that names a venue or equipment no longer offered still opens with its saved text |
| Pre-conditions | Signed in as the Organiser, with a draft whose venue and equipment requirements name an item since made inactive. |
| Test Steps | 1. Resume the draft. |
| Test Data | Venue requirements naming a retired venue |
| Expected Result | The draft opens with the saved text unchanged. |

**Automated by:** `tests/unit/events.test.ts` › "SCRUM-15 [AC2, AC9 - Inactive Catalogue Reference Retention]: draft saves and reopens successfully when venue or equipment fields contain references to inactive catalogue items (stored as free text, no FK constraint)"

### TC-15-11

| Item | Content |
|---|---|
| Test Case ID | TC-15-11 |
| Test Scenario | [Negative] AC 8: a draft is not shown to Coordinators |
| Pre-conditions | A draft exists. Signed in as `coordinator@test.local`. |
| Test Steps | 1. Open **Events**. |
| Test Data | The Organiser's draft |
| Expected Result | The draft is not on the Coordinator's list; their list never includes Draft events. |

**Automated by:** `tests/unit/events.test.ts` › "SCRUM-16 [AC4 - Coordinator View Exclusion], SCRUM-165 [AC8] TC-165-11: the coordinator query lists only their own events, so no draft or unassigned request"; `tests/unit/coordinator-assigned-events.test.ts` › "[Negative] AC1: an unassigned draft is not in any Coordinator's list"

### TC-15-12

| Item | Content |
|---|---|
| Test Case ID | TC-15-12 |
| Test Scenario | [Negative] AC 1: an Organiser can save only their own draft |
| Pre-conditions | Signed in as `organiser2@test.local`, and another Organiser's draft id is known. |
| Test Steps | 1. Send a draft save, and a submission, for the other Organiser's draft. |
| Test Data | The other draft's id |
| Expected Result | Both are refused ("Draft event not found or cannot be modified." and "Draft or rejected event not found or cannot be submitted."), and the draft is unchanged. |

**Automated by:** `tests/unit/events.test.ts` › "SCRUM-15 [Security Gate / Ownership Isolation]: refuses to update or submit a draft owned by another organiser"
