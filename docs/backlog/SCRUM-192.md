<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-18. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-192 - Chore: Stop SCRUM-161's integration tests (TC-161-06, TC-161-12) failing when run alongside the other test files

| | |
|---|---|
| **Type** | Task |
| **Epic** | - |
| **Priority** | Medium |
| **Story points** | - |
| **Status in Jira** | In Progress |
| **Sprint** | SCRUM Sprint 3 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-192 |

---

`npm run test:coverage` failed on 2026-10-18 on SCRUM-161 tests that pass when run alone. Vitest runs integration test files in parallel against one database, and three things depended on what else was running:

* **TC-161-06** (`tests/integration/unavailability.test.ts`) counted every Venue Staff user after recording the unavailability and expected that count × 2 notifications. When another file created a Venue Staff user between the two, the count no longer matched.
* **Temporary Venue Staff users.** `concurrency.test.ts` (SCRUM-53's second approver) and `w9-rules.test.ts` (TC-172-18's approver) create a Venue Staff user and delete it. Recording unavailability (SCRUM-161 AC4) and withdrawing a request (SCRUM-142) notify every Venue Staff member, so the two collide either way: a notification blocks the user's delete (`Notification_userId_fkey`, TC-172-18), or the delete makes the notification fail mid-action (TC-161-06, TC-142-12).
* **TC-161-12** ("over repeated unforced races", `concurrency.test.ts`) runs five real races, which take about 5 s alone: Vitest's default limit. Alongside the other files it goes over.

**Acceptance criteria**

1. TC-161-06 still proves SCRUM-161 AC4: each Venue Staff member is notified once for each affected event, and only Venue Staff receive that notification.
2. TC-161-06 passes whether or not the Venue Staff change while it runs. The pull request shows the old assertion failing and the new one passing when a Venue Staff user appears at that moment.
3. Breaking the notification code (no notification to Venue Staff, a duplicate, or one to someone who isn't Venue Staff) still turns TC-161-06 red.
4. No integration test creates and deletes a user that role-wide notifications reach.
5. TC-161-12's repeated races have time to finish alongside the other files.
6. No test configuration changes: integration test files keep running in parallel.

Found while merging main into SCRUM-38 (PR #216).
