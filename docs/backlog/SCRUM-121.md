<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-07. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-121 - Accounts can hold multiple roles

| | |
|---|---|
| **Type** | Story |
| **Epic** | SCRUM-9 - Access Control |
| **Priority** | High |
| **Story points** | 3 |
| **Status in Jira** | To Do |
| **Sprint** | Backlog |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-121 |

---

**User story:** As a ConnectSphere user with more than one role, I want the permissions of all my roles in one account, so that I don't need separate logins.

**Acceptance criteria**

1. An account can hold more than one role.
2. My permissions are the union of my roles' permissions, and the navigation shows the union.
3. Relationship checks still apply per event: for example, being a Coordinator doesn't let me edit an event I'm not assigned to.
4. The Lead can't assign (SCRUM-165) or reassign (SCRUM-21) an event to a Coordinator who is that event's Organiser.
5. I can't decide a venue booking, review or reserve equipment, or record a safety check outcome (SCRUM-166) for an event I organise or coordinate; the action is refused (SCRUM-67).

**Supersedes:** the single-role wording in SCRUM-65 ("the signed-in user's role") and SCRUM-66 ("their role"), both Sprint 1 and Done.

**Customer basis:** "Multiple roles possible. Coordinator can view other events for planning purpose but should not be able to edit events not assigned to them."

**Change log**

* 2026-10-01: added AC4 and AC5 so multiple roles can't be used to approve your own work; stated which Sprint 1 wording this supersedes.
* 2026-10-01 (audit): AC5 names the equipment actions as built: Technical Support reviews a request (SCRUM-28) and reserves stock (SCRUM-31); there is no per-item decision.
* 2026-10-07 (Week 7 changes 5 and 6): AC4 applies to the Lead's assignment and reassignment (SCRUM-165, SCRUM-21) instead of automatic assignment and handover. AC5 adds a Safety Officer's outcome (SCRUM-166).

Functionality Area: User Authorisation and Authentication
