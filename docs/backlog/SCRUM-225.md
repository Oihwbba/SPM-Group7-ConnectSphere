<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-26. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-225 - Chore: Skip the GLM review with a green check when the GLM quota is used up

| | |
|---|---|
| **Type** | Task |
| **Epic** | - |
| **Priority** | Medium |
| **Story points** | 0 |
| **Status in Jira** | In Review |
| **Sprint** | SCRUM Sprint 4 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-225 |

---

When the owner's GLM Coding Plan quota runs out, BigModel answers every review with HTTP 429, error code 1310 ("weekly/monthly usage limit reached, resets at …"). Today the GLM Code Review then turns red on every pull request, and stays red until the quota resets, even though the code was never looked at.

**Change:** when GLM refuses for quota (HTTP 429 with code 1310), the review is skipped: the PR comment says the review was skipped because the GLM quota is used up and when it resets, and the check passes. `build-and-test` remains the gate. Any other failure (timeout, cut-off answer, other HTTP error) still fails the check as before.

**Done when:**

- a quota refusal posts a "review skipped" comment and exits green, without a second attempt;
- other failures still post "did not complete" and fail;
- unit tests cover both;
- `ai-review.yml`, `CONTRIBUTING.md`, `CLAUDE.md` and an ADR 0008 addendum say so.
