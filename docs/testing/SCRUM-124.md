# SCRUM-124 — Staff and arrangement notifications: test cases

Story and acceptance criteria: [docs/backlog/SCRUM-124.md](../backlog/SCRUM-124.md).
Format and conventions: [README.md](README.md).

**Status:** this file grows with the story. SCRUM-124 is a list of triggers,
most of them in other stories, so each case is added by the pull request that
builds its trigger. So far only AC 7 (a change request is raised, SCRUM-41).
The hold, withdrawal and line-change triggers (AC 2 to AC 6) are in the open
pull requests for SCRUM-163 and SCRUM-142, and their cases join this file
once those merge. TC-124-01 to TC-124-06 are kept for them.

| ID                      | Type     | Criterion             | Automated         |
| ----------------------- | -------- | --------------------- | ----------------- |
| [TC-124-07](#tc-124-07) | Positive | AC 7, AC 12, AC 14    | Unit, integration |

---

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
