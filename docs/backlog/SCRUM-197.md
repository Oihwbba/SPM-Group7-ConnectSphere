<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-28. Jira is the source of truth.
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

The Week 10 CFO update adds a question this document should answer: what value the team added beyond what AI-assisted coding tools could produce alone, to be shown in the slide deck.

**Acceptance criteria**

1. `docs/ai-usage.md` states which tools are used for what (coding assistant, GLM review), the rules they work under (CLAUDE.md, the review instructions), what a person always decides or checks, and evidence of AI output being corrected (the GLM reviewer's memory, review findings answered on PRs).
2. Its figures (commits with the trailer, commits authored as Claude) come from git, with the command that produced them.
3. `docs/ownership.md` maps each area of the code, each ADR and each epic to the team member who explains it in the Q&A, from Jira assignees and git history; the team confirms or corrects every row.
4. README.md points to both.
5. `docs/ai-usage.md` has a section, "Value the team added beyond AI", answering the Week 10 CFO question for the first release of the Event Planning and Venue Booking System.
6. Each example states what an AI tool produced or could have produced, what the team added on top, and links its evidence (a Jira change log, PR, review comment, ADR, test or CI run). The examples go beyond producing code: understanding the customer, decisions and trade-offs, conflicts between stories (for example SCRUM-188), checking AI output, and how the team delivered.
7. At least one example is demonstrated in the slide deck or the demo (SCRUM-198), and the section's content is handed to SCRUM-219.

**Customer basis:** Week 10 CFO update: "If AI can generate so much of the code, what value are our software development teams adding beyond simply asking AI to build the system?" The team is asked to "explain and demonstrate how the team has added value on top of what could reasonably be produced by AI-assisted coding tools alone" in the slide deck.

**Change log**

* 2026-10-19: created from the rubric audit (Felicia).
* 2026-10-23: AC5 to AC7 added for the Week 10 CFO update (Felicia), following its wording: explain and demonstrate, set against what AI tools could produce alone, beyond producing code, for the first release of the Event Planning and Venue Booking System. SCRUM-223, created for it the same day, was merged into this chore so there is one document about AI.
