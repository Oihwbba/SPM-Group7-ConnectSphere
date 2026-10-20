<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-20. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-32 - Report reserved equipment that can no longer be provided

| | |
|---|---|
| **Type** | Story |
| **Epic** | SCRUM-10 - Equipment Management |
| **Priority** | Medium |
| **Story points** | 2 |
| **Status in Jira** | Done |
| **Sprint** | SCRUM Sprint 3 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-32 |

---

**User story:** As a Technical Support Staff member, I want to report that reserved equipment can no longer be provided, with the reason, so that the Coordinator can decide how to re-plan.

**Acceptance criteria**

1. Given equipment is reserved for an event (SCRUM-31), when I report that it can't be provided and give a reason, then the reservation is flagged Needs Reconsideration (SCRUM-26) and stays reserved until the Coordinator resolves it.
2. The reason is required and shown to the Coordinator.
3. Given the reservation is already flagged, when I report it again, then nothing changes and no second notification is sent.
4. Technical Support cannot cancel a reservation or change its quantity or period. The Coordinator resolves the flag (SCRUM-26), which may cancel the reservation and return its stock.
5. The report and its resolution are recorded with who and when. The Coordinator is notified (SCRUM-124).

**Customer basis:** "Reserved equipment may become unavailable because of damage or maintenance" (briefing). "Changes require arrangements to be reviewed again; staff decide offline and coordinator update the system on the decision whether to cancel." "Adjustments must be handled manually by staff rather than through automatic un-booking."

**Change log**

* 2026-10-01: rewritten so Technical Support reports and the Coordinator decides (the earlier version let Technical Support change dates and cancel directly).
* 2026-10-01 (audit): reworded to reservations, matching the built equipment model. Removed two criteria that repeated SCRUM-26 (cancelling returns stock once) and SCRUM-82 (event cancellation). The unmerged PR #37 builds the earlier version of this story, where Technical Support changes or cancels reservations; close or rework it.

Functionality Area: Equipment Reservation
