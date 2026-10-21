<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-21. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-207 - Shared page conventions on every page

| | |
|---|---|
| **Type** | Story |
| **Epic** | - |
| **Priority** | High |
| **Story points** | 2 |
| **Status in Jira** | To Do |
| **Sprint** | SCRUM Sprint 4 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-207 |

---

**User story:** As any user, I want every page to look and behave the same way, so that what I learn on one page works on the next.

**Acceptance criteria**

1. Every page has one title, a one-line description of what it is for, and a back link when it isn't a menu page.
2. Statuses use the same badge, colours and names everywhere (SCRUM-131).
3. Every list has an empty state that says why it's empty and what to do next.
4. Success and error messages appear in the same place on every page, and an error says what to do next.
5. Every action that can't be undone asks for confirmation in the same dialog.

**Customer basis:** Briefing, usability: "all user groups should manage common activities without extensive training"; design: "current status, confirmed arrangements, and outstanding actions should be easy for the relevant user to understand."

**Why this is a new story:** the pages were built story by story, so their layout and messages differ. Done stories are not reopened; this story changes the pages they built.

**Related:** first of the UI revamp stories; the others reuse these conventions. Every pull request updates the e2e specs that click through the pages it changes.

**Change log**

* 2026-10-21: created at Sprint 3 review for Sprint 4 (UI revamp U1). Owner Caylern.

Functionality Area: Usability (all features)
