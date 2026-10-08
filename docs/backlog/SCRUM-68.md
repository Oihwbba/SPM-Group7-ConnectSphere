<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-09. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-68 - View only the events I own

| | |
|---|---|
| **Type** | Story |
| **Epic** | SCRUM-9 - Access Control |
| **Priority** | Highest |
| **Story points** | 3 |
| **Status in Jira** | Done |
| **Sprint** | SCRUM Sprint 1 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-68 |

---

**As an Event Organiser**, I want to see only the events I submitted, so that my event details are not visible to other clients of ConnectSphere.

**Acceptance Criteria:**

* An Organiser's event list contains only events where they are the submitting Organiser.
* Opening another Organiser's event directly by its identifier is refused.
* The refusal is indistinguishable from the event not existing.
* Drafts are visible only to the Organiser who created them.
* Release 1 uses the individual Organiser account as the ownership boundary; shared visibility across multiple people in the same external organisation is not supported by this story.

**Boundary:** Coordinator visibility and assignment relationships are owned centrally by SCRUM-69 and SCRUM-20; this story does not restate them.

Functionality Area: User Authorisation and Authentication
