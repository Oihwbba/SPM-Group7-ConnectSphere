<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-21. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-210 - Menus grouped by task

| | |
|---|---|
| **Type** | Story |
| **Epic** | - |
| **Priority** | High |
| **Story points** | 1 |
| **Status in Jira** | To Do |
| **Sprint** | SCRUM Sprint 4 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-210 |

---

**User story:** As a staff user, I want the menu grouped by what I do, so that I find a page without trying each link.

**Acceptance criteria**

1. Each role's menu is grouped, for example a Coordinator sees My events, Venues (search, availability, catalogue), Equipment, All events and Notifications.
2. Links still come only from the permission table (SCRUM-66).
3. After sign-in each role lands on its main work list.
4. A user with several roles sees each group once (SCRUM-121).

**Customer basis:** Briefing, usability: "all user groups should manage common activities without extensive training."

**Why this is a new story:** the sidebar is one flat list per role (lib/nav.ts); a Coordinator has eight links in no grouping. Done stories are not reopened.

**Scope:** landing pages show the existing work lists, not new summary widgets: role-based dashboards are on the Week 4 not-required list.

**Change log**

* 2026-10-21: created at Sprint 3 review for Sprint 4 (UI revamp U4). Owner Caylern.

Functionality Area: User Authorisation and Authentication
