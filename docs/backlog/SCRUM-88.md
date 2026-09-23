<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-09-23. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-88 - Add GLM-5.3 automated code review to pull requests (GitHub Actions)

| | |
|---|---|
| **Type** | Task |
| **Epic** | - |
| **Priority** | Medium |
| **Story points** | - |
| **Status in Jira** | Done |
| **Sprint** | SCRUM Sprint 1 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-88 |

---

Adds an automated GLM-5.3 code review to every pull request (GitHub Actions) and makes it a required merge check.

Delivered (all merged, CI green):

* #13, #14: first advisory review (OpenCodeReview), failing softly
* #15: one reviewer, one call for the whole PR, replacing the Copilot review
* #16: redeployed main after Vercel missed a deploy
* #19: one long review comment in the Conversation tab
* #20: reviews against CONTRIBUTING.md, CLAUDE.md and the story's acceptance criteria
* #22: required merge gate, CI (including e2e) plus a completed GLM review with no critical findings; reviews run at high thinking with one retry, so they finish in 1–3 minutes instead of 10–15 (with SCRUM-89)
* #23: teammates may merge their own PR once both checks pass
* #25: checks unit, integration and e2e coverage and UI states
* #34, #35: reviewer memory (team-approved lessons, earlier PR discussion) and prompt hardening
* #36: an oversized diff fails the check instead of being partly reviewed


Decision record: docs/adr/0008-advisory-ai-code-review.md

Unplanned technical task, added to Sprint 1 on 2026-09-16. No story points, so velocity counts only user stories.
