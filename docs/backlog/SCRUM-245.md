<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-11-01. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-245 - Chore: Stop three integration tests failing when another test file runs at the same time

| | |
|---|---|
| **Type** | Task |
| **Epic** | - |
| **Priority** | Medium |
| **Story points** | - |
| **Status in Jira** | In Review |
| **Sprint** | SCRUM Sprint 4 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-245 |

---

Found on 29 Oct running `npm run test:coverage` against the local database while checking PR #321 (SCRUM-233). Vitest runs the integration test files in parallel against one database, and three tests read rows another file writes at the same time. All pass on a rerun and passed in CI, so they fail only occasionally, but a red run costs a re-run and a look.

1. **SCRUM-21,** `tests/integration/reassign.test.ts`: the file creates a second Lead. While it exists, another file's action notifies every Lead, so the second Lead receives a notification for that other event. The cleanup deletes only this file's event's notifications, so deleting the second Lead fails on `Notification_userId_fkey` and the file fails, although its test passed.
2. **SCRUM-160 TC-160-13,** `tests/integration/venue-time-clashes.test.ts`: it checks that the seeded venues' times create no clash _between seeded bookings_, but reads every booking on those venues. `tests/integration/reconsideration.test.ts` (SCRUM-26) briefly holds an approved booking and a maintenance block on `ven_hall` at the same time, so TC-160-13 sometimes reports that pair as a clash.
3. **SCRUM-50 TC-50-09,** `tests/integration/bookings.test.ts`: it reads the events the booking form offers, then re-reads them to check each one, skipping any whose `updatedAt` is later than its start. Another file confirming one of `usr_coordinator`'s Planning events sets `updatedAt` inside its transaction, before it commits, so the re-read can find the event Confirmed with an earlier `updatedAt`, and the test fails with "expected \[ 'APPROVED', 'PLANNING' \] to include 'CONFIRMED'".

**Acceptance criteria**

1. `reassign.test.ts` creates and deletes no user: its concurrency test runs as the seeded Leads (`usr_coordinatorlead` and `usr_coordinatorlead_2`), and its cleanup deletes only its own event's rows, so it succeeds whatever another file sends the Leads.
2. TC-160-13 judges only clashes between seeded rows: seeded bookings (ids starting `bkg_`) and seeded unavailability (ids starting `vun_`), so rows another file writes don't change its result; a clash between two seeded rows still fails it.
3. TC-50-09 judges the events exactly as the form's query returned them (their status, Organiser and Coordinator), with no second read, so another file changing an event afterwards doesn't change its result; an event the form shouldn't offer still fails it.
4. Neither test's assertions are weakened otherwise, and `npm run test:coverage` passes against the local database and in CI.

**Change log**

* 2026-10-29 (PR #322): AC2 also names seeded unavailability (`vun_`), since TC-160-13 checks each booking against bookings and unavailability alike. No change in scope.
* 2026-10-30 (PR #322): TC-50-09 added (item 3, AC3), found in a later local coverage run with the same cause. The old AC3 is now AC4.
* 2026-10-30 (PR #322): AC1 now uses the seeded second Lead instead of deleting every notification sent to a throwaway one, as the GLM review advised: deleting those notifications could remove rows another file owns, and a notification sent between that delete and the user delete could still fail it. Same goal, no change in scope.
