<!--
Title: the SCRUM key, then the story's name, e.g. "SCRUM-53 Approve or reject a booking request".
The line below is how the GLM reviewer finds the story's acceptance criteria.
Use "Part of SCRUM-n" if this PR delivers only part of the story.
-->

Closes SCRUM-

## Why

<!-- The problem in a sentence or two: what the user couldn't do, or what was wrong. -->

## What changed

<!-- One row per acceptance criterion this PR delivers. Say plainly if a criterion is still to do. -->

| AC | What changed |
|---|---|
| 1 | |

## Acceptance criteria → tests

<!-- The test cases in docs/testing/SCRUM-n.md and the tests that automate them. -->

| AC | Test cases | Covered by |
|---|---|---|
| 1 | TC-n-01 | unit / integration / e2e |

## How I verified it

<!-- What you actually ran and its result, e.g. npm run verify, test:coverage, the e2e specs you touched. -->

- [ ] `npm run verify`
- [ ] `npm run test:coverage` (needs `docker compose up -d`)
- [ ] The e2e specs for the journeys this changes
- [ ] Went through "Before you open a pull request" in `CONTRIBUTING.md`

## Notes for review

<!-- Anything a reviewer should know: a test you weakened or removed on purpose and why, a migration, a follow-up story. Delete if none. -->
