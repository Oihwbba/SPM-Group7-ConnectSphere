<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-15. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-180 - Chore: Raise the GLM reviewer's memory limit from 8,000 to 12,000 characters

| | |
|---|---|
| **Type** | Task |
| **Epic** | - |
| **Priority** | Medium |
| **Story points** | - |
| **Status in Jira** | Done |
| **Sprint** | SCRUM Sprint 3 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-180 |

---

The GLM reviewer reads at most 8,000 characters of `.github/ai-review/memory.md`, and the memory bot (SCRUM-112) keeps the file under that limit. The file is at 7,917 of those 8,000 characters on `main`, so a new lesson fits only if older ones are cut. #166, for example, removes one lesson while extending another. A larger limit keeps more lessons, at a cost of about 1,000 more tokens in a review prompt that already uses 95,000 to 168,000.

**Acceptance criteria**

1. The reviewer reads up to 12,000 characters of the memory file.
2. The memory bot keeps the file under 12,000 characters, and refuses a proposed file that is longer, naming the new limit.
3. CI's memory-length check (SCRUM-152) uses the same limit, so the bot, the reviewer and CI can't drift apart.
4. ADR 0008 records the change.
5. The other budgets (changed files, related files, the conversation) don't change.

Asked for by Jin Hong on 2026-10-13.
