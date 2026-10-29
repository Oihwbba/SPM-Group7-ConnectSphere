# SCRUM-190 — An event takes place within one day: test cases

Story and acceptance criteria: [docs/backlog/SCRUM-190.md](../backlog/SCRUM-190.md).
Format and conventions: [README.md](README.md). The rule is `eventPeriodError`
in [lib/schemas/event.ts](../../lib/schemas/event.ts), used by
`submitEventRequestSchema`, `createDraftEventSchema`, `checkSchedule`
([lib/schemas/clarification.ts](../../lib/schemas/clarification.ts), shared by
clarification answers and change requests) and `eventDetailsEditSchema`
([lib/schemas/event-edit.ts](../../lib/schemas/event-edit.ts)). The forms
join the date and times with `joinEventPeriod` in
[lib/datetime.ts](../../lib/datetime.ts).

**What this supersedes:** SCRUM-13 AC 1's separate start and end date/time,
and TC-13-09 step 3, which accepted an overnight event. Its test is replaced by
TC-190-05's overnight refusal.

**Why the day is Singapore's:** every event is entered in Singapore time
(SCRUM-129). 23:00 to 01:00 SGT is one UTC date but two Singapore days, so it
is refused; 01:00 to 10:00 SGT spans two UTC dates but one Singapore day, so it
is accepted (TC-190-05).

**No flaky dates:** a test period built as "now + N hours" crosses midnight SGT
for part of every day. Tests take theirs from `sgtPeriod` in
[tests/one-day-period.ts](../../tests/one-day-period.ts), which pins a period
to the Singapore wall clock, or use fixed instants.

**Shared pre-conditions for every case:** the database is migrated and seeded
and the app is running. Signed in as `organiser@test.local` (`Password123!`),
unless the case says otherwise.

| ID | Type | Criterion | Automated |
|---|---|---|---|
| [TC-190-01](#tc-190-01) | Positive | AC 1 | Unit, e2e |
| [TC-190-02](#tc-190-02) | Positive | AC 1 | Unit, e2e |
| [TC-190-03](#tc-190-03) | Boundary | AC 2 | Unit, e2e |
| [TC-190-04](#tc-190-04) | Negative | AC 2 | Unit, e2e |
| [TC-190-05](#tc-190-05) | Boundary | AC 1, AC 3 | Unit |
| [TC-190-06](#tc-190-06) | Negative | AC 3 (submitting, resubmitting) | Unit |
| [TC-190-07](#tc-190-07) | Negative | AC 3 (clarification answer) | Unit |
| [TC-190-08](#tc-190-08) | Negative | AC 3 (change request) | Unit |
| [TC-190-09](#tc-190-09) | Negative | AC 3 (Coordinator's edit) | Unit |
| [TC-190-10](#tc-190-10) | Positive | AC 3 (draft) | Unit |
| [TC-190-11](#tc-190-11) | Negative | AC 3 (Coordinator's edit of an event stored across two days) | Unit |
| [TC-190-12](#tc-190-12) | Negative | AC 3 (reopening a draft or rejected request stored across two days) | Unit |

---

### TC-190-01

| Item | Content |
|---|---|
| Test Case ID | TC-190-01 |
| Test Scenario | [Positive] AC 1: the request form asks for one event date, a start time and an end time, in Singapore time |
| Pre-conditions | Signed in as the Organiser. |
| Test Steps | 1. On **My Events**, click **Create Event Request**. <br> 2. Fill **Event Name**; click **Next**. <br> 3. Look at the Schedule step. <br> 4. Enter **Event Date** 3 Mar 2036, **Start Time** 09:00 and **End Time** 17:00. |
| Test Data | 2036-03-03, 09:00, 17:00 |
| Expected Result | The step has **Event Date**, whose picker offers days but no times, and **Start Time** and **End Time**, whose pickers offer times but no days; there is no date-and-time field. It says all times are Singapore time. The request carries a start of 2036-03-03T01:00Z and an end of 2036-03-03T09:00Z. |

**Automated by:** `tests/unit/event-one-day.test.ts` › "SCRUM-190 [AC1] TC-190-01: one date with a start and an end time is read as Singapore time"; `e2e/events.spec.ts` › "SCRUM-190 [AC1, AC2] TC-190-01, TC-190-04: the form asks for one date with a start and an end time, and an end time not after the start stops it at Step 2"

### TC-190-02

| Item | Content |
|---|---|
| Test Case ID | TC-190-02 |
| Test Scenario | [Positive] AC 1: a saved draft reopens with its date and times |
| Pre-conditions | Signed in as the Organiser. |
| Test Steps | 1. Start a request, enter **Event Date** 20 Nov 2027, **Start Time** 10:00 and **End Time** 18:00, and click **Save as Draft**. <br> 2. Click **Resume Draft** on its row and go to the Schedule step. |
| Test Data | 2027-11-20, 10:00, 18:00 |
| Expected Result | **Event Date** is 2027-11-20, **Start Time** 10:00 and **End Time** 18:00. The Review step shows "Date: 20 Nov 2027" and "Time: 10:00 am SGT – 6:00 pm SGT". |

**Automated by:** `tests/unit/event-one-day.test.ts` › "SCRUM-190 [AC1] TC-190-02: a stored period is shown as its Singapore date and times", "SCRUM-190 [AC1] TC-190-02: a draft with only an end keeps that end's date"; `e2e/events.spec.ts` › "SCRUM-15 [AC3] TC-15-05: organiser saves partial draft, locates and resumes draft with preserved fields, then completes and submits"

### TC-190-03

| Item | Content |
|---|---|
| Test Case ID | TC-190-03 |
| Test Scenario | [Boundary] AC 2: an end time equal to the start time is refused; one minute later is accepted |
| Pre-conditions | Signed in as the Organiser, on the Schedule step. |
| Test Steps | 1. Enter **Start Time** 14:00 and **End Time** 14:00, and click **Next**. <br> 2. Change **End Time** to 14:01 and click **Next**. |
| Test Data | A future date, 14:00, 14:00 then 14:01 |
| Expected Result | Step 1 stays on the Schedule step with "The end time must be after the start time." Step 2 moves on to the Venue step. A start or end that can't be read is an invalid range too, never a valid one. |

**Automated by:** `tests/unit/event-one-day.test.ts` › "SCRUM-190 [AC2] TC-190-03: an end equal to the start is refused as an invalid time range", "SCRUM-190 [AC2] TC-190-03: an end one minute after the start is accepted", "SCRUM-190 [AC2] TC-190-03: an unreadable start or end is an invalid time range, never a valid one"; `e2e/events.spec.ts` › "SCRUM-190 [AC1, AC2] TC-190-01, TC-190-04: the form asks for one date with a start and an end time, and an end time not after the start stops it at Step 2"

### TC-190-04

| Item | Content |
|---|---|
| Test Case ID | TC-190-04 |
| Test Scenario | [Negative] AC 2: an end time before the start time blocks submission and reports the time range as invalid |
| Pre-conditions | Signed in as the Organiser, every other field valid. |
| Test Steps | 1. Enter **Start Time** 17:00 and **End Time** 09:00. <br> 2. Submit. |
| Test Data | A future date, 17:00, 09:00 |
| Expected Result | "The end time must be after the start time." against the end, and nothing is created. Every place the period is set refuses it the same way (AC 3). |

**Automated by:** `tests/unit/event-one-day.test.ts` › "SCRUM-190 [AC2] TC-190-04: an end before the start is refused as an invalid time range" and, for each of submitting, saving a draft, a clarification answer, a change request and the Coordinator's edit, "SCRUM-190 [AC2, AC3] TC-190-04: … refuses an end before the start"; `tests/unit/events.test.ts` › "SCRUM-13 [AC8] TC-13-09, SCRUM-190 [AC2] TC-190-04: [Domain Boundary] rejects submission when proposed end date is earlier than start date"; `e2e/events.spec.ts` › "SCRUM-190 [AC1, AC2] TC-190-01, TC-190-04: the form asks for one date with a start and an end time, and an end time not after the start stops it at Step 2"

### TC-190-05

| Item | Content |
|---|---|
| Test Case ID | TC-190-05 |
| Test Scenario | [Boundary] AC 1, AC 3: an event ends on the Singapore day it starts |
| Pre-conditions | None; the rule is checked directly and through the submit action. |
| Test Steps | Check each period: <br> 1. 09:00 to 23:59 SGT on 3 Mar 2036. <br> 2. 09:00 to 00:00 SGT (4 Mar). <br> 3. 09:00 on 3 Mar to 17:00 on 4 Mar. <br> 4. 23:00 on 3 Mar to 01:00 on 4 Mar (one UTC date). <br> 5. 01:00 to 10:00 SGT on 4 Mar (two UTC dates). <br> 6. Submit a request from 23:00 tomorrow to 01:00 the day after. |
| Test Data | The instants above |
| Expected Result | 1 and 5 are accepted. 2, 3, 4 and 6 are refused with "An event starts and ends on the same day. Choose one date with a start and an end time." For 6 nothing is created. |

**Automated by:** `tests/unit/event-one-day.test.ts` › "SCRUM-190 [AC1, AC3] TC-190-05: an event ending at 23:59 SGT on the day it starts is within one day", "SCRUM-190 [AC1, AC3] TC-190-05: an event ending at midnight SGT ends on the next day and is refused", "SCRUM-190 [AC1, AC3] TC-190-05: an event running from one day into the next is refused", "SCRUM-190 [AC1] TC-190-05: the day is Singapore's: 23:00 to 01:00 SGT falls on one UTC date but two Singapore days, and is refused", "SCRUM-190 [AC1] TC-190-05: the day is Singapore's: 01:00 to 10:00 SGT spans two UTC dates but one Singapore day, and is accepted", "SCRUM-190 [AC1] TC-190-05: an instant's date is the Singapore one" and, for each place the period is set, "SCRUM-190 [AC3] TC-190-05: … accepts a period within one Singapore day"; `tests/unit/events.test.ts` › "SCRUM-190 [AC1, AC3] TC-190-05: an overnight request from 23:00 to 01:00 SGT the next day is refused, and nothing is created"

### TC-190-06

| Item | Content |
|---|---|
| Test Case ID | TC-190-06 |
| Test Scenario | [Negative] AC 3: submitting (SCRUM-14) or resubmitting an amended request (SCRUM-108) that runs into the next day is refused |
| Pre-conditions | Signed in as the Organiser; for the resubmission, a request Rejected with "Amend and resubmit". |
| Test Steps | 1. Submit a request from 09:00 one day to 17:00 the next. <br> 2. Amend the rejected request to the same period and resubmit it. |
| Test Data | 09:00 SGT to 17:00 SGT the following day |
| Expected Result | Both are refused with "An event starts and ends on the same day. Choose one date with a start and an end time." against the end. No request is created and the rejected one is unchanged. |

**Automated by:** `tests/unit/events.test.ts` › "SCRUM-190 [AC3] TC-190-06: a request running from one day into the next can't be submitted, and nothing is created"; `tests/unit/clarification-and-amend.test.ts` › "SCRUM-190 [AC3] TC-190-06: an amended request running across two days can't be resubmitted, and nothing is written"; `tests/unit/event-one-day.test.ts` › "SCRUM-190 [AC3] TC-190-06: submitting (SCRUM-14) refuses an event running into the next day"

### TC-190-07

| Item | Content |
|---|---|
| Test Case ID | TC-190-07 |
| Test Scenario | [Negative] AC 3: a clarification answer (SCRUM-108) moving the event across two days is refused |
| Pre-conditions | Signed in as the Organiser; an open clarification that lets the date and time be changed. |
| Test Steps | 1. In the clarification, set **Date**, **Start time** and **End time** so the end falls on the next day. <br> 2. Send the answer. |
| Test Data | 09:00 SGT to 17:00 SGT the following day |
| Expected Result | "Please fix the highlighted fields." with "An event starts and ends on the same day. Choose one date with a start and an end time." against the end. The clarification and the event are neither read nor written. |

**Automated by:** `tests/unit/clarification-and-amend.test.ts` › "SCRUM-190 [AC3] TC-190-07: an answer moving the event across two days is refused against the end, and nothing is read or written"; `tests/unit/event-one-day.test.ts` › "SCRUM-190 [AC3] TC-190-07: a clarification answer (SCRUM-108) refuses an event running into the next day"

### TC-190-08

| Item | Content |
|---|---|
| Test Case ID | TC-190-08 |
| Test Scenario | [Negative] AC 3: a change request (SCRUM-41 AC 4) moving the event across two days is refused |
| Pre-conditions | Signed in as the Organiser; a Planning event of theirs. |
| Test Steps | 1. Open **Request a change**, set an end on the day after the start. <br> 2. Submit the change request. |
| Test Data | An end 24 hours after the start |
| Expected Result | Refused with "An event starts and ends on the same day. Choose one date with a start and an end time." No change request or audit entry is written. |

**Automated by:** `tests/unit/change-requests.test.ts` › "SCRUM-190 [AC3] TC-190-08: a change request moving the event across two days is refused against the end, and nothing is written"; `tests/unit/event-one-day.test.ts` › "SCRUM-190 [AC3] TC-190-08: a change request (SCRUM-41 AC4) refuses an event running into the next day"

### TC-190-09

| Item | Content |
|---|---|
| Test Case ID | TC-190-09 |
| Test Scenario | [Negative] AC 3: the Coordinator's direct edit (SCRUM-25 AC 3) can't move the end to another day |
| Pre-conditions | Signed in as `coordinator@test.local`; a Planning event assigned to them. |
| Test Steps | 1. Click **Edit details**. <br> 2. Change **End time** so that the event ends on the next day. <br> 3. Save. |
| Test Data | An end 24 hours after the stored end |
| Expected Result | "An event starts and ends on the same day. Choose one date with a start and an end time." Nothing is read or saved. |

**Automated by:** `tests/unit/event-edit.test.ts` › "SCRUM-190 [AC3] TC-190-09: an end on the next day is refused as not one day, and nothing is read or written"; `tests/unit/event-one-day.test.ts` › "SCRUM-190 [AC3] TC-190-09: the Coordinator's edit (SCRUM-25 AC3) refuses an event running into the next day"

### TC-190-10

| Item | Content |
|---|---|
| Test Case ID | TC-190-10 |
| Test Scenario | [Positive] AC 3: a draft can still be saved without a date or times (SCRUM-15) |
| Pre-conditions | Signed in as the Organiser. |
| Test Steps | 1. Start a request, fill only **Event Name**, and click **Save as Draft**. <br> 2. Resume it. |
| Test Data | Name only |
| Expected Result | The draft is saved. Reopened, **Event Date**, **Start Time** and **End Time** are empty. A time entered without a date gives no start or end. A draft whose dates are given still follows the one-day rule (SCRUM-15 AC 4). |

**Automated by:** `tests/unit/event-one-day.test.ts` › "SCRUM-190 [AC3] TC-190-10: a draft can still be saved without a date or times", "SCRUM-190 [AC1, AC3] TC-190-10: without the date there is no start or end, so a draft saves without them", "SCRUM-190 [AC1, AC3] TC-190-10: a draft with no date or times shows empty fields"; `tests/unit/events.test.ts` › "SCRUM-15 [AC4], SCRUM-190 [AC3] TC-190-10: [Validation Rule] a draft with $rule is refused, because dates that are provided must still be valid" (the "end on a later day than the start" row); `tests/unit/event-one-day.test.ts` › "SCRUM-190 [AC3] TC-190-10: saving a draft (SCRUM-15) refuses an event running into the next day"

### TC-190-11

| Item | Content |
|---|---|
| Test Case ID | TC-190-11 |
| Test Scenario | [Negative] AC 3: the Coordinator's edit never moves a period stored across two days, from before this story, onto one day without them setting it |
| Pre-conditions | Signed in as `coordinator@test.local`; an event assigned to them, Under Review or in Planning, stored from 09:00 SGT on 3 Mar 2036 to 17:00 SGT on 4 Mar 2036 (allowed before SCRUM-190). |
| Test Steps | 1. Click **Edit details**. <br> 2. Change only **Event name** and save. <br> 3. Change **End time** to 17:30 and save. |
| Test Data | Stored 2036-03-03T01:00Z to 2036-03-04T09:00Z |
| Expected Result | The dialog says the event is saved as running across two days and asks for one date with a start and an end time. Step 2 sends the stored period unchanged and is refused with "An event starts and ends on the same day. Choose one date with a start and an end time.", so the end isn't moved without the Coordinator seeing it. Step 3 saves 2036-03-03T01:00Z to 2036-03-03T09:30Z, the one date and times shown. A one-day period left as it was read is sent unchanged. |

**Automated by:** `tests/unit/edit-details-dialog.test.ts` › "SCRUM-190 [AC3] TC-190-11: a save that leaves a two-day period's fields as read sends the stored period, not one moved onto the start's day", "SCRUM-190 [AC3] TC-190-11: so that save is refused as not one day, until the Coordinator sets one", "SCRUM-190 [AC3] TC-190-11: once the Coordinator changes a time, the period saved is the one date with the times they see", "SCRUM-190 [AC3] TC-190-11: a one-day period left as read is saved unchanged", "SCRUM-190 [AC3] TC-190-11: a period never set stays empty, so the save asks for it"

### TC-190-12

| Item | Content |
|---|---|
| Test Case ID | TC-190-12 |
| Test Scenario | [Negative] AC 3: reopening a Draft or Rejected request saved across two days, from before this story, never moves its end onto the start's day |
| Pre-conditions | Signed in as the Organiser; a Draft, and a request Rejected with "Amend and resubmit", each saved from 09:00 SGT on 3 Mar 2036 to 17:00 SGT on 4 Mar 2036 (allowed before SCRUM-190). |
| Test Steps | 1. Resume the Draft and go to the Schedule step. <br> 2. Change only **Event Name** and click **Save as Draft**. <br> 3. Amend the Rejected request and go to the Schedule step. <br> 4. Open a Draft saved within one day, and view a Submitted request saved across two days. |
| Test Data | Stored 2036-03-03T01:00Z to 2036-03-04T09:00Z |
| Expected Result | 1 and 3: **Event Date**, **Start Time** and **End Time** are empty, with "Events now take place within one day. Please choose the date and times again."; every other field is as saved. 2: the draft is saved with no period, not with its end moved onto 3 Mar; submitting asks for the date and times. 4: the one-day Draft opens with 2036-03-03, 09:00 and 17:00, and the Submitted request, which can't be edited, still shows the period it was saved with. |

**Automated by:** `tests/unit/create-event-dialog.test.ts` › "SCRUM-190 [AC3] TC-190-12: a %s request saved across two days opens with no date or times, and keeps everything else", "SCRUM-190 [AC3] TC-190-12: so saving it can't move the end onto the start's day: no period is sent until one is chosen", "SCRUM-190 [AC3] TC-190-12: the Organiser is told why the date and times are empty", "SCRUM-190 [AC3] TC-190-12: a draft within one Singapore day opens with its date and times", "SCRUM-190 [AC3] TC-190-12: a request that can't be edited still shows the period it was saved with"
