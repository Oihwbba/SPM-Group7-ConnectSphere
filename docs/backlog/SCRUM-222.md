<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-23. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-222 - Chore: Bring the Server Actions reference, testing index and SCRUM-50 supersession note up to date

| | |
|---|---|
| **Type** | Task |
| **Epic** | - |
| **Priority** | Medium |
| **Story points** | 0 |
| **Status in Jira** | In Review |
| **Sprint** | SCRUM Sprint 4 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-222 |

---

A documentation audit on 23 Oct (during SCRUM-188) found the repo's reference documents behind the code. `docs/design/api.md` says every Server Action is listed and updated in the same PR, but six actions added after its 13 Oct snapshot are missing. The testing index omits one story's test cases and has two stale counts. SCRUM-50 still describes the half-hour rounding that SCRUM-188 replaced, without saying so, so a reviewer reading it would expect rounding.

**Acceptance criteria**

1. `docs/design/api.md` lists every exported Server Action with its permission, input, writes and locks, including `cancelEvent` (SCRUM-82), `getChangeDecision` and `decideChangeRequest` (SCRUM-128), `requestSafetyCheck` and `recordSafetyCheckOutcome` (SCRUM-166) and `assignCoordinator` (SCRUM-165), each taken from the code.
2. `docs/testing/README.md` has a row for SCRUM-135, and the case counts for SCRUM-131 (11) and SCRUM-159 (19) match their files.
3. SCRUM-50's change log in Jira notes that SCRUM-188 supersedes AC1's rounding, and `docs/backlog/SCRUM-50.md` is re-synced from Jira.
4. No code or test changes.
