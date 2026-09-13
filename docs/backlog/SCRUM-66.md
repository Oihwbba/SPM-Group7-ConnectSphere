<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-09-13. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-66 - See only the functions my role allows

| | |
|---|---|
| **Epic** | SCRUM-9 - Access Control |
| **Priority** | Highest |
| **Story points** | 3 |
| **Status in Jira** | In Review |
| **Sprint** | SCRUM Sprint 1 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-66 |

---

**As a signed-in user**, I want to be shown only the actions my role can actually perform, so that I am not presented with options that will fail or that belong to someone else's job.

**Acceptance Criteria:**

* Navigation and on-screen actions are derived from the signed-in user's role, not hardcoded per screen
* An Event Organiser is not shown venue approval, equipment reservation, or coordinator assignment actions
* A Venue Staff member is not shown event approval or equipment reservation actions
* A Technical Support Staff member is not shown venue booking approval or event approval actions
* An Attendee is shown only event browsing and their own registrations
* Adding a new role, or changing what a role may do, does not require editing individual screens

**Note:** this story is about what the user is _shown_. Preventing a forbidden action from succeeding is a separate story ("Be prevented from performing an action my role does not permit") — hiding a button is not a security control, and the split is deliberate.

**INVEST:** Independent (depends only on "Sign in to the system"); Negotiable (exact per-role menu contents will move as other epics are built); Valuable (usability NFR — "usable without extensive training" — a screen full of actions that error is the opposite); Estimable and Small (one permission lookup, applied at render); Testable (sign in as each of the five roles, assert the visible action set).

Functionality Area: User Authorisation and Authentication
