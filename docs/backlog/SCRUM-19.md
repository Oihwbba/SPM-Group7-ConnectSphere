<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-09-13. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-19 - Approve or reject an event request

| | |
|---|---|
| **Epic** | SCRUM-6 - Event Request Lifecycle |
| **Priority** | Highest |
| **Story points** | 2 |
| **Status in Jira** | To Do |
| **Sprint** | SCRUM Sprint 1 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-19 |

---

**As an Event Coordinator**, I want to approve or reject a submitted event request, so that the Organiser knows whether their event can proceed.

**Acceptance Criteria:**

* Given a submitted (or clarified) request, when the Coordinator approves it, then its status changes to "approved" and the Organiser can see this outcome
* Approval means the Coordinator judges there is **sufficient information to begin planning** — it is not a guarantee that arrangements exist yet (see SCRUM-81)
* Given a submitted request, when the Coordinator rejects it, then its status changes to "rejected", a reason is recorded, and the Organiser can see both the rejection and the reason
* The rejection reason is a **free-text field** and cannot be left blank
* The decision and reason (if rejected) are visible to the Organiser without needing to ask the Coordinator directly
* **Given a rejected request, when the Organiser amends it and resubmits, then it returns to "submitted" and can be reviewed again** — rejection is not necessarily final
* Rejected requests are retained and remain viewable by the users who took part in that event's workflow; they are never deleted

**Customer clarification (2026-09-13):**

* _"Rejected events may be resubmitted after appropriate changes are made; rejection is not necessarily final."_ — this **changes** the story: it previously treated rejection as a terminal state. The resubmission criterion and the new `rejected → submitted` transition in SCRUM-24 follow from it.
* _"Approval = sufficient info for planning."_
* _"Free text reason is reasonable."_
* _"Event Status Management retains rejected requests. Authorised users participated in the event workflow can view."_

**INVEST:** Independent (builds on "Review a submitted event request" but is a distinct action); Negotiable (whether a resubmission restarts review from scratch or resumes with the same Coordinator is worth confirming); Valuable (this is the actual gate the briefing describes — nothing proceeds without it); Estimable/Small (two outcomes, one decision point, one re-entry path); Testable (status and visible outcome match the decision made; a rejected request can be amended and resubmitted).

Functionality Area: Event Review and Approval
