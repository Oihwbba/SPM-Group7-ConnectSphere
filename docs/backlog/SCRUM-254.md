<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-30. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-254 - Chore: No event rests in Approved, and stop using the old registration capacity column

| | |
|---|---|
| **Type** | Task |
| **Epic** | SCRUM-6 - Event Request Lifecycle |
| **Priority** | Medium |
| **Story points** | - |
| **Status in Jira** | In Progress |
| **Sprint** | SCRUM Sprint 4 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-254 |

---

Two places in the code exist only for rows from before a later story, and the app can no longer create either:

* **Approved events.** SCRUM-135 AC12 says no event remains Approved after the approval action completes, and approval moves an event straight to Planning (SCRUM-81). The lifecycle (`lib/event-lifecycle.ts`) still lets an event left in Approved be cancelled, for rows from before that change, and nothing in the database stops an event being stored as Approved. The seed stored one until SCRUM-233.
* **`Event.registrationCapacity`.** SCRUM-73/74: the expected attendance is the registration capacity, and there is no separate value. Nothing in the app reads the column, but the seed still writes it, so it reads as a second capacity.

Found on 30 Oct while checking which old-data cases the code still handles (from the review of PR #323).

Out of scope: events from before SCRUM-186 with two approved equipment requests (SCRUM-186 AC5 keeps them on purpose); the placeholder reason "Reason not recorded (pre-constraint data)." on old rejected events and flagged bookings (data only, no code path); events ending on a different day from their start, from before SCRUM-190 (the seed has none).

**Acceptance criteria**

1. A migration moves any event stored as Approved to Planning, the move approval now makes (SCRUM-81), and records the move in the event's history as a system change.
2. The database refuses an event stored as Approved.
3. The lifecycle has no move out of Approved: the exception that let an old Approved event be cancelled is removed. No page treats an event as Approved either: the event page shows the readiness checklist, the next step and the Arrangements tab from Planning on (SCRUM-208, SCRUM-110). Approved stays as a name in the event's history (SCRUM-135 AC12).
4. The app and the seed no longer read or write `Event.registrationCapacity`. The column is dropped in a second pull request once the first is deployed (README, "Migration rules").
5. Tests no longer create events stored as Approved.

Builds on SCRUM-233 (PR #321), which stops the seed storing an Approved event, so its pull request is stacked on that branch.

**Change log**

* 2026-10-30: created from the review of PR #323 (SCRUM-246).
* 2026-10-30: AC3 also covers the event page's Approved branches (readiness checklist, next step, Arrangements tab), found while building it (Felicia Or).
