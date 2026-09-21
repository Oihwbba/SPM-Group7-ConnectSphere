<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-09-21. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-14 - Submit an event request for review

| | |
|---|---|
| **Epic** | SCRUM-6 - Event Request Lifecycle |
| **Priority** | Highest |
| **Story points** | 1 |
| **Status in Jira** | In Review|
| **Sprint** | SCRUM Sprint 1 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-14 |

---

**As an Event Organiser**, I want to submit my completed event request, so that an Event Coordinator can begin reviewing it.

**Acceptance Criteria:**

- Given all required fields are filled, when the Organiser submits, then the request's status changes to "submitted" and it becomes visible to Event Coordinators
- Given required fields are missing, when the Organiser tries to submit, then submission is blocked and the missing fields are indicated
- Given a request has already been submitted, when the Organiser submits it again, then no second request is created, the status stays "submitted", and no additional notification is sent to Coordinators
- Once submitted, the request can no longer be edited as a draft (see "Update routine event information during planning" for authorised edits after submission)

**Note (2026-09-07):** the repeat-submission criterion was added following the Week 2 assignment feedback, which asked what happens when an action that creates a record is performed a second time. It matters here because a double submission could otherwise create a duplicate request or a duplicate Coordinator notification.

**INVEST:** Independent (only needs "Create an event request" to exist, not the review flow); Negotiable (validation rules can be refined with the team); Valuable (nothing reaches a Coordinator without this); Estimable/Small (one state transition); Testable (all three branches of the Given/When/Then are checkable).

‌

Functionality Area: Event Request Creation
