# SCRUM-130 — Discard a draft request: test cases

Story and acceptance criteria: [docs/backlog/SCRUM-130.md](../backlog/SCRUM-130.md).
Format and conventions: [README.md](README.md). A draft is discarded by
`discardDraftEvent` in
[app/(app)/events/actions.ts](<../../app/(app)/events/actions.ts>), which sets
`Event.discardedAt`; the row is kept. The database refuses a discarded event
that is not a Draft (CHECK `event_discarded_only_draft`, migration
`20261005120000_discard_draft`).

**Shared pre-conditions for every case:** the database is migrated and seeded
and the app is running. Unless the case says otherwise, the draft is owned by
`organiser@test.local` (`Password123!`).

| ID                      | Type        | Criterion  | Automated              |
| ----------------------- | ----------- | ---------- | ---------------------- |
| [TC-130-01](#tc-130-01) | Positive    | AC 1       | Unit, integration, e2e |
| [TC-130-02](#tc-130-02) | Negative    | AC 1       | Unit, integration      |
| [TC-130-03](#tc-130-03) | Negative    | AC 2       | e2e                    |
| [TC-130-04](#tc-130-04) | Negative    | AC 3       | Unit, integration, e2e |
| [TC-130-05](#tc-130-05) | Negative    | AC 4       | Unit, integration      |
| [TC-130-06](#tc-130-06) | Negative    | AC 4       | Unit, integration      |
| [TC-130-07](#tc-130-07) | Boundary    | AC 1       | Unit, integration      |
| [TC-130-08](#tc-130-08) | Concurrency | AC 1, AC 3 | Unit, integration      |
| [TC-130-09](#tc-130-09) | Positive    | AC 1       | Unit, integration      |
| [TC-130-10](#tc-130-10) | Positive    | AC 6       | Unit, e2e              |
| [TC-130-11](#tc-130-11) | Boundary    | AC 6       | Unit, e2e              |
| [TC-130-12](#tc-130-12) | Positive    | AC 5       | Unit, integration      |

---

### TC-130-01

| Item            | Content                                                                                                                                                                                                                                                     |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Test Case ID    | TC-130-01                                                                                                                                                                                                                                                   |
| Test Scenario   | [Positive] AC 1: a confirmed discard removes the draft from My Event Requests                                                                                                                                                                               |
| Pre-conditions  | Signed in as the Organiser. A Draft of theirs is listed on **Events**.                                                                                                                                                                                      |
| Test Steps      | 1. On the draft's row, click **Discard**. <br> 2. In "Discard this draft?", click **Discard Draft**. <br> 3. Reload the page.                                                                                                                               |
| Test Data       | A draft named "Team offsite (no longer needed)"                                                                                                                                                                                                             |
| Expected Result | The toast says `"Team offsite (no longer needed)" was discarded.` The row is gone, and stays gone after the reload. The row still exists in the database as a Draft with `discardedAt` set, and its history has one `DISCARDED` entry naming the Organiser. |

**Automated by:** `tests/unit/discard-draft.test.ts` › "SCRUM-130 [AC1] TC-130-01: …", "SCRUM-130 [AC1, AC5] TC-130-01: …"; `tests/integration/discard-draft.test.ts` › "SCRUM-130 [AC1] TC-130-01: …"; `e2e/discard-draft.spec.ts` › "SCRUM-130 [AC1, AC2] TC-130-01, TC-130-03: …"

### TC-130-02

| Item            | Content                                                                                                                                                                        |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Test Case ID    | TC-130-02                                                                                                                                                                      |
| Test Scenario   | [Negative] AC 1: a discarded draft cannot be reopened                                                                                                                          |
| Pre-conditions  | As TC-130-01, after the draft was discarded. An older tab still shows it.                                                                                                      |
| Test Steps      | 1. In the older tab, click **Resume Draft**, change the name, click **Save as Draft**. <br> 2. Send a save, and a submit, for the draft's id directly.                         |
| Test Data       | The discarded draft's id                                                                                                                                                       |
| Expected Result | Saving is refused ("Draft event not found or cannot be modified."); submitting is refused ("Draft or rejected event not found or cannot be submitted."). The row is unchanged. |

**Automated by:** `tests/unit/discard-draft.test.ts` › "SCRUM-130 [AC1] TC-130-02: …" (three); `tests/integration/discard-draft.test.ts` › "SCRUM-130 [AC1] TC-130-02: …"

### TC-130-03

| Item            | Content                                                                                                           |
| --------------- | ----------------------------------------------------------------------------------------------------------------- |
| Test Case ID    | TC-130-03                                                                                                         |
| Test Scenario   | [Negative] AC 2: cancelling the confirmation changes nothing                                                      |
| Pre-conditions  | As TC-130-01.                                                                                                     |
| Test Steps      | 1. Click **Discard**, then **Keep Draft**. <br> 2. Reload. <br> 3. Click **Discard**, then press Escape.          |
| Test Data       | —                                                                                                                 |
| Expected Result | The prompt closes each time and the draft stays listed, including after the reload. `discardedAt` is still empty. |

**Automated by:** `e2e/discard-draft.spec.ts` › "SCRUM-130 [AC1, AC2] TC-130-01, TC-130-03: …"

### TC-130-04

| Item            | Content                                                                                                                                                                                                                                                |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Test Case ID    | TC-130-04                                                                                                                                                                                                                                              |
| Test Scenario   | [Negative] AC 3: only a Draft can be discarded                                                                                                                                                                                                         |
| Pre-conditions  | Signed in as the Organiser, with one Draft and one submitted request of theirs.                                                                                                                                                                        |
| Test Steps      | 1. Look at both rows on **Events**. <br> 2. Send a discard for the submitted request's id directly.                                                                                                                                                    |
| Test Data       | Each non-draft status: Submitted, Under Review, Approved, Planning, Confirmed, Completed, Cancelled, Rejected                                                                                                                                          |
| Expected Result | **Discard** shows on the Draft only. The direct request is refused ("Only a draft can be discarded. A submitted request is cancelled through a change request.") and nothing changes. The database also refuses a discarded event that is not a Draft. |

**Automated by:** `tests/unit/discard-draft.test.ts` › "SCRUM-130 [AC3] TC-130-04: …" (each status); `tests/integration/discard-draft.test.ts` › "SCRUM-130 [AC3] TC-130-04: …"; `e2e/discard-draft.spec.ts` › "SCRUM-130 [AC3] TC-130-04: …"

### TC-130-05

| Item            | Content                                                                                                                                                       |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Test Case ID    | TC-130-05                                                                                                                                                     |
| Test Scenario   | [Negative] AC 4: another Organiser cannot discard my draft                                                                                                    |
| Pre-conditions  | Signed in as `organiser2@test.local`. The draft belongs to `organiser@test.local`.                                                                            |
| Test Steps      | 1. Send a discard for the draft's id directly. <br> 2. Send one for an id that does not exist.                                                                |
| Test Data       | The draft's id; `evt_missing`                                                                                                                                 |
| Expected Result | Both are refused with the same "Event not found.", so the request can't reveal the draft exists (SCRUM-68). The draft is untouched and no history is written. |

**Automated by:** `tests/unit/discard-draft.test.ts` › "SCRUM-130 [AC4] TC-130-05: …" (three); `tests/integration/discard-draft.test.ts` › "SCRUM-130 [AC4] TC-130-05: …"

### TC-130-06

| Item            | Content                                                                                       |
| --------------- | --------------------------------------------------------------------------------------------- |
| Test Case ID    | TC-130-06                                                                                     |
| Test Scenario   | [Negative] AC 4: no other role can discard a draft                                            |
| Pre-conditions  | Signed in as each non-Organiser role, or not signed in.                                       |
| Test Steps      | 1. Send a discard for the Organiser's draft directly.                                         |
| Test Data       | Coordinator, Venue Staff, Technical Support, Attendee; no session                             |
| Expected Result | Refused ("You do not have permission to do that.") before the event is read; nothing changes. |

**Automated by:** `tests/unit/discard-draft.test.ts` › "SCRUM-130 [AC4] TC-130-06: …" (each role, and no session); `tests/integration/discard-draft.test.ts` › "SCRUM-130 [AC4] TC-130-06: …"

### TC-130-07

| Item            | Content                                                                                              |
| --------------- | ---------------------------------------------------------------------------------------------------- |
| Test Case ID    | TC-130-07                                                                                            |
| Test Scenario   | [Boundary] AC 1: discarding a draft that is already discarded                                        |
| Pre-conditions  | As TC-130-01, with the draft open in two tabs.                                                       |
| Test Steps      | 1. Discard it in the first tab. <br> 2. Before the second tab refreshes, discard it there too.       |
| Test Data       | —                                                                                                    |
| Expected Result | Both succeed. `discardedAt` keeps its first value and the history has exactly one `DISCARDED` entry. |

**Automated by:** `tests/unit/discard-draft.test.ts` › "SCRUM-130 [AC1] TC-130-07: …"; `tests/integration/discard-draft.test.ts` › "SCRUM-130 [AC1] TC-130-07: …"

### TC-130-08

| Item            | Content                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Test Case ID    | TC-130-08                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Test Scenario   | [Concurrency] AC 1, AC 3: the draft is discarded while it is being submitted or saved                                                                                                                                                                                                                                                                                                                                                            |
| Pre-conditions  | A complete Draft, open in two tabs.                                                                                                                                                                                                                                                                                                                                                                                                              |
| Test Steps      | 1. Submit it in one tab and discard it in the other at the same moment, in each order. <br> 2. With a fresh Draft, click **Save as Draft** in one tab while it is discarded, or submitted, in the other.                                                                                                                                                                                                                                         |
| Test Data       | —                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Expected Result | Exactly one wins. If the submit commits first, the discard says "This draft changed while you were discarding it. Refresh and try again." and the request stays submitted. If the discard commits first, the submit is refused and the event stays a discarded Draft, with no coordinator and no notification. A save that lands after a discard or a submit is refused ("Draft event not found or cannot be modified.") and overwrites nothing. |

**Automated by:** `tests/unit/discard-draft.test.ts` › "SCRUM-130 [AC1] TC-130-08: …"; `tests/integration/discard-draft.test.ts` › "SCRUM-130 [AC1, AC3] TC-130-08: …", "SCRUM-130 [AC1] TC-130-08: …" (four; each order forced by holding the row lock)

### TC-130-09

| Item            | Content                                                                                                                                                                                                      |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Test Case ID    | TC-130-09                                                                                                                                                                                                    |
| Test Scenario   | [Positive] AC 1: a draft started from a rejection (SCRUM-126) can be discarded and started again                                                                                                             |
| Pre-conditions  | A request of the Organiser's rejected as "Submit as a new request", with a Draft already started from it.                                                                                                    |
| Test Steps      | 1. Discard that Draft. <br> 2. On the rejected request, click **Start New Request**. <br> 3. Click it again.                                                                                                 |
| Test Data       | —                                                                                                                                                                                                            |
| Expected Result | Step 2 starts a fresh Draft rather than pointing at the discarded one. Step 3 says "A new request was already started from this one." and returns that fresh Draft. The discarded one stays out of the list. |

**Automated by:** `tests/unit/discard-draft.test.ts` › "SCRUM-130 [AC1] TC-130-09: …"; `tests/integration/discard-draft.test.ts` › "SCRUM-130 [AC1] TC-130-09: …"

### TC-130-10

| Item            | Content                                                                                                       |
| --------------- | ------------------------------------------------------------------------------------------------------------- |
| Test Case ID    | TC-130-10                                                                                                     |
| Test Scenario   | [Positive] AC 6: a draft whose proposed start has passed warns when opened                                    |
| Pre-conditions  | A Draft of the Organiser's whose start was a week ago.                                                        |
| Test Steps      | 1. Click **Resume Draft** on it. <br> 2. On step 2, set the start to a date next year.                        |
| Test Data       | Start: 7 days ago                                                                                             |
| Expected Result | On opening, the editor shows "Dates are in the past – update them before submitting". It clears after step 2. |

**Automated by:** `tests/unit/discard-draft.test.ts` › "SCRUM-130 [AC6] TC-130-10: …" (three); `e2e/discard-draft.spec.ts` › "SCRUM-130 [AC6] TC-130-10, TC-130-11: …"

### TC-130-11

| Item            | Content                                                                                                |
| --------------- | ------------------------------------------------------------------------------------------------------ |
| Test Case ID    | TC-130-11                                                                                              |
| Test Scenario   | [Boundary] AC 6: no warning when the start has not passed, or there is none                            |
| Pre-conditions  | Drafts of the Organiser's with the start values below.                                                 |
| Test Steps      | 1. Click **Resume Draft** on each.                                                                     |
| Test Data       | Start exactly now; in the future; no start; an unreadable value                                        |
| Expected Result | No warning in any case. "Exactly now" is not in the past, matching the submit rule (start before now). |

**Automated by:** `tests/unit/discard-draft.test.ts` › "SCRUM-130 [AC6] TC-130-11: …"; `e2e/discard-draft.spec.ts` › "SCRUM-130 [AC6] TC-130-10, TC-130-11: …" (the future draft)

### TC-130-12

| Item            | Content                                                                                                           |
| --------------- | ----------------------------------------------------------------------------------------------------------------- |
| Test Case ID    | TC-130-12                                                                                                         |
| Test Scenario   | [Positive] AC 5: drafts never expire automatically                                                                |
| Pre-conditions  | A Draft of the Organiser's last updated a year ago, whose dates have passed.                                      |
| Test Steps      | 1. Open **Events**. <br> 2. Resume it, move the dates forward, click **Save as Draft**.                           |
| Test Data       | Last updated, and start: 365 days ago                                                                             |
| Expected Result | It is still listed and saves normally. My Event Requests filters out only discarded drafts: no age or date limit. |

**Automated by:** `tests/unit/discard-draft.test.ts` › "SCRUM-130 [AC1, AC5] TC-130-01: …" (the list query); `tests/integration/discard-draft.test.ts` › "SCRUM-130 [AC5] TC-130-12: …"
