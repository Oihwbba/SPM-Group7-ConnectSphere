<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-29. Jira is the source of truth.
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

**Superseded in part:** AC1 no longer leaves the event Approved: approving moves it to Planning in the same action, and Approved is kept in its history (SCRUM-81 AC1, SCRUM-135 AC3 and AC12). AC3's rejection also records an outcome, and AC4's amend and resubmit is offered only when the Coordinator chose Amend and resubmit (SCRUM-126 AC1 to AC3, SCRUM-108 AC7 and AC8). Only the event's assigned Coordinator approves or rejects it; a Submitted request with no Coordinator waits for the Lead and can't be decided (SCRUM-165 AC8, SCRUM-135 AC3 and AC4). The criteria below are kept as accepted in Sprint 1.

**As an Event Coordinator**, I want to approve or reject an event request, so that the Organiser knows whether the request can proceed.

**Acceptance Criteria:**

* Given a request is Under Review, when the Coordinator approves it, then its status changes to **Approved**.
* Approval means there is sufficient information to begin planning; it does not mean arrangements are already secured.
* Given a request is Under Review, when the Coordinator rejects it, then its status changes to **Rejected** and a non-blank free-text reason is recorded and visible to the Organiser.
* Given a Rejected request, when the Organiser amends it through **SCRUM-108** and resubmits, then the event returns to **Submitted** and can enter review again.
* Rejected requests are retained and are not deleted.
* Status ownership follows SCRUM-24; notifications follow the notification ownership model rather than being duplicated here.

**Dependency:** SCRUM-108 owns the rejected-event amendment and resubmission path.

**Change log**

* 2026-10-29 (SCRUM-243, PO approval pending): added the Superseded in part note for SCRUM-81, SCRUM-126, SCRUM-135 and SCRUM-165. Criteria unchanged.
