# SCRUM-16 — Distinguish drafts from submitted requests: test cases

Story and acceptance criteria: [docs/backlog/SCRUM-16.md](../backlog/SCRUM-16.md).
Format and conventions: [README.md](README.md). Statuses are shown by the
status badge ([components/events/status-badge.tsx](../../components/events/status-badge.tsx));
the Organiser's list is
[events-client.tsx](<../../app/(app)/events/events-client.tsx>).

Written on 2026-10-12 from the acceptance criteria, then mapped to the tests
that already existed (SCRUM-176). The tests predate the `SCRUM-n [ACx] TC-n-xx`
title format, so each case names them by their current titles.

**Shared pre-conditions for every case:** the database is migrated and seeded
and the app is running. Signed in as `organiser@test.local` (`Password123!`),
with one draft and one submitted request of theirs, unless the case says
otherwise.

| ID | Type | Criterion | Automated |
|---|---|---|---|
| [TC-16-01](#tc-16-01) | Positive | AC 1, AC 3, AC 6 | Unit, e2e |
| [TC-16-02](#tc-16-02) | Positive | AC 2, AC 5 | Unit |
| [TC-16-03](#tc-16-03) | Negative | AC 4 | Unit |
| [TC-16-04](#tc-16-04) | Negative | AC 7 | Unit, e2e |
| [TC-16-05](#tc-16-05) | Negative | AC 8 | e2e |

---

### TC-16-01

| Item | Content |
|---|---|
| Test Case ID | TC-16-01 |
| Test Scenario | [Positive] AC 1, AC 3, AC 6: a draft looks different from a submitted request on My Events, and offers to resume |
| Pre-conditions | Signed in as the Organiser, with a draft and a submitted request. |
| Test Steps | 1. Open **My Events**. <br> 2. Compare the two rows. <br> 3. Click **Drafts**, then **Submitted**, then **All**. <br> 4. Open the draft. |
| Test Data | Draft "US16 Draft"; submitted "US16 Submitted" |
| Expected Result | The draft row shows a Draft badge (since the shared page conventions, the badge is the one Draft marker; the second "Draft — Incomplete" tag is gone), and a **Resume Draft** button; the submitted row shows its own status badge. **Drafts** shows only the draft, **Submitted** only the other. The draft's detail shows the Draft status too. |

**Automated by:** `tests/unit/events.test.ts` › "SCRUM-16 [AC1, AC2 - Happy Path]: creates event with status DRAFT ensuring visual and logical separation from SUBMITTED"; `e2e/events.spec.ts` › "organiser can visually distinguish draft requests from submitted ones side-by-side and filter by status"

### TC-16-02

| Item | Content |
|---|---|
| Test Case ID | TC-16-02 |
| Test Scenario | [Positive] AC 2, AC 5: every status has its own colour, icon and words, so colour is never the only signal |
| Pre-conditions | None beyond the shared ones. |
| Test Steps | 1. Look at the badge for each of the nine statuses. |
| Test Data | Draft, Submitted, Under Review, Approved, Planning, Confirmed, Completed, Cancelled, Rejected |
| Expected Result | Each badge has a distinct icon and colour pair and a label in words, not the stored value. The Draft badge is muted and never looks like Under Review. |

**Automated by:** `tests/unit/status-badge.test.ts` › "covers every one of the nine statuses", "gives every status its own icon, so colour is never the only signal", "gives every status a distinct icon and colour pair", "SCRUM-16: a draft is muted, and never shares a look with a request under review", "labels each status in words a user reads, not the enum value"

### TC-16-03

| Item | Content |
|---|---|
| Test Case ID | TC-16-03 |
| Test Scenario | [Negative] AC 4: a draft never reaches a Coordinator's view |
| Pre-conditions | The Organiser has a draft. Signed in as `coordinator@test.local`. |
| Test Steps | 1. Open **Events**. |
| Test Data | The Organiser's draft |
| Expected Result | The draft isn't listed; the Coordinator's list never includes Draft events. |

**Automated by:** `tests/unit/events.test.ts` › "SCRUM-16 [AC4 - Coordinator View Exclusion], SCRUM-165 [AC8] TC-165-11: the coordinator query lists only their own events, so no draft or unassigned request"; `tests/unit/coordinator-assigned-events.test.ts` › "[Negative] AC1: an unassigned draft is not in any Coordinator's list"

### TC-16-04

| Item | Content |
|---|---|
| Test Case ID | TC-16-04 |
| Test Scenario | [Negative] AC 7: only a draft opens the draft editing flow |
| Pre-conditions | Signed in as the Organiser, with a draft and a submitted request. |
| Test Steps | 1. On **My Events**, look for **Resume Draft** on each row. <br> 2. Send a draft save for the submitted request's id. |
| Test Data | The submitted request's id |
| Expected Result | Only the draft row offers **Resume Draft**. Saving the submitted request as a draft is refused with "Draft event not found or cannot be modified." A rejected request offers **Amend & Resubmit** instead, which SCRUM-108 permits. |

**Automated by:** `e2e/events.spec.ts` › "organiser can visually distinguish draft requests from submitted ones side-by-side and filter by status"; `tests/unit/events.test.ts` › "SCRUM-14 [AC4 - Business-Rule Negative]: refuses to edit a caller's own event as a draft once it has been submitted"

### TC-16-05

| Item | Content |
|---|---|
| Test Case ID | TC-16-05 |
| Test Scenario | [Negative] AC 8: showing, filtering and resuming a draft change nothing |
| Pre-conditions | Signed in as the Organiser, with a draft. |
| Test Steps | 1. Open **My Events**, switch between **Drafts**, **Submitted** and **All**, and open the draft. <br> 2. Click **Resume Draft** and close the form without saving. <br> 3. Check the draft's status and history. |
| Test Data | One draft |
| Expected Result | The draft is still a Draft, with no new history entry. |

**Automated by:** `e2e/draft-views.spec.ts` › "SCRUM-16 [AC8] TC-16-05: switching tabs, opening a draft and closing Resume Draft leave it a Draft with no new history" (status, last change and history are read from the database).
