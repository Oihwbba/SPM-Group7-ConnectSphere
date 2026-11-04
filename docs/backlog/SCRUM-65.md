<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-11-04. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-65 - Sign in to the system

| | |
|---|---|
| **Type** | Story |
| **Epic** | SCRUM-9 - Access Control |
| **Priority** | Highest |
| **Story points** | 2 |
| **Status in Jira** | Done |
| **Sprint** | SCRUM Sprint 1 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-65 |

---

**Superseded in part** (the criteria below are kept as accepted in Sprint 1):

* **"The signed-in user's role", superseded by SCRUM-121 AC1 and AC2:** an account can hold more than one role, and its permissions are the union of its roles' permissions.
* **The five roles, superseded by SCRUM-164 AC1:** Event Coordinator Lead and Safety Officer accounts also sign in, and land on their role's home page.

**As a registered ConnectSphere user**, I want to sign in with my own credentials, so that I can reach the parts of the system that apply to me and no one else can act as me.

**Acceptance Criteria:**

* Valid credentials sign the user in and start a session.
* Invalid credentials are rejected with a message that does not reveal whether the account exists.
* The signed-in user's role is loaded with the session and available to every subsequent request.
* A user can sign out, which ends the session immediately.
* A request made after sign-out is treated as unauthenticated.

**Release-1 boundary:** user accounts are provisioned outside ConnectSphere. Self-service account creation, invitation and account-recovery flows are outside Release 1 and are not required by the current core feature set.

**Change log**

* 2026-11-04 (SCRUM-260, PO approved 2026-11-04): added the Superseded in part note for SCRUM-121 and SCRUM-164, whose Supersedes lines already name this story. Criteria unchanged.

Functionality Area: User Authorisation and Authentication
