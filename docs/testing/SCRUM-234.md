# SCRUM-234 — Add the missing e2e journeys for SCRUM-142 AC5 and SCRUM-26's flagged reservation: test cases

SCRUM-234 is a Chore task in Jira, found in the 27 Oct e2e coverage analysis.
Two equipment journeys had no Playwright test, only unit and integration
tests. This chore adds them; the cases they automate stay in their stories'
docs, [TC-142-09](SCRUM-142.md#tc-142-09) and
[TC-26-08](SCRUM-26.md#tc-26-08) / [TC-26-10](SCRUM-26.md#tc-26-10), which
hold the full steps and expected results.

Format and conventions: [README.md](README.md).

**Shared pre-conditions:** a local PostgreSQL migrated with `npm run db:deploy`
and seeded with `npm run db:seed`. Both specs write their own events, so they
run only against a local database (`usesLocalDatabase`).

| ID | Type | Criterion | Automated |
|---|---|---|---|
| [TC-234-01](#tc-234-01) | Negative | AC 1, AC 4 | e2e |
| [TC-234-02](#tc-234-02) | Negative, Positive | AC 2, AC 4 | e2e |
| [TC-234-03](#tc-234-03) | Positive | AC 3 | Manual (a document check) |

---

### TC-234-01

| Item | Content |
|---|---|
| Test Case ID | TC-234-01 |
| Test Scenario | [Negative] AC 1, AC 4: a Confirmed event's Coordinator is offered no way to change or withdraw its equipment or venue requests (SCRUM-142 AC5) |
| Pre-conditions | A Confirmed event assigned to `coordinator@test.local`, with an Approved equipment request (a Projector line), its Confirmed reservation, and a Pending venue request. |
| Test Steps | 1. As the Coordinator, open the request's details on **Equipment requests**. <br> 2. Open the event's page, on its **Arrangements** tab. |
| Test Data | `coordinator@test.local` / `Password123!` |
| Expected Result | 1: the details show the Projector line, with neither **Change lines** nor **Withdraw request**. 2: the tab lists the confirmed arrangements, read-only, with neither button. The equipment request stays Approved, its reservation Confirmed, and the venue request Pending. The test passes locally and in CI. |

**Automated by:** `e2e/change-or-withdraw.spec.ts` › "SCRUM-142 [AC5] TC-142-09: once the event is Confirmed, its Coordinator is offered no way to change or withdraw its equipment or venue requests, and nothing changes"

### TC-234-02

| Item | Content |
|---|---|
| Test Case ID | TC-234-02 |
| Test Scenario | [Negative, Positive] AC 2, AC 4: a flagged reservation that no longer covers its request can't stand, and Cancel arrangement releases it (SCRUM-26 AC8, AC9) |
| Pre-conditions | A Planning event with an Approved equipment request for 3 projectors, and a Confirmed reservation of 2, flagged Needs Reconsideration by Technical Support (as SCRUM-32 does). |
| Test Steps | 1. As the Coordinator, open the event and choose **Still stands** on the flagged reservation. <br> 2. Choose **Cancel arrangement**, and confirm it in the dialog. |
| Test Data | `coordinator@test.local` / `Password123!` |
| Expected Result | 1: "It can't stand as it is: Only 2 Projector reserved for the event's period; its requests need 3. Cancel the arrangement and request again." The reservation stays Confirmed and flagged. 2: "Projector × 2 was cancelled. Technical Support will reserve it again." The reservation is Cancelled and no longer flagged. The test passes locally and in CI. |

**Automated by:** `e2e/reconsideration.spec.ts` › "SCRUM-26 [AC8, AC9] TC-26-08, TC-26-10: a flagged reservation that no longer covers its request can't stand, and Cancel arrangement releases it"

### TC-234-03

| Item | Content |
|---|---|
| Test Case ID | TC-234-03 |
| Test Scenario | [Positive] AC 3: both tests are cited from their stories' docs, and the index rows say e2e |
| Pre-conditions | — |
| Test Steps | 1. Read TC-142-09 in `SCRUM-142.md`, and TC-26-08 and TC-26-10 in `SCRUM-26.md`. <br> 2. Read those cases' rows in each doc's summary table. |
| Test Data | — |
| Expected Result | Each case's **Automated by** cites the test above by its exact title, and its summary row lists e2e. |

**Automated by:** Manual (a document check, done in review of #303).
