<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-07. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-87 - Spike: decide component testing (jsdom + React Testing Library)

| | |
|---|---|
| **Type** | Task |
| **Epic** | - |
| **Priority** | Medium |
| **Story points** | - |
| **Status in Jira** | To Do |
| **Sprint** | SCRUM Sprint 3 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-87 |

---

**Type:** Spike / technical task. This is not a user story and has no user-facing value on its own. It exists so a testing gap gets decided and explained, not left to drift.

**Update (2026-10-07):** SCRUM-125 (Done, Sprint 2) delivered the coverage threshold for server-side code: every `.ts` file under `lib/` and `app/` must stay at 100%, and CI fails otherwise. What is left here is the component-testing decision and, if component tests are adopted, whether `.tsx` files join the coverage gate. The title no longer mentions the threshold.

## Why this exists

A coverage run on the SCRUM-13/15/16/84 branch (PR #10, 2026-09-13) found:

* **No UI component has a unit test.** `create-event-dialog.tsx` (947 lines), `events-client.tsx`, `event-details-modal.tsx`, `page.tsx` and `status-badge.tsx` are all at **0% unit coverage**. Vitest runs in the `node` environment with no component-testing library, so nothing can render a component. Those files are exercised only by Playwright e2e.
* **Nothing enforces a coverage percentage.** CI runs `npm run test:coverage` and uploads the report, but there is no threshold, so coverage can fall to any level and CI stays green. (Fixed for server-side code by SCRUM-125.)

Adding jsdom and React Testing Library is a **new dependency**. CONTRIBUTING.md requires a team decision and an ADR for that, which is why this is a separate item and not something done inside a feature PR.

## Scope

1. **Decide:** adopt component tests (jsdom + @testing-library/react + @testing-library/user-event) or deliberately rely on Playwright e2e for UI. Record the decision and the reasons as an ADR in `docs/adr/`.
2. **If adopted:** configure a jsdom environment for `*.test.tsx` only (keep server/action tests on `node`), and write one reference component test (suggested: `StatusBadge`, then the create-event dialog's step validation) for the team to copy.
3. **Coverage threshold:** done for server-side `.ts` code by SCRUM-125. If component tests are adopted, decide whether `.tsx` files are measured and at what level.
4. **Document** in CONTRIBUTING.md what must be unit-tested versus e2e-tested.

## Done when

- [ ] ADR merged recording the component-testing decision
- [ ] Either a working reference component test, or the ADR explains why e2e covers UI instead
- [x] CI fails when coverage drops below the agreed threshold (server-side code, SCRUM-125)
- [ ] CONTRIBUTING.md states the unit-vs-e2e rule

## Reference: measured coverage (PR #10 branch, unit tests only)

| File | Statements |
| --- | --- |
| `app/(app)/events/queries.ts` | 100% |
| `lib/auth/can.ts` | 96.6% |
| `app/(app)/events/actions.ts` | 94.7% |
| `lib/schemas/event.ts` | 73.2% (improved by the follow-up tests on PR #10) |
| all `.tsx` components in `app/(app)/events` and `components/events` | 0% |
