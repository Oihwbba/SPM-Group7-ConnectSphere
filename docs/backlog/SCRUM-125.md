<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-08. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-125 - Measure coverage on every server-side file and fail CI when it drops

| | |
|---|---|
| **Type** | Task |
| **Epic** | - |
| **Priority** | Medium |
| **Story points** | - |
| **Status in Jira** | Done |
| **Sprint** | SCRUM Sprint 2 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-125 |

---

Description: Our coverage report only measures `lib/**/*.ts` and files named exactly `app/**/actions.ts`. Any other server-side file is left out of the report, even when it is tested, so a gap in it is never visible. This also limits the GLM reviewer, which reads the same report (ADR 0008).

Server-side files that are never measured today:

* `app/(app)/events/clarification-actions.ts`
* `app/(app)/events/registration-actions.ts`
* `app/(app)/events/queries.ts`
* `app/(app)/bookings/queries.ts`
* `app/(app)/venues/availability/week.ts`

Even the files that are measured are not at 100% on `main` (CI run 36710378366, unit and integration tests): 796/797 lines and 593/597 branches. The gaps are in `lib/db.ts` (2 branches), `lib/nav.ts` (2 branches) and `lib/schemas/auth.ts` (1 line). Nothing enforces a coverage level, so CI stays green however low coverage falls.

Scope: server-side `.ts` files only. React components (`.tsx`) and the component-testing decision remain with SCRUM-87. This task delivers the coverage-threshold part of SCRUM-87 for server-side code.

Acceptance criteria:

1. Given any `.ts` file under `lib/` or `app/`, when `npm run test:coverage` runs, then that file appears in the coverage report whatever it is named. The only exclusion is the Auth.js route re-export `app/api/auth/[...nextauth]/route.ts`, and the config states why it is excluded.
2. Given the five files listed above, when coverage runs in CI, then each is reported at 100% for statements, branches, functions and lines.
3. Given the gaps in `lib/db.ts`, `lib/nav.ts` and `lib/schemas/auth.ts`, when this task is done, then each is covered by a test that asserts behaviour. The only alternative is a branch that cannot be reached in a test, which is excluded with an inline comment giving the reason. No test exists only to raise the number.
4. Given coverage of any measured file drops below 100% for statements, branches, functions or lines, when `build-and-test` runs, then the job fails.
5. CONTRIBUTING.md states that server-side `.ts` code under `lib/` and `app/` must stay at 100% coverage, and that CI enforces it.
6. No production behaviour changes and no new dependency is added.
7. Unit, integration and e2e tests, typecheck and lint all pass locally and in CI. The PR includes the coverage summary.
