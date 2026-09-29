<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-09-30. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-110 - See an event's readiness checklist

| | |
|---|---|
| **Type** | Story |
| **Epic** | SCRUM-6 - Event Request Lifecycle |
| **Priority** | Highest |
| **Story points** | 3 |
| **Status in Jira** | In Progress |
| **Sprint** | SCRUM Sprint 2 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-110 |

---

**As an Event Coordinator**, I want to see a readiness checklist of an event's essential arrangements, so that I know exactly what is outstanding before I can confirm it.

**Acceptance Criteria**

* The checklist for a Planning event always includes **Venue booking**. It is complete only when a venue booking for this event is **Approved**.
* If the event has an equipment request, the checklist includes **Equipment**. It is complete only when **every requested line is reserved in full** for the event's period. If there is no equipment request, the item isn't shown and doesn't block confirmation.
* Given the venue booking is Pending or Rejected, then the Venue item shows "Pending" or "Rejected – <reason>" and is incomplete.
* Given a reservation covers only part of a requested quantity, then the Equipment item shows the shortfall (e.g. "Projector 3/5 reserved").
* Given every item is complete, then the checklist shows **Ready to confirm**, which is what enables SCRUM-81's Confirm action.
* The checklist is visible to the assigned Coordinator on the event page. The Organiser sees the item names and states but not internal reasons.

Functionality Area: Event Status Management
