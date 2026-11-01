<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-31. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-249 - Bug: An overdue event can still be approved or confirmed, so an event that never happened can end up Completed

| | |
|---|---|
| **Type** | Task |
| **Epic** | SCRUM-6 - Event Request Lifecycle |
| **Priority** | High |
| **Story points** | - |
| **Status in Jira** | In Review |
| **Sprint** | SCRUM Sprint 4 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-249 |

---

**Acceptance criteria**

1. Given an event is Under Review and its start time has passed, when its Coordinator approves it, then approval is refused, nothing is saved, and the message says the event is overdue and can be rejected or cancelled. Rejecting it still works.
2. Given an event is in Planning and its start time has passed, when its Coordinator confirms it, then confirmation is refused in the same way and nothing is saved. Rejecting it (SCRUM-117) and cancelling it (SCRUM-82) still work.
3. Overdue means what `isOverdue` already means: the start is strictly before now. An event whose start is exactly now, or later, can still be approved and confirmed. The check is made under the event-row lock together with the existing checks.
4. On the event page, the Next step banner for an overdue event tells its Coordinator to cancel or reject it, not to approve or confirm it.

**Change log**

* 2026-10-30: created in Sprint 4 from a code review of the Event Request Lifecycle and Attendee Registration epics. Not yet reproduced in the running app. No change to any Done story's criteria: this enforces SCRUM-82 AC10 as written.
* 2026-10-30: corrected the entry above. SCRUM-82 AC10 says how an overdue event is shown, and that is met; this bug closes the gap it leaves, that approving or confirming one isn't refused. Criteria unchanged.
