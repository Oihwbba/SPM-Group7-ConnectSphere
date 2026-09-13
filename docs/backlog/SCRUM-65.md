<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-09-13. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-65 - Sign in to the system

| | |
|---|---|
| **Epic** | SCRUM-9 - Access Control |
| **Priority** | Highest |
| **Story points** | 2 |
| **Status in Jira** | Done |
| **Sprint** | SCRUM Sprint 1 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-65 |

---

**As a registered ConnectSphere user**, I want to sign in with my own credentials, so that I can reach the parts of the system that apply to me and no one else can act as me.

**Acceptance Criteria:**

* Valid credentials sign the user in and start a session
* Invalid credentials are rejected with a message that does not reveal whether the account exists
* The signed-in user's role is loaded with the session and available to every subsequent request
* A user can sign out, which ends the session immediately
* A request made after sign-out is treated as unauthenticated

**Note:** sign-out is clubbed into this story deliberately. Alone it has no functional value — there is nothing to sign out of until sign-in exists — and Week 2's "Small" criterion warns that stories too small to deliver value should be combined rather than split for their own sake. Account creation is deliberately excluded: whether Attendees self-register or are invited is an open customer question.

**INVEST:** Independent (nothing else needs to exist first — this is the root of the epic); Negotiable (credential rules, session length, and lockout policy are all open); Valuable (no other story in any epic can enforce anything without it); Estimable and Small (one entity, one session mechanism); Testable (each AC is a checkable condition).

Functionality Area: User Authorisation and Authentication
