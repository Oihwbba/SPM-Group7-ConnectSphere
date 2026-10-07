<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-08. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-112 - The GLM reviewer maintains its own memory instead of being taught by hand

| | |
|---|---|
| **Type** | Task |
| **Epic** | - |
| **Priority** | Medium |
| **Story points** | - |
| **Status in Jira** | Done |
| **Sprint** | Backlog |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-112 |

---

The reviewer reads .github/ai-review/memory.md on every pull request, and everything in it was written there by hand after someone noticed a lesson. That is where the reviewer's repeated mistakes come from: it re-reports what the team already knows is deliberate, and it misses facts nobody got round to writing down. The seed-with-two-coordinators lesson, for instance, only landed after CI had already broken on it twice.

A merged pull request is the moment the lesson exists: the review has been written, CI has passed or failed and been fixed, and a human has accepted the result.

Scope

* A job runs when a pull request merges and asks GLM whether that pull request taught the reviewer anything: the current memory, the pull request's title and description, the review it received, and whether CI failed on the way.
* It returns the complete revised memory, not an append, so stale lessons are deleted rather than accumulating.
* If it changed, the job opens a pull request against .github/ai-review/memory.md. It never writes to main, so a human still reads every lesson before it can influence a review, and CODEOWNERS already requires Jin Hong's approval under .github/.
* The 8,000-character budget is enforced in code, not asked for in the prompt, along with guards against the model wiping or gutting the file.

Acceptance criteria

1. Merging a pull request triggers exactly one memory job, and a pull request that teaches nothing produces no pull request.
2. A proposed memory is rejected, with the reason logged, if it exceeds 8,000 characters, loses the file's heading or rules block, or drops below a floor proportional to the current file.
3. The memory pull request names the pull request it learned from and states the lesson in one line.
4. Successive memory proposals reuse one branch and one open pull request instead of piling up.
5. Merging the memory pull request does not trigger another memory job.
6. The job is skipped, not failed, when no API key is configured.
7. The decision and its guards are recorded in ADR 0008.
