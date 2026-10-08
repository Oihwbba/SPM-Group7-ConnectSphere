<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-09. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-157 - Chore: Refresh the project docs so people and AI tools read one consistent, current guide

| | |
|---|---|
| **Type** | Task |
| **Epic** | - |
| **Priority** | Medium |
| **Story points** | 0 |
| **Status in Jira** | Done |
| **Sprint** | SCRUM Sprint 2 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-157 |

---

**Description:** A review of README.md, CONTRIBUTING.md, CLAUDE.md and the docs/ folder against the code found contradictions between them, stale facts and gaps. Teammates and AI tools (Claude Code, the GLM reviewer) follow these files, so a wrong line costs a CI or review round. This chore brings them in line with the repository as it is today. It changes documentation and repository settings only, and carries no story points.

**Acceptance criteria:**

1. CONTRIBUTING.md and CLAUDE.md agree on the branch name, commit message and pull request conventions, and both match what the team actually does.
2. Every file path, script and database rule the docs name exists and is described as it currently behaves.
3. No hand-written doc refers to a source that is not in the repository without a link to it. The course instructions, customer briefing and customer Q&A are linked from the shared Google Drive folder.
4. No section-sign (§) references remain in hand-written docs; each one is replaced by plain wording or a link.
5. A new docs/product-context.md gives the product view in one place: the problem, the five roles and what each may do, the twenty Release 1 features mapped to epics, what is out of scope, and the event lifecycle. It links to docs/backlog rather than copying acceptance criteria.
6. Authors see the checks the AI reviewer applies before they open a pull request, and the test naming convention is written down.
7. docs/adr has an index, and an ADR whose decision was later changed says so at the top.
8. Every team member is a code owner, so any teammate other than the author can approve a change to the files that control the checks (.github/, package.json, the test configs, vercel.json), instead of only Jin Hong. The docs say the same.
9. Out of scope: SCRUM-147's data-model criteria other than its first (data-model.md contradicted SCRUM-74 and the code on registration capacity, so that one fact is corrected here), and the § text inside generated docs/backlog files (SCRUM-45, 71, 124, 129, 132), which comes from Jira.

Related: SCRUM-114 (previous chore), SCRUM-116 (backlog sync), SCRUM-147 (data-model documentation).

PR #138: https://github.com/Oihwbba/SPM-Group7-ConnectSphere/pull/138
