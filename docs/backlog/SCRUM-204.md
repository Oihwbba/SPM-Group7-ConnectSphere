<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-20. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-204 - Bug: A venue or equipment request can be created for an event that was just confirmed, closed or reassigned

| | |
|---|---|
| **Type** | Task |
| **Epic** | - |
| **Priority** | Medium |
| **Story points** | - |
| **Status in Jira** | In Review |
| **Sprint** | SCRUM Sprint 3 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-204 |

---

Found in the 20 Oct audit. `submitBookingRequest` (SCRUM-50) and `createEquipmentRequest` (SCRUM-27) check the event's status and the caller's right to act before their transaction. A confirmation, rejection, cancellation or reassignment that commits in between still gets a new Pending venue request or equipment request, for an event that can no longer take one or from a Coordinator who no longer has it.

**Acceptance criteria**

1. Both actions re-read the event's status and Coordinator under a `FOR UPDATE` lock on the event, and refuse with their usual message if it's no longer requestable or the caller may no longer ask. Nothing is written and nobody is notified.
2. A request for an event that is still requestable, from its Coordinator, is created exactly as before.
3. Tests cover Confirmed, Rejected, Cancelled and reassigned events, and fail without the lock re-check (TC-50-16, TC-27-17).

Related: SCRUM-50, SCRUM-27, SCRUM-170 AC4 (the equipment request already locks the event).
