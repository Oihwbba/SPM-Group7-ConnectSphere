<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-09-30. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-81 - Move an approved event through planning to confirmed

| | |
|---|---|
| **Type** | Story |
| **Epic** | SCRUM-6 - Event Request Lifecycle |
| **Priority** | Highest |
| **Story points** | 5 |
| **Status in Jira** | To Do |
| **Sprint** | SCRUM Sprint 2 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-81 |

---

**As an Event Coordinator**, I want to confirm an event once all its essential arrangements are approved, so that the Organiser knows the event will go ahead and Attendees can register.

**Acceptance Criteria**

* Given I approve an event request, when the approval is saved, then the event shows as **Planning**. The approval (who, when) is recorded in its history.
* Given an event in Planning whose readiness checklist (SCRUM-110) is complete, when I view it, then a **Confirm event** action is available.
* Given the checklist is not complete, when I view the event, then Confirm is unavailable and the outstanding items are listed. A direct confirm request is refused and the status doesn't change.
* Given I confirm a ready event, then its status becomes **Confirmed** and the confirming Coordinator and time are recorded.
* Given the event is Confirmed, when its Organiser opens it, then they see the confirmed venue, date/time and reserved equipment.
* Only the event's assigned Coordinator can confirm it; any other user is refused with no status change.
* Given the event is already Confirmed, when Confirm is submitted again, then nothing changes and no second confirmation is recorded.
