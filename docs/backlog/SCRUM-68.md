<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-09-13. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-68 - View only the events I own

| | |
|---|---|
| **Epic** | SCRUM-9 - Access Control |
| **Priority** | Highest |
| **Story points** | 3 |
| **Status in Jira** | In Review |
| **Sprint** | SCRUM Sprint 1 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-68 |

---

**As an Event Organiser**, I want to see only the events I submitted, so that my event details are not visible to other clients of ConnectSphere.

**Acceptance Criteria:**

* An Organiser's event list contains only events where they are the submitting Organiser
* Opening another Organiser's event directly by its identifier is refused
* The refusal is indistinguishable from the event not existing
* Drafts are visible only to the Organiser who created them

**Note:** who the assigned coordinator is, and their contact details, is already owned by "See which coordinator is assigned to my event" (SCRUM-22) — this story does not restate it, to avoid two stories independently defining the same display. **Update 2026-09-06:** removed the coordinator-visibility bullet that previously duplicated that story, found during the full backlog synthesis.

**INVEST:** Independent (needs "Sign in to the system"; does not need the review or approval flow to exist); Negotiable (whether an organising _organisation_ has multiple people who share visibility is an open customer question); Valuable (ConnectSphere's clients are competing organisations — cross-client leakage is the single worst failure this system could have); Estimable and Small (one ownership filter); Testable (as Organiser A, request Organiser B's event by identifier, assert refusal).

Functionality Area: User Authorisation and Authentication
