<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-28. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-225 - Chore: Skip the GLM review with a green check when GLM's quota or rate limit stops it

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

When the owner's GLM Coding Plan quota runs out, BigModel answers every review with HTTP 429, error code 1310 ("weekly/monthly usage limit reached, resets at …"). Today the GLM Code Review then turns red on every pull request, and stays red until the quota resets, even though the code was never looked at. On 26 Oct, with credit back, a dozen PRs updated at once also hit GLM's rate limit (HTTP 429, code 1302); the retry came a second later and failed the same way, so those went red too.

**Change:** when GLM refuses for quota (code 1310), the review is skipped: the PR comment says the review was skipped because the GLM quota is used up and when it resets, and the check passes. On the rate limit (code 1302) the call is tried again after a few growing, randomised waits; if GLM still refuses, the review is skipped and passes the same way. `build-and-test` remains the gate. Any other failure (timeout, cut-off answer, other HTTP error) still fails the check as before.

**Done when:**

* a quota refusal posts a "review skipped" comment and exits green, without a second attempt;
* a rate-limit refusal is waited out and retried, within the time budget, and skipped green if it never clears;
* other failures still post "did not complete" and fail;
* unit tests cover each;
* `ai-review.yml`, `CONTRIBUTING.md`, `CLAUDE.md` and an ADR 0008 addendum say so.
