<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-09-30. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-89 - CI and developer infrastructure: Node 24, CI hardening, test folders, security upgrades, migration sync

| | |
|---|---|
| **Type** | Task |
| **Epic** | - |
| **Priority** | Medium |
| **Story points** | - |
| **Status in Jira** | Done |
| **Sprint** | SCRUM Sprint 1 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-89 |

---

Keeps CI, tooling and the database schema healthy, so the merge gate and the CI evidence stay reliable.

Delivered (all merged, CI green):

* #17: CI and tooling moved from end-of-life Node 20 to Node 24 LTS
* #18: CI hardening (least-privilege token, timeout, concurrency, Node version from .nvmrc)
* #22: Vercel preview deployments turned off; only main deploys (with SCRUM-88)
* #26: test case specifications in docs/testing/ (with SCRUM-31)
* #27: tests split into tests/unit and tests/integration
* #32: all Dependabot security alerts fixed (Vitest 4, Vite 6, PostCSS, tsx, deepmerge-ts); Dependabot PRs turned off
* #33: recovered an uncommitted Supabase migration so the repo schema matches production, with an integration test


Unplanned technical task, added to Sprint 1 on 2026-09-16. No story points, so velocity counts only user stories.
