<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-11-04. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-269 - Chore: Cite the e2e tests that seven test cases leave out of their Automated by lines

| | |
|---|---|
| **Type** | Task |
| **Epic** | - |
| **Priority** | Medium |
| **Story points** | - |
| **Status in Jira** | Done |
| **Sprint** | SCRUM Sprint 4 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-269 |

---

## Why

On 3 Nov every e2e test title was traced to `docs/testing/`. Every title names test cases that exist, and `npm run check:citations` finds 0 broken citations out of 2,482. In the other direction, seven cases are named by an e2e test whose spec their own **Automated by** line doesn't list. The checker can't catch this, because it only checks the citations a doc already makes. A grader going from the case to its tests misses the e2e coverage:

* **TC-162-01, TC-162-11, TC-162-12, TC-162-13** (`docs/testing/SCRUM-162.md`): named by `e2e/several-venues.spec.ts`, but they cite only unit and integration tests.
* **TC-40-06** (`docs/testing/SCRUM-40.md`): named by `e2e/venue-suitability.spec.ts`, but it cites only unit tests.
* **TC-142-02** (`docs/testing/SCRUM-142.md`): says "as TC-142-01 (integration and e2e)" and names no file or test.

**Acceptance criteria**

1. Each of the seven cases' **Automated by** line cites the e2e test whose title names it, by file and title, and keeps its existing citations.
2. TC-142-02 cites its integration and e2e tests explicitly, not "as TC-142-01".
3. `npm run check:citations` passes with 0 broken.
4. Only Markdown in `docs/testing/` changes.

**Out of scope:** the roughly 87 cases automated by an e2e test that is titled under a different story's case (e.g. TC-19-01 by "SCRUM-81 … TC-81-01"). The testing README allows that, and the docs already record the link.

**Related:** SCRUM-196 (the citation check), SCRUM-162, SCRUM-40, SCRUM-142.
