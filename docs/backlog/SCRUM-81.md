<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-09. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-81 - Move an approved event through planning to confirmed

| | |
|---|---|
| **Type** | Story |
| **Epic** | SCRUM-6 - Event Request Lifecycle |
| **Priority** | Highest |
| **Story points** | 5 |
| **Status in Jira** | Done |
| **Sprint** | SCRUM Sprint 2 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-81 |

---

**User story:** As an Event Coordinator, I want to confirm an event once all its essential arrangements are approved, so that the Organiser knows the event will go ahead and Attendees can register.

**Acceptance criteria**

1. Given I approve an event request (SCRUM-19), then in the same action the event is recorded as Approved and moves to Planning. No event remains in Approved. The approval (who, when) is recorded in its history.
2. Given the request was Submitted with no Coordinator yet, when I approve it, then I become its assigned Coordinator in the same action.
3. Given an event in Planning whose readiness checklist (SCRUM-110) shows Ready to confirm, when I view it, then a Confirm event action is available.
4. Given the checklist is not complete, then Confirm is unavailable and the outstanding items are listed. A direct confirm request is refused and the status doesn't change.
5. Given I confirm a ready event, then its status becomes Confirmed, the confirming Coordinator and time are recorded, and registration opens for Attendees (SCRUM-73) unless the Organiser chose Registration needed: No (SCRUM-171).
6. Given the event is Confirmed, when its Organiser opens it, then they see the booked venue, the date and time, and the reserved equipment.
7. Only the event's assigned Coordinator can confirm it; anyone else is refused with no status change.
8. Given the event is already Confirmed, when Confirm is submitted again, then nothing changes and no second confirmation is recorded.

**Related:** the full list of allowed transitions is SCRUM-135; the Organiser is notified (SCRUM-45). The branch also lets Technical Support reserve equipment for Planning events (SCRUM-31's action accepted only Approved events), so SCRUM-81 and SCRUM-110 must merge together.

**Change log**

* 2026-10-01 (mid-sprint correction, no new scope): AC1 states that Approved is passed through in the same action.
* 2026-10-01 (audit): AC2 states what the branch already does for an unassigned request. AC6 says reserved equipment, as the branch shows. AC5 adds opening registration on confirmation, one line in the confirm action (set the event's registration as enabled). Without it, an event that went through the app could never take registrations, which the Sprint 2 goal needs.
* 2026-10-07: AC5 points the Registration needed choice to SCRUM-171, which took it over when SCRUM-127 was split.

Functionality Area: Event Status Management
