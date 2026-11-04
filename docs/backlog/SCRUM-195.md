<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-11-04. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-195 - [NOT NEEDED] Remove the placeholder tests for features that are built

| | |
|---|---|
| **Type** | Task |
| **Epic** | - |
| **Priority** | Low |
| **Story points** | - |
| **Status in Jira** | To Do |
| **Sprint** | Backlog |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-195 |

---

**Status at project close (4 Nov 2026): not done. Left in the backlog by decision; no code change.**

**What changed since this was raised:** the two placeholders in `tests/integration/concurrency.test.ts` were removed by SCRUM-236 (#313). Three remain, in `tests/unit/venues.test.ts`. They were left over from the project scaffold (SCRUM-7).

**Why the three remaining placeholders hide no missing tests:** `it.todo` runs no code, so coverage is unaffected and CI passes. Each behaviour is tested elsewhere:

| Placeholder | Covered by |
| --- | --- |
| lists venues with capacity, facilities and accessibility (SCRUM-34) | `e2e/venue-catalogue.spec.ts` (SCRUM-34 \[AC1, AC2, AC3, AC4, AC6, AC9\]); `tests/unit/venue-options.test.ts` (TC-34-18); `tests/unit/venue-hours.test.ts` (TC-34-01) |
| filters venues by required facilities and layout (SCRUM-38) | `tests/unit/venue-search.test.ts` (TC-38-12: several facilities, layout, filters combined); `tests/integration/venue-search.test.ts` (TC-38-12: filters narrow a real search) |
| excludes a venue that is unavailable for the period (SCRUM-36/37) | `tests/integration/venue-search.test.ts` (SCRUM-38 \[AC3, AC5\] TC-38-05, TC-38-06); `tests/integration/unavailability.test.ts` (SCRUM-37 \[AC2, AC5\] TC-37-04, TC-37-07) |

**Why it wasn't done:** it was Medium priority and unestimated. It changes no acceptance criterion, so it was never selected into a sprint. Sprint 4 has ended, and the team decided to change no more code after the final sprint.

**Note for anyone reading the test output:** the "3 todo" in each run refers to these three placeholders. They are not missing tests for SCRUM-34, 36, 37 or 38.

---

Every test run reports todo tests: `tests/unit/venues.test.ts` holds three `it.todo` placeholders for SCRUM-34, SCRUM-38 and SCRUM-36/37, and `tests/integration/concurrency.test.ts` two for SCRUM-53 and SCRUM-38/50. All five features are built and tested elsewhere, so the placeholders read as missing tests. Found by the rubric audit on 2026-10-19.

**Acceptance criteria**

1. Each placeholder is removed only after naming the test that already covers it; one with no covering test is written instead of removed.
2. `npm run test:coverage` reports no todo tests, and coverage stays at 100%.
3. The PR lists each placeholder and the test that covers it.

**Change log**

* 2026-10-19: created from the rubric audit (Felicia).
