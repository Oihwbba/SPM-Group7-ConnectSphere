<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-11-04. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-275 - Chore: Fix the docs that no longer match the code: design reference, evidence, README, ADR 0006 and reviewer memory

| | |
|---|---|
| **Type** | Task |
| **Epic** | - |
| **Priority** | Medium |
| **Story points** | - |
| **Status in Jira** | Done |
| **Sprint** | SCRUM Sprint 4 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-275 |

---

## Why

A docs audit on 3 Nov found documents that no longer match the code on `main`.

**Acceptance criteria**

1. `docs/design/api.md` names every table each Server Action writes and every row it locks.
2. `docs/design/README.md` and the diagrams' labels match what is built: no "in review" or "planned" boxes for merged work, and no advisory lock.
3. `docs/evidence/` names the e2e tests and seed event as they are now titled.
4. `README.md`, `docs/ai-usage.md` and ADR 0006 (by a dated addendum) describe the app as built.
5. `.github/ai-review/memory.md` drops the "Known open gaps" that have since been fixed.
6. Only documentation changes.

**Related:** SCRUM-268 (the previous docs audit).
