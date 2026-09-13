<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-09-13. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-67 - Be prevented from performing an action my role does not permit

| | |
|---|---|
| **Epic** | SCRUM-9 - Access Control |
| **Priority** | Highest |
| **Story points** | 5 |
| **Status in Jira** | Done |
| **Sprint** | SCRUM Sprint 1 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-67 |

---

**As ConnectSphere**, I want every action to be checked against the caller's role at the point it is performed, so that a user cannot perform an action they were never offered.

**Acceptance Criteria:**

* Every state-changing operation validates the caller's role before executing
* A request for an action the role does not permit is refused and changes nothing
* The refusal is returned even when the request bypasses the user interface entirely
* The refusal message does not disclose the existence or contents of the resource
* Permission rules are defined in one place, not repeated at each call site

**Note:** the role here is the system rather than a human, which is a deliberate departure from the standard template. This is a security constraint that protects every other story in every other epic; expressing it as "As an Event Organiser I want to be blocked..." would be dishonest, since no user wants this for themselves. Flag it in the sprint review rather than hiding the exception.

**INVEST:** Independent (needs "Sign in to the system" only); Negotiable (where the check sits — middleware, decorator, service layer — is entirely open); Valuable (this is the security NFR; without it the role-based menu story is decoration); Estimable and Small (one enforcement point, one rule table); Testable (call each restricted operation directly as each wrong role, assert refusal and assert no state change).

Functionality Area: User Authorisation and Authentication
