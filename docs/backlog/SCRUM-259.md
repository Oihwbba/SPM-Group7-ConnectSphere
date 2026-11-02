<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-11-02. Jira is the source of truth.
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

GitHub reports 24 open Dependabot alerts on `main` (3 critical, 6 high, 13 moderate, 2 low), checked on 1 Nov 2026. The critical ones are in `next`, which runs in production.

Updated 2 Nov 2026: `vite` 6.4.4 has its own advisory (GHSA-8g5g-mxqh-grgj), fixed in 6.4.5. `zod` is now in scope. Its patch alone doesn't remove the risk: Zod still reads every entry of an array with no maximum, so an oversized request can use a lot of memory. Only a capped array is refused before its entries are read.

## Done when

1. `next` and `eslint-config-next` are on 16.4.1.
2. `vite` is on 6.4.5, and `vitest` and `@vitest/coverage-v8` are on 4.1.12.
3. The transitive packages reach their patched versions: `sharp` 0.35.5, `source-map-js` 1.2.2, `postcss-selector-parser` 6.1.5, `brace-expansion` 1.1.21 and 5.0.12.
4. App code changes only where an upgrade or item 7 requires it, and no new dependencies are added.
5. `npm run verify`, `npm run test:coverage` and CI's e2e pass.
6. `zod` is on 4.6.7, and the validation messages the app sets itself are unchanged.
7. Every list in a request is capped: at most 500 entries, or a tighter limit where one already exists. Over the cap, the request is refused on its length, without its entries being read.

## Out of scope

`minimatch` and the ESLint packages that depend on it stay on their current versions. They are dev-only, never reach production, and the attack needs someone to supply a glob pattern to the linter. The only fix would be replacing the ESLint toolchain, so these moderate alerts stay open.

`@hookform/resolvers` is not imported anywhere, so the Zod upgrade doesn't touch it.

Related: SCRUM-258 (where the alerts were noticed).
