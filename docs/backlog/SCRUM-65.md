<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-09-30. Jira is the source of truth.
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

As a registered ConnectSphere user, I want to sign in with my own credentials, so that I can reach the parts of the system that apply to me and no one else can act as me.

Acceptance Criteria:

* Valid credentials sign the user in and start a session.
* Invalid credentials are rejected with a message that does not reveal whether the account exists.
* The signed-in user's role is loaded with the session and available to every subsequent request.
* A user can sign out, which ends the session immediately.
* A request made after sign-out is treated as unauthenticated.


Release-1 boundary: user accounts are provisioned outside ConnectSphere. Self-service account creation, invitation and account-recovery flows are outside Release 1 and are not required by the current core feature set.

Functionality Area: User Authorisation and Authentication


## Subtasks

| Subtask | Summary | Status |
|---|---|---|
| [SCRUM-90](SCRUM-90.md) | Configure Auth.js — credentials provider, JWT sessions | Done |
| [SCRUM-91](SCRUM-91.md) | Carry user id and role onto the session | Done |
| [SCRUM-92](SCRUM-92.md) | Build sign-in page and sign-out action | Done |
| [SCRUM-93](SCRUM-93.md) | Seed accounts across all five roles (idempotent) | Done |
| [SCRUM-94](SCRUM-94.md) | Tests — unit (auth actions) and e2e (login, failed-login parity, sign-out) | Done |
