<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-09-30. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-109 - Respond to an event clarification request

| | |
|---|---|
| **Type** | Story |
| **Epic** | SCRUM-6 - Event Request Lifecycle |
| **Priority** | High |
| **Story points** | 2 |
| **Status in Jira** | To Do |
| **Sprint** | SCRUM Sprint 2 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-109 |

---

As an Event Organiser, I want to respond to an open clarification request, so that the Coordinator receives the missing information needed to continue reviewing my event.

Acceptance Criteria:

* Given an event is Under Review with an open clarification, the Organiser can open the clarification and see what information is required.
* The Organiser can amend only the fields requested by the clarification and provide a response.
* Saving the response marks the clarification as answered and keeps the event in Under Review.
* The Coordinator can see the response and resume review.
* The Organiser cannot use this path to make unrelated event changes.
* A clarification response does not create a new event or a new event status.
* The response records who answered and when.
* A clarification response is idempotent: retrying the same completed response does not create a second open/answered clarification or duplicate notification.
* The response is recorded by SCRUM-71.

Boundary: this story owns the edit/response mechanism while clarification is open. SCRUM-18 owns requesting clarification and SCRUM-56 owns the request notification.
