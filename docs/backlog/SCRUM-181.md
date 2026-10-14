<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-14. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-181 - Chore: Fix the GLM reviewer gaps found by auditing a week of reviews

| | |
|---|---|
| **Type** | Task |
| **Epic** | - |
| **Priority** | Medium |
| **Story points** | - |
| **Status in Jira** | In Review |
| **Sprint** | SCRUM Sprint 3 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-181 |

---

Every GLM review from 6 to 13 October was read (101 runs on 24 pull requests), and each finding checked against the code at its commit. The reviewer was accurate, with two false positives, both from input it was never given, but it had blind spots. A re-run never saw its own earlier findings in 46 of the 65 reviews that had them, because the previous review was cut at 4,000 characters, with the acceptance table first; on #162 a re-run of the same commit dropped a true finding. 12 runs judged test coverage without CI's results: CI now takes up to 20 minutes, and the review waited 15. Markdown is left out of the diff, so the test-case documents' "Automated by" citations were never checked (#171 left two stale ones). Migrations were never sent, which caused #148's false positive. And the diff was read with the pull request's own `.gitattributes`, so a pull request could hide its own code with a `-diff` rule. The reviewer memory had gone stale too: its own rules still said 8,000 characters.

The team runs this reviewer because Copilot code review needs Copilot credits, which are limited and which the team doesn't have. That decision wasn't recorded as one.

**Acceptance criteria**

1. The review waits for CI's build-and-test long enough for a normal run (up to 25 minutes, above this week's 95th percentile of 19.7), and the job's timeout covers that wait plus GLM's whole budget.
2. On a re-run, GLM sees its previous review's findings in full, ahead of its overview, however long the acceptance table is; and when the previous review was of the same commit, it is told the code hasn't changed.
3. For each story a pull request names, GLM gets the outline of `docs/testing/<KEY>.md` at the pull request's head (each case's heading, scenario and "Automated by" line, with line numbers) and checks the citations against the tests; a finding on a cited line links to it.
4. When a pull request changes the schema or a migration, GLM gets every migration's CREATE, ALTER and DROP line, with its file and line.
5. The diff under review is read with the base branch's `.gitattributes`, so a pull request can't hide its own changes with a `-diff` rule; `.gitattributes` needs a code owner's approval.
6. Every lesson in the reviewer memory is true of the code today, including the memory's own 12,000-character limit, and the memory bot's comments and pull-request text no longer state constraints that were removed.
7. ADR 0008 records why the team uses GLM and not Copilot code review, and what the audit found; CONTRIBUTING.md describes the reviewer as it now works.

Asked for by Jin Hong on 2026-10-13.
