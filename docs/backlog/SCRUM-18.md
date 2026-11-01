<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-29. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-18 - Request clarification on an event under review

| | |
|---|---|
| **Type** | Story |
| **Epic** | SCRUM-6 - Event Request Lifecycle |
| **Priority** | Highest |
| **Story points** | 2 |
| **Status in Jira** | Done |
| **Sprint** | SCRUM Sprint 1 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-18 |

---

**As an Event Coordinator**, I want to request clarification or amendments from the Event Organiser, so that I can obtain missing information before deciding on the request.

**Acceptance Criteria:**

* Given a request is Under Review, when the Coordinator requests clarification, then the event remains **Under Review** and has an open clarification sub-state; no new event status is created.
* The Coordinator records exactly what information or amendment is required and selects the specific request-form fields the Organiser may change in the response; the selected fields and the request are visible to the Organiser. Selecting no fields means the response is text-only.
* While an open clarification exists, the Organiser can use the clarification-response edit path (**SCRUM-109**) but cannot make unrelated direct edits.
* Given the Organiser responds or amends the requested fields, when the response is saved, then the clarification is marked answered and the Coordinator can re-review the request.
* Given an open clarification already exists, when the Coordinator requests another clarification, then no second open clarification is created for the same event.
* The clarification request notification is owned by SCRUM-56.

**Business rule:** clarification is a sub-state of Under Review, not a tenth event status.

**References moved:** the clarification-response edit path in the third criterion is SCRUM-108, which SCRUM-109 was merged into. The notification in the last criterion is SCRUM-45 AC8; SCRUM-56 was dropped.

**Change log**

* 2026-10-29 (SCRUM-243, PO approval pending): added the References moved note for SCRUM-109 and SCRUM-56. Criteria unchanged.
