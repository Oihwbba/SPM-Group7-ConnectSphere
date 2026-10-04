<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-04. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-114 - Chore: Sprint 1 post-DoD test hardening and code hygiene cleanup

| | |
|---|---|
| **Type** | Task |
| **Epic** | - |
| **Priority** | Medium |
| **Story points** | 0 |
| **Status in Jira** | Done |
| **Sprint** | SCRUM Sprint 2 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-114 |

---

**Description:** Three stories closed in Sprint 1 had not met the test coverage requirement in our Definition of Done at sprint close. Complete the remaining unit tests in Sprint 2 and link this chore to each affected story. This chore tracks the follow-up work; it does not replace those stories or earn their story points again.

**Acceptance criteria:**

1. The chore is linked to all three affected Sprint 1 stories.
2. Each new test is mapped to the relevant story’s acceptance criterion or identified as testing a necessary technical or security contract.
3. Tests assert meaningful behaviour, including relevant results and side effects. No tests are added solely to raise a coverage percentage.
4. The coverage report meets the metric specified in our DoD. Any uncovered defensive branch is documented with its reason.
5. All relevant unit tests, typecheck, and lint pass. The PR includes the coverage results.

Related User Stories: https://smu-spm-group7.atlassian.net/browse/SCRUM-13, https://smu-spm-group7.atlassian.net/browse/SCRUM-15, https://smu-spm-group7.atlassian.net/browse/SCRUM-31

PR #84: https://github.com/Oihwbba/SPM-Group7-ConnectSphere/pull/87
