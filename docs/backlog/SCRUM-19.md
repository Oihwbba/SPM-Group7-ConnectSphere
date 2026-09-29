<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-09-30. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-19 - Approve or reject an event request

| | |
|---|---|
| **Type** | Story |
| **Epic** | SCRUM-6 - Event Request Lifecycle |
| **Priority** | Highest |
| **Story points** | 2 |
| **Status in Jira** | Done |
| **Sprint** | SCRUM Sprint 1 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-19 |

---

As an Event Coordinator, I want to approve or reject an event request, so that the Organiser knows whether the request can proceed.

Acceptance Criteria:

* Given a request is Under Review, when the Coordinator approves it, then its status changes to Approved.
* Approval means there is sufficient information to begin planning; it does not mean arrangements are already secured.
* Given a request is Under Review, when the Coordinator rejects it, then its status changes to Rejected and a non-blank free-text reason is recorded and visible to the Organiser.
* Given a Rejected request, when the Organiser amends it through SCRUM-108 and resubmits, then the event returns to Submitted and can enter review again.
* Rejected requests are retained and are not deleted.
* Status ownership follows SCRUM-24; notifications follow the notification ownership model rather than being duplicated here.


Dependency: SCRUM-108 owns the rejected-event amendment and resubmission path.
