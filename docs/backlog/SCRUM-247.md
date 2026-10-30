<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-30. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-247 - Bug: A Coordinator's edit during re-planning can set expected attendance below the people already registered, overbooking the event

| | |
|---|---|
| **Type** | Task |
| **Epic** | SCRUM-11 - Attendee Registration |
| **Priority** | Highest |
| **Story points** | - |
| **Status in Jira** | To Do |
| **Sprint** | SCRUM Sprint 4 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-247 |

---

Expected attendance is the event's registration capacity, and an event must not be oversubscribed (SCRUM-74). When an impactful change request is approved, a Confirmed event goes back to Planning and its registrations stay Registered (SCRUM-128 AC5). In Planning, the assigned Coordinator can change expected attendance directly (SCRUM-25 AC3).

The change-request route refuses an attendance below the number of active registrations (SCRUM-128 AC7, `change-decision-actions.ts:254`). The direct edit (`app/(app)/events/edit-actions.ts`) does not.

**Example:** 50 Attendees are registered. The event is re-planned, the Coordinator edits attendance to 30 and re-confirms. The event now has 50 registrations for 30 places.

**Acceptance criteria**

1. Given an event has N active registrations, when its Coordinator saves a direct edit with an expected attendance below N, the edit is refused, nothing is saved, and the number of active registrations is shown (as in SCRUM-128 AC7). An attendance of exactly N saves.
2. The count is taken under the event-row lock that registration also takes (SCRUM-73), so a registration and an edit can't together go past the limit.

**Change log**

* 2026-10-30: created in Sprint 4 from a code and UI review of the Event Request Lifecycle and Attendee Registration epics, confirmed against the seeded app running locally.
* 2026-10-30: removed the Registrations-tab wording change (it would contradict SCRUM-70 AC3, which shows remaining capacity) and the test-naming criterion, which the Definition of Done already covers.
