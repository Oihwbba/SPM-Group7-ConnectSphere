<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-09-21. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-71 - Record who changed what and when

| | |
|---|---|
| **Type** | Story |
| **Epic** | SCRUM-9 - Access Control |
| **Priority** | Low |
| **Story points** | 3 |
| **Status in Jira** | To Do |
| **Sprint** | Backlog |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-71 |

---

**As an Event Coordinator**, I want to see who made each significant change to an event and when, so that I can understand how an event reached its current state and resolve disputes about what was agreed.

**Acceptance Criteria:**

* Every status change, approval, rejection, assignment, booking decision, rejected-request amendment/resubmission, clarification request/response, formal change-request decision, resource-reconsideration resolution, registration-capacity-affecting registration action, and other significant event mutation records the acting user or system actor, the action, and a timestamp.
* The record is written as part of the action, so an action cannot succeed without its audit entry.
* The history for an event is visible only to users who may already view that event, under the same resource-access rules defined by SCRUM-66/67.
* Recorded entries cannot be edited or deleted through the application.
* The history shows the previous and new value for the fields the briefing calls important — date, time, expected attendance, venue and equipment requirements.
* Event-time timestamps are displayed consistently, with the event timezone used for human-readable event details while persisted audit timestamps remain unambiguous.

Functionality Area: User Authorisation and Authentication (non-functional: auditability)
