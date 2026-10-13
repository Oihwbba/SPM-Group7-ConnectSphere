# SCRUM-124 — Staff and arrangement notifications: test cases

Story and acceptance criteria: [docs/backlog/SCRUM-124.md](../backlog/SCRUM-124.md).
Format and conventions: [README.md](README.md).

**Status:** this file grows with the story. SCRUM-124 is a list of triggers,
most of them in other stories, so each case is added by the pull request that
builds its trigger. So far AC 4's hold triggers (a hold placed, or approved by
Venue Staff, SCRUM-163) and AC 7 (a change request is raised, SCRUM-41).
Cases for triggers that other merged stories built earlier (SCRUM-142's
withdrawals and line changes, SCRUM-163's reminders) still need to be added
here; TC-124-01 to TC-124-06 are kept for AC 1 to AC 6.

| ID                      | Type     | Criterion             | Automated         |
| ----------------------- | -------- | --------------------- | ----------------- |
| [TC-124-04](#tc-124-04) | Positive | AC 4, AC 14           | Unit, integration; partly to do |
| [TC-124-07](#tc-124-07) | Positive | AC 7, AC 12, AC 14    | Unit, integration |

---

### TC-124-04

| Item | Content |
|---|---|
| Test Case ID | TC-124-04 |
| Test Scenario | [Positive] AC 4, AC 14: the event's assigned Coordinator is told, once, when Venue Staff hold its venue (with the deadline and note) and when they approve the hold (with the deadline) |
| Pre-conditions | Signed in as `venuestaff@test.local`. A pending request for a Planning event assigned to `coordinator@test.local`. |
| Test Steps | 1. Hold it until a deadline, with a note. <br> 2. Approve the hold. <br> 3. Approve it again. <br> 4. On an event with no Coordinator yet, hold and approve its request. |
| Test Data | Note "Confirm the final headcount." |
| Expected Result | 1: "A venue is held for your event": '[venue] is held for "[event]" until [deadline]. To finalise: Confirm the final headcount. Once Venue Staff approve the hold, confirm it before then to secure the venue.' 2: "Venue Staff approved your hold": 'Venue Staff approved the hold on [venue] for "[event]". Confirm it before [deadline] to secure the venue.' Each notice is about the event and the booking. 3: refused, and no second notice. 4: the notices go to whoever requested the venue. |

**Automated by:** `tests/unit/booking-holds.test.ts` › "SCRUM-163 [AC1, AC5] TC-163-01, TC-163-09: holds a pending request and writes the Coordinator's three notices with their show-from times", "SCRUM-163 [AC7] TC-163-17, SCRUM-124 [AC4] TC-124-04: Venue Staff approve a live hold: it stays Held, records who and when, and tells its Coordinator", "SCRUM-163 [AC5] TC-163-09: an event with no Coordinator yet notifies whoever requested the venue" and "SCRUM-124 [AC4] TC-124-04: an event with no Coordinator yet tells whoever requested the venue"; `tests/integration/holds.test.ts` › "SCRUM-163 [AC7] TC-163-17, SCRUM-124 [AC4, AC14] TC-124-04: …" and "SCRUM-163 [AC7] TC-163-17, SCRUM-124 [AC14] TC-124-04: …". **Still to do:** a venue booking approved or rejected by Venue Staff (SCRUM-53) doesn't notify its Coordinator yet.

### TC-124-07

| Item | Content |
|---|---|
| Test Case ID | TC-124-07 |
| Test Scenario | [Positive] AC 7, AC 12, AC 14: the event's assigned Coordinator is notified, once, when the Organiser raises a change request |
| Pre-conditions | Signed in as `organiser2@test.local`. The event is in Planning, assigned to `coordinator2@test.local`. |
| Test Steps | 1. Raise a change request to Expected attendance and Venue requirements. <br> 2. Raise the same request again. <br> 3. Separately, raise a cancellation request. <br> 4. As the Coordinator, raise a request on the Organiser's behalf. |
| Test Data | Attendance 60; Venue requirements "Two halls"; cancellation reason "The sponsor withdrew." |
| Expected Result | 1: the Coordinator has one notice, "Change request raised": 'The organiser asked to change "[event]": Expected attendance, Venue requirements.', linked to the event. 2: refused (SCRUM-41 AC 7), and no second notice. 3: "Cancellation requested": 'The organiser asked to cancel "[event]". Their reason: The sponsor withdrew.' 4: no notice to the Coordinator who raised it. |

**Automated by:** `tests/unit/change-requests.test.ts` › the four "SCRUM-124 … TC-124-07" tests; `tests/integration/change-requests.test.ts` › "SCRUM-124 [AC7, AC14] TC-124-07: the assigned Coordinator gets exactly one notice of the Organiser's request"
