<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-09-13. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-43 - Event Coordinator approves or rejects a change request

| | |
|---|---|
| **Epic** | SCRUM-8 - Event Change & Notifications |
| **Priority** | High |
| **Story points** | 2 |
| **Status in Jira** | To Do |
| **Sprint** | Backlog |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-43 |

---

As an Event Coordinator, I want to approve or reject a change request, so that the Event Organiser knows the outcome.

Acceptance Criteria:

* Given a Coordinator approves a request, when the action is confirmed, then the event's actual details are updated to the new values and the request status changes to "Approved."
* Given a Coordinator rejects a request, when the action is confirmed, then the event's details remain unchanged and the request status changes to "Rejected."
* Given a rejection, when the Coordinator submits it, then a reason field is required (cannot submit blank).
* Given either outcome, when the decision is saved, then the Organiser's notification is triggered (verified via the notification stories).
