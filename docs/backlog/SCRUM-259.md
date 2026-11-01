<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-11-01. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-259 - Chore: Patch the dependencies GitHub reports as vulnerable

| | |
|---|---|
| **Type** | Task |
| **Epic** | - |
| **Priority** | High |
| **Story points** | - |
| **Status in Jira** | In Review |
| **Sprint** | SCRUM Sprint 4 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-259 |

---

## Why

GitHub reports 24 open Dependabot alerts on `main` (3 critical, 6 high, 13 moderate, 2 low), checked on 1 Nov 2026. The critical ones are in `next`, which runs in production. All but the `zod` alert have a patched version in the same major line.

## Done when

1. `next` and `eslint-config-next` are on 16.4.1.
2. `vite` is on 6.4.4, and `vitest` and `@vitest/coverage-v8` are on 4.1.12.
3. The transitive packages reach their patched versions: `sharp` 0.35.5, `source-map-js` 1.2.2, `postcss-selector-parser` 6.1.5, `brace-expansion` 1.1.21 and 5.0.12.
4. No app code changes unless an upgrade requires it, and no new dependencies are added.
5. `npm run verify`, `npm run test:coverage` and CI's e2e pass.

## Out of scope

`zod` is on 3.24.1 and its only patched version is 4.6.6, a major upgrade across 22 files and `@hookform/resolvers`. That is a separate decision, so its alert stays open.

Related: SCRUM-258 (where the alerts were noticed).
