<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-28. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-237 - Chore: Say on the website and in the README that it is the team's development environment, not a service for customers

| | |
|---|---|
| **Type** | Task |
| **Epic** | - |
| **Priority** | Medium |
| **Story points** | 0 |
| **Status in Jira** | In Progress |
| **Sprint** | SCRUM Sprint 4 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-237 |

---

The deployed ConnectSphere site is where the team builds, tests and coordinates the project. Nothing on it says so, so a customer who finds it could take it for a live service, or ask why it holds test accounts and demo events.

**Acceptance criteria**

1. The sign-in page, and every signed-in page, says the site is the ConnectSphere team's development environment, used to build and coordinate the project, and that it isn't a service for customers.
2. The notice fits at phone width without covering the page's controls, and uses the theme's colours.
3. `README.md` and `docs/product-context.md` say the same.
4. Unit and e2e tests cover the notice on the sign-in page and on a signed-in page.
