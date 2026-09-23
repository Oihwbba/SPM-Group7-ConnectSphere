<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-09-23. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-108 - Edit a rejected event request before resubmission

| | |
|---|---|
| **Type** | Story |
| **Epic** | SCRUM-6 - Event Request Lifecycle |
| **Priority** | High |
| **Story points** | 2 |
| **Status in Jira** | To Do |
| **Sprint** | SCRUM Sprint 2 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-108 |

---

As an Event Organiser, I want to amend a rejected event request, so that I can correct the issues identified by the Coordinator and submit it again.

Acceptance Criteria:

* Given an event is Rejected, when the Organiser opens it, then an Amend and Resubmit action is available.
* The Organiser can edit the fields needed to address the rejection.
* The existing rejection reason remains visible while the Organiser is making amendments.
* Saving an amendment does not create a new event; the existing event and its history are retained.
* When the Organiser submits the amended request, the same submission validation rules used by SCRUM-14 apply.
* Given the amended request passes submission validation, then the event moves to Submitted and the normal review flow resumes.
* A rejected event that has not been amended remains Rejected.
* The request cannot be amended by an unrelated user.
* Repeated resubmission of the same already-submitted request is idempotent and does not create duplicate submissions or assignment/notification events.
* The amendment and resubmission are recorded by SCRUM-71.


Boundary: this story owns the rejected-state amendment/resubmission path. SCRUM-19 owns the rejection decision; SCRUM-14 owns the normal first-time submission validation/transition.
