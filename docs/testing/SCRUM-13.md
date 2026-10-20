# SCRUM-13 — Create an event request: test cases

Story and acceptance criteria: [docs/backlog/SCRUM-13.md](../backlog/SCRUM-13.md).
Format and conventions: [README.md](README.md). The form's rules are
`submitEventRequestSchema` and `createDraftEventSchema` in
[lib/schemas/event.ts](../../lib/schemas/event.ts); the actions are
`submitEventRequest`, `createDraftEvent` and `getFormCatalogues` in
[app/(app)/events/actions.ts](<../../app/(app)/events/actions.ts>).

Written on 2026-10-12 from the acceptance criteria, then mapped to the tests
that already existed (SCRUM-176). The tests predate the `SCRUM-n [ACx] TC-n-xx`
title format, so each case names them by their current titles.

Two criteria were overtaken by later stories:

- **AC 1, AC 4 and AC 6 (event timezone):** SCRUM-129 made every event
  Singapore time. The form has no timezone field; it states its times are SGT,
  and times are stored as UTC (TC-13-07).
- **AC 2 (catalogue selections):** venue and equipment requirements are free
  text. The form offers the active venue and equipment catalogues as
  suggestions (TC-13-02); choosing from a catalogue was SCRUM-127, which was
  dropped (SCRUM-170 keeps the requirements free text).

**Shared pre-conditions for every case:** the database is migrated and seeded
and the app is running. Signed in as `organiser@test.local` (`Password123!`),
unless the case says otherwise. "A start a month from now" is any future time.

| ID | Type | Criterion | Automated |
|---|---|---|---|
| [TC-13-01](#tc-13-01) | Positive | AC 1, AC 10 | Unit, e2e |
| [TC-13-02](#tc-13-02) | Positive | AC 2 | Unit |
| [TC-13-03](#tc-13-03) | Negative | AC 2 | Unit |
| [TC-13-04](#tc-13-04) | Positive | AC 3 | Unit, e2e |
| [TC-13-05](#tc-13-05) | Negative | AC 4 | Unit, e2e |
| [TC-13-06](#tc-13-06) | Positive | AC 5 | Unit, e2e |
| [TC-13-07](#tc-13-07) | Positive | AC 6 | Unit, e2e |
| [TC-13-08](#tc-13-08) | Boundary | AC 7 | Unit |
| [TC-13-09](#tc-13-09) | Boundary | AC 8 | Unit |
| [TC-13-10](#tc-13-10) | Negative | AC 9 | Unit, e2e |
| [TC-13-11](#tc-13-11) | Boundary | AC 11 | Unit |
| [TC-13-12](#tc-13-12) | Positive | AC 11 | Unit |
| [TC-13-13](#tc-13-13) | Negative | Only an Organiser | Unit |

---

### TC-13-01

| Item | Content |
|---|---|
| Test Case ID | TC-13-01 |
| Test Scenario | [Positive] AC 1, AC 10: the form captures every field, and shows them all for review before submitting |
| Pre-conditions | Signed in as the Organiser. |
| Test Steps | 1. On **My Events**, click **Create Event Request**. <br> 2. Fill **Event Name**, **Event Purpose** and **Event Description**; click **Next**. <br> 3. Fill **Proposed Start Date & Time**, **Proposed End Date & Time** and **Expected Attendance**; click **Next**. <br> 4. Fill **Venue Requirements**, **Preferred Room Layout** and **Accessibility Needs**; click **Next**. <br> 5. Fill **Equipment & Technical Support Requirements**; click **Next**. <br> 6. Fill **Registration Needs**, **Event Programme (Optional)** and **Special Requests / Arrangements (Optional)**; click **Next**. <br> 7. Read **Review Entered Details**, then click **Submit Request for Review**. |
| Test Data | Name "Regional Innovation Summit", attendance 250, layout "Theatre", a start a month from now and an end two hours later |
| Expected Result | **Review Entered Details** shows every value entered, including the accessibility needs. After submitting, the request is on **My Events**. |

**Automated by:** `tests/unit/events.test.ts` › "SCRUM-13 [AC1, AC10 - Happy Path]: successfully creates complete event request when all mandatory and optional fields are valid"; `e2e/events.spec.ts` › "organiser fills event request sections, reviews details, and submits request"

### TC-13-02

| Item | Content |
|---|---|
| Test Case ID | TC-13-02 |
| Test Scenario | [Positive] AC 2: the form offers ConnectSphere's active venues and equipment as suggestions |
| Pre-conditions | Signed in as the Organiser. The seed has active venues and equipment, and at least one inactive entry. |
| Test Steps | 1. Click **Create Event Request** and go to the venue and equipment steps. <br> 2. Look at the suggestions offered. |
| Test Data | The seeded catalogues |
| Expected Result | The suggestions are the active venues and equipment types only. The requirement fields stay free text (SCRUM-170). |

**Automated by:** `tests/unit/events.test.ts` › "SCRUM-13 [AC2 - Happy Path]: returns the venue and equipment catalogue to an organiser", "SCRUM-13 [AC2 - Catalogue Dependencies]: queries only active venue and equipment catalogue entries"

### TC-13-03

| Item | Content |
|---|---|
| Test Case ID | TC-13-03 |
| Test Scenario | [Negative] AC 2: the catalogues are not given to a signed-out caller |
| Pre-conditions | Signed out. |
| Test Steps | 1. Ask for the form's catalogues directly. |
| Test Data | None |
| Expected Result | The request is refused and nothing is returned. A failure while reading the catalogues is reported as an error, not swallowed. |

**Automated by:** `tests/unit/events.test.ts` › "SCRUM-13 [AC2 - Security Gate]: refuses a signed-out caller", "SCRUM-13 [AC2 - Throw Path]: rethrows unexpected catalogue lookup failures", "SCRUM-13 [AC2 - Throw Path]: rethrows unexpected permission-gate failures"

### TC-13-04

| Item | Content |
|---|---|
| Test Case ID | TC-13-04 |
| Test Scenario | [Positive] AC 3: the programme and special requests are optional |
| Pre-conditions | Signed in as the Organiser. |
| Test Steps | 1. Fill every required field as in TC-13-01, leaving **Event Programme (Optional)** and **Special Requests / Arrangements (Optional)** empty. <br> 2. Submit. <br> 3. Repeat with both optional fields filled. |
| Test Data | As TC-13-01; then programme "Day 1: Keynotes & Panel; Day 2: Workshops & Closing Ceremony" |
| Expected Result | Both submissions succeed. The second keeps the programme and special requests. |

**Automated by:** `tests/unit/events.test.ts` › "SCRUM-13 [AC3 - Happy Path]: accepts request when optional fields (programme, special requests) are omitted", "SCRUM-13 [AC3 - Happy Path]: successfully submits request with optional programme and special requests populated"; `e2e/events.spec.ts` › "organiser fills event request sections, reviews details, and submits request"

### TC-13-05

| Item | Content |
|---|---|
| Test Case ID | TC-13-05 |
| Test Scenario | [Negative] AC 4: a request with a mandatory field empty, or only spaces, is not submitted, and the field is marked |
| Pre-conditions | Signed in as the Organiser. |
| Test Steps | 1. Click **Create Event Request** and click **Next** through every step without filling anything. <br> 2. Click **Submit Request for Review**. <br> 3. Click **1. Basics**. <br> 4. Repeat with the name, purpose and description filled with spaces only. |
| Test Data | Every field empty; then "   " in the text fields |
| Expected Result | "Please fix the highlighted fields before submitting." and nothing is created. Each empty field is marked with its own message, for example "Event name is required." and "Venue requirements are required."; empty dates say "Proposed start date and time is required." rather than calling the date invalid. Spaces count as empty. |

**Automated by:** `tests/unit/events.test.ts` › "SCRUM-13 [AC4 - Business-Rule Negative]: returns field errors when any mandatory field is missing upon submission", "SCRUM-13 [AC4 - Business-Rule Negative]: blank start and end dates are reported as required, not as invalid dates", "SCRUM-13 [AC4 - Business-Rule Negative]: rejects whitespace-only values for mandatory string fields"; `e2e/events.spec.ts` › "SCRUM-13 [AC4] / SCRUM-14 AC2: submitting with mandatory fields left blank is refused and missing fields are indicated"

### TC-13-06

| Item | Content |
|---|---|
| Test Case ID | TC-13-06 |
| Test Scenario | [Positive] AC 5: an incomplete request can be saved as a draft |
| Pre-conditions | Signed in as the Organiser. |
| Test Steps | 1. Click **Create Event Request**, fill only **Event Name**, and move between the steps. <br> 2. Click **Save as Draft**. |
| Test Data | Name "Partial planning draft" |
| Expected Result | The draft is saved with the mandatory submission fields still empty, and is listed as a Draft. The rest of draft saving is SCRUM-15. |

**Automated by:** `tests/unit/events.test.ts` › "SCRUM-15 [AC1 - Happy Path]: allows saving a draft with mandatory submission fields left empty"; `e2e/events.spec.ts` › "organiser can navigate steps freely without mandatory fields and save partial draft"

### TC-13-07

| Item | Content |
|---|---|
| Test Case ID | TC-13-07 |
| Test Scenario | [Positive] AC 6: times are entered and shown in Singapore time, and stored as UTC |
| Pre-conditions | Signed in as the Organiser. |
| Test Steps | 1. Open the form's date step. <br> 2. Enter a start of 09:00 on a future date and submit. <br> 3. Open the request again. |
| Test Data | A start at 09:00 SGT |
| Expected Result | The form has no timezone field and says its times are SGT. The start is stored as 01:00 UTC, and shown again as 09:00 SGT. |

**Automated by:** `tests/unit/datetime.test.ts` › "converts Singapore wall-time string to UTC ISO instant", "SCRUM-129 [AC4 - UTC storage]: a Singapore wall time round-trips through the UTC instant it is stored as"; `e2e/events.spec.ts` › "SCRUM-129 [AC1 - Singapore timezone]: the request form has no timezone selector and states its times are SGT"

### TC-13-08

| Item | Content |
|---|---|
| Test Case ID | TC-13-08 |
| Test Scenario | [Boundary] AC 7: an attendance of zero or less is refused |
| Pre-conditions | Signed in as the Organiser, with every other field valid. |
| Test Steps | 1. Enter **Expected Attendance** 0 and submit. <br> 2. Enter -5 and submit. <br> 3. Enter 1 and submit. |
| Test Data | 0, -5, then 1 |
| Expected Result | 0 and -5 are refused with "Attendance must be a positive whole number." and nothing is created. 1 is accepted. |

**Automated by:** `tests/unit/events.test.ts` › "SCRUM-13 [AC7 - Domain Boundary]: rejects submission when expected attendance is 0", "SCRUM-13 [AC7 - Domain Boundary]: rejects submission when expected attendance is a negative number" and "SCRUM-13 [AC7] TC-13-08: an attendance of 1, the smallest positive whole number, is accepted".

### TC-13-09

| Item | Content |
|---|---|
| Test Case ID | TC-13-09 |
| Test Scenario | [Boundary] AC 8: an end equal to or before the start is refused; an overnight event is fine |
| Pre-conditions | Signed in as the Organiser, with every other field valid. |
| Test Steps | 1. Enter an end equal to the start and submit. <br> 2. Enter an end an hour before the start and submit. <br> 3. Enter a start of 22:00 and an end of 02:00 the next day, and submit. |
| Test Data | Start and end on a future date |
| Expected Result | Steps 1 and 2 are refused with "Proposed end date and time must be strictly after the start date and time." and nothing is created. Step 3 is accepted. |

**Automated by:** `tests/unit/events.test.ts` › "SCRUM-13 [AC8 - Domain Boundary]: rejects submission when proposed end date is equal to start date (zero-duration)", "SCRUM-13 [AC8 - Domain Boundary]: rejects submission when proposed end date is earlier than start date", "SCRUM-13 [AC8 - Implicit Rule]: accepts valid cross-midnight overnight event schedules spanning across calendar days"

### TC-13-10

| Item | Content |
|---|---|
| Test Case ID | TC-13-10 |
| Test Scenario | [Negative] AC 9: a start in the past is refused |
| Pre-conditions | Signed in as the Organiser. |
| Test Steps | 1. On the date step, enter a start of yesterday and click **Next**. <br> 2. Send a submission whose start is a minute ago. |
| Test Data | A start yesterday; a start a minute ago |
| Expected Result | Step 1 stays on the date step with an inline error. Step 2 is refused with "Proposed date cannot be in the past." and nothing is created. |

**Automated by:** `tests/unit/events.test.ts` › "SCRUM-13 [AC9 - Domain Boundary]: rejects submission when proposed start date is in the past", "SCRUM-13 [AC9] × SCRUM-129 [AC4]: rejects a UTC ISO start datetime that represents a past moment, confirming converted Singapore wall-times are rejected at the schema layer"; `e2e/events.spec.ts` › "SCRUM-13 [AC9]: entering a past start date on Step 2 blocks navigation to Step 3 and shows an inline error"

### TC-13-11

| Item | Content |
|---|---|
| Test Case ID | TC-13-11 |
| Test Scenario | [Boundary] AC 11: text over its limit is refused |
| Pre-conditions | Signed in as the Organiser, with every other field valid. |
| Test Steps | 1. Enter a name of 201 characters and submit. <br> 2. Enter a purpose of 1,001, a description of 5,001 and special requests of 5,001 characters, and submit. |
| Test Data | Strings of the lengths given |
| Expected Result | Each is refused with its limit, for example "Keep the name under 200 characters." and "Keep description under 5000 characters.", and nothing is created. |

**Automated by:** `tests/unit/events.test.ts` › "SCRUM-13 [AC1/AC11 - Input Constraint]: rejects event name (AC11, max 200), purpose (AC1 field schema, max 1000), and description and special request (AC11, max 5000) that exceed their character limits"

### TC-13-12

| Item | Content |
|---|---|
| Test Case ID | TC-13-12 |
| Test Scenario | [Positive] AC 11: text that looks like a script is kept as text and never runs |
| Pre-conditions | Signed in as the Organiser. |
| Test Steps | 1. Enter a name of `<script>alert(1)</script> Gala` with spaces around it, and submit. <br> 2. Open the request. |
| Test Data | As above |
| Expected Result | The name is saved trimmed, with the text unchanged, and shown as text: no script runs. |

**Automated by:** `tests/unit/events.test.ts` › "SCRUM-13 [AC11 - Script Injection Sanitisation & React Escaping]: preserves text content safely while trim-sanitising input strings, relying on React's automatic context-aware DOM escaping to prevent script execution", "SCRUM-13 [AC11 - Cross-Cutting / Input Constraint]: trims leading and trailing whitespace from string fields upon schema parsing"

### TC-13-13

| Item | Content |
|---|---|
| Test Case ID | TC-13-13 |
| Test Scenario | [Negative] Only a signed-in Organiser can create a request |
| Pre-conditions | Signed in as `attendee@test.local`; then signed out. |
| Test Steps | 1. As the Attendee, send a submission directly. <br> 2. Signed out, send a draft save and a submission. |
| Test Data | A complete request |
| Expected Result | Each is refused with "You do not have permission to do that." and nothing is written. |

**Automated by:** `tests/unit/events.test.ts` › "SCRUM-13 [Security Gate]: denies non-organiser user role (e.g. ATTENDEE) from submitting event requests", "SCRUM-13 [Security Gate]: refuses signed-out callers for createDraftEvent and submitEventRequest"

### TC-13-14

| Item | Content |
|---|---|
| Test Case ID | TC-13-14 |
| Test Scenario | [Positive] AC 1, with SCRUM-34 AC 6: the layout presets and accessibility quick-picks include what Venue Staff added |
| Pre-conditions | An active venue with the layout "garden-party" and the accessibility feature "tactile-paving", added by Venue Staff (SCRUM-34 TC-34-18). Signed in as `organiser@test.local`. |
| Test Steps | 1. Start an event request and reach Venue, Layout & Accessibility. <br> 2. Choose the Garden party layout. <br> 3. Type "Seats near the exit" as accessibility needs, then choose Tactile paving, then Tactile paving again. |
| Test Data | — |
| Expected Result | 1: Garden party follows the six presets; a venue layout a preset already names ("cocktail", covered by Cocktail / Standing) isn't offered twice. 2: the layout reads "Garden party". 3: accessibility needs reads "Seats near the exit, Tactile paving"; choosing it again adds nothing. Both fields stay free text. |

**Automated by:** `tests/unit/venue-options.test.ts` › "SCRUM-13 [AC1] TC-13-14: …"; `tests/unit/events.test.ts` › "SCRUM-13 [AC1] TC-13-14: …"; `e2e/venue-catalogue.spec.ts` › "SCRUM-34 [AC6] TC-34-18: …"
