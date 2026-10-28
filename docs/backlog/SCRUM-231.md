<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-28. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-231 - Chore: Raise the CI build-and-test job's time limit from 20 to 35 minutes

| | |
|---|---|
| **Type** | Task |
| **Epic** | - |
| **Priority** | Medium |
| **Story points** | 0 |
| **Status in Jira** | In Review |
| **Sprint** | SCRUM Sprint 4 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-231 |

---

CI's `build-and-test` job has a 20-minute limit (`timeout-minutes: 20` in `.github/workflows/ci.yml`). The suite has grown, so a run that is simply slow now gets cancelled rather than failing on a test. On 26 Oct, PR #282's run was cancelled at the 20-minute mark while still installing the Playwright browser, after unit, integration and coverage had all passed; e2e never ran.

**Acceptance criteria**

1. `build-and-test` may run for up to 35 minutes before GitHub cancels it.
2. The docs that state how long CI takes (`CONTRIBUTING.md`, "What runs on every pull request") say so.
3. Nothing else about the job changes.
