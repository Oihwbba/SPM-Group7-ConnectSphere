<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-21. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-197 - Chore: Document how the team uses AI and who owns each part of the system

| | |
|---|---|
| **Type** | Task |
| **Epic** | - |
| **Priority** | High |
| **Story points** | - |
| **Status in Jira** | To Do |
| **Sprint** | SCRUM Sprint 4 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-197 |

---

Almost every commit carries a `Co-Authored-By: Claude` trailer, and 33 are authored as "Claude". The module requires us to be transparent about AI assistance, and the Q&A asks each of us to explain and justify the code, architecture and AI contributions. Nothing in the repo says how AI is used, what people decide and check, or who explains which part. Found by the rubric audit on 2026-10-19.

**Acceptance criteria**

1. `docs/ai-usage.md` states which tools are used for what (coding assistant, GLM review), the rules they work under (CLAUDE.md, the review instructions), what a person always decides or checks, and evidence of AI output being corrected (the GLM reviewer's memory, review findings answered on PRs).
2. Its figures (commits with the trailer, commits authored as Claude) come from git, with the command that produced them.
3. `docs/ownership.md` maps each area of the code, each ADR and each epic to the team member who explains it in the Q&A, from Jira assignees and git history; the team confirms or corrects every row.
4. README.md points to both.

**Change log**

* 2026-10-19: created from the rubric audit (Felicia).
