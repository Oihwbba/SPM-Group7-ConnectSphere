<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-09-21. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-83 - Mark a confirmed event completed once it has passed

| | |
|---|---|
| **Epic** | SCRUM-6 - Event Request Lifecycle |
| **Priority** | Low |
| **Story points** | 2 |
| **Status in Jira** | To Do|
| **Sprint** | Backlog |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-83 |

---

**As ConnectSphere**, I want a confirmed event to move to "completed" once its event end instant has passed, so that past events are recorded accurately and are distinguishable from ones still upcoming.

**Acceptance Criteria:**

- Given a Confirmed event whose end instant has passed, when the system next checks, then its status changes to **Completed**.
- The event's start/end date and time are interpreted in the event timezone defined by SCRUM-13; persisted comparisons use the corresponding UTC instant.
- Given the current time is exactly the event's end instant, when the system checks, then the event is NOT yet completed — completion occurs only after that instant.
- Given an event that has already been marked Completed, when the system checks again, then its status does not change and no duplicate completion notification is sent.
- An event that was Cancelled before its completion instant is never marked Completed.
- A completed event's other recorded details (venue, equipment, registrations) remain visible unchanged.

**Boundary:** the stated event end time is the completion boundary; timezone interpretation is centralized in SCRUM-13.

Functionality Area: Event Status Management
