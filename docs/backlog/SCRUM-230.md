<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-28. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-230 - Chore: Raise the CI job limit from 20 to 30 minutes

| | |
|---|---|
| **Type** | Task |
| **Epic** | - |
| **Priority** | Medium |
| **Story points** | - |
| **Status in Jira** | Done |
| **Sprint** | SCRUM Sprint 4 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-230 |

---

CI's build-and-test job has a 20-minute limit (timeout-minutes in .github/workflows/ci.yml). A normal run uses about 18 of it, so a slow step cancels the job before e2e finishes.

On 26-27 Oct, 'Install Playwright browser' stalled for up to 17 minutes on GitHub's Ubuntu package mirror, and #279, #282, #283 and main were cancelled at the limit with no test failing.

PO decision (Hann Qian, 27 Oct): raise the limit to 30 minutes.

### Acceptance criteria

1. The build-and-test job's timeout-minutes is 30.
2. Nothing else in the CI workflow changes.
3. A teammate approves the PR (CODEOWNERS covers .github/).
