<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-09-21. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-67 - Be prevented from performing an action my role does not permit

| | |
|---|---|
| **Type** | Story |
| **Epic** | SCRUM-9 - Access Control |
| **Priority** | Highest |
| **Story points** | 5 |
| **Status in Jira** | In Progress |
| **Sprint** | SCRUM Sprint 1 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-67 |

---

**Cross-cutting security rule — Authorization Enforcement**

**Acceptance Criteria:**

* Every protected state-changing operation checks the caller's role and required relationship to the resource before execution.
* A disallowed request is rejected and makes no state change.
* Authorization is enforced server-side / at the operation boundary and cannot be bypassed by directly calling a URL or API.
* A refusal does not disclose protected resource existence or contents beyond what the caller is permitted to know.
* Permission rules are defined centrally and consumed by feature operations; individual stories must not invent their own conflicting role rules.

**Authoritative model:** see the Confluence page **ConnectSphere Cross-Cutting Requirements Model**.


## Subtasks

| Subtask | Summary | Status |
|---|---|---|
| [SCRUM-100](SCRUM-100.md) | Implement can() — role check plus relationship check, one source of truth | To Do |
| [SCRUM-101](SCRUM-101.md) | Document the guard in CONTRIBUTING.md (no inline role checks) | To Do |
| [SCRUM-102](SCRUM-102.md) | Tests — unit (guard allow/deny), integration (refusal changes nothing), e2e (URL bypass refused) | To Do |
