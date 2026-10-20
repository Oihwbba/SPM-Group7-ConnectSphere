<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-20. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-199 - Chore: Bring the component diagram up to date with main

| | |
|---|---|
| **Type** | Task |
| **Epic** | - |
| **Priority** | Low |
| **Story points** | - |
| **Status in Jira** | To Do |
| **Sprint** | Backlog |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-199 |

---

`docs/design/diagrams/c4-3-components.svg` still draws Coordinator assignment, the safety check and arrangement flags as planned, and notifications and change requests as in review, although all are on `main`. SCRUM-175 AC3 says a built diagram must match `main`. Found by the rubric audit on 2026-10-19.

**Acceptance criteria**

1. Every component's status in the diagram matches `main`, checked against the code; a component still in an open pull request names it.
2. `docs/design/README.md` records the date it was last checked against the code.
3. The state diagrams marked Target are checked against `main`; each difference is fixed or noted next to the diagram.
4. The diagram test (SCRUM-175 AC5) still passes.

**Change log**

* 2026-10-19: created from the rubric audit (Felicia).
