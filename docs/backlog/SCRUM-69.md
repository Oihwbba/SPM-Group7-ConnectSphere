<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-09-25. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-69 - View only the events assigned to me

| | |
|---|---|
| **Type** | Story |
| **Epic** | SCRUM-9 - Access Control |
| **Priority** | High |
| **Story points** | 2 |
| **Status in Jira** | To Do |
| **Sprint** | SCRUM Sprint 2 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-69 |

---

**As an Event Coordinator**, I want my event list to show the events assigned to me, so that I can work from an accurate list of my responsibilities.

**Acceptance Criteria:**

* A Coordinator's default event list contains only events where they are the assigned Coordinator.
* Reassigning an event to another Coordinator removes it from the previous Coordinator's list and adds it to the new one's.
* An event that is still Submitted and has no Coordinator is handled by the automatic assignment/retry mechanism in SCRUM-20; it is **not** manually claimed from the Coordinator's event list.
* Release 1 does not provide general colleague-event browsing through this story. Access to another Coordinator's event is governed by the resource relationship and central authorization model in SCRUM-66/67.

**Boundary:** SCRUM-20 owns automatic assignment and recovery; this story owns the assigned-Coordinator list view.

Functionality Area: User Authorisation and Authentication
