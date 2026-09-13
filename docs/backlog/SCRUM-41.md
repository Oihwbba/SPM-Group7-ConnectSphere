<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-09-13. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-41 - Event Organiser submits a change request for a submitted event

| | |
|---|---|
| **Epic** | SCRUM-8 - Event Change & Notifications |
| **Priority** | High |
| **Story points** | 2 |
| **Status in Jira** | To Do |
| **Sprint** | Backlog |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-41 |

---

As an Event Organiser, I want to submit a change request for an event that has already been submitted, so that I can update details that have changed since submission.

Acceptance Criteria:

* Given an event with status "Submitted" or later, when the Organiser opens it, then a "Request Change" option is visible.
* Given a Draft event, when the Organiser looks for this option, then it is NOT visible.
* Given the Organiser selects field(s) to change and submits, then a new change request record is created with status "Pending Review."
* Given a change request is submitted, when the Organiser views the event, then they can see the request's current status.
