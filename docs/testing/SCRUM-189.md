# SCRUM-189 — Stop long e2e journeys failing at the 30-second test limit on CI: test cases

SCRUM-189 is a Chore task in Jira, raised by Felicia Or on 2026-10-16. Its
story and acceptance criteria: [docs/backlog/SCRUM-189.md](../backlog/SCRUM-189.md).
Format and conventions: [README.md](README.md).

**Why they failed:** each test in the chore is a multi-step journey (several
sign-ins, the five-step request form, or waits on the events list's 4-second
refresh). Under CI load it ran close to Playwright's default 30-second test
limit, failed at 30.0–30.1 s, and passed on its retry. SCRUM-182 (#196, merged
16 Oct) removed the main cause of the slowdown, the sign-in pages left open.

**Where they stand (60 CI runs, 19–24 Oct, after SCRUM-182):** only three
tests needed a retry, each once: the SCRUM-15 draft journey (30.1 s), a
SCRUM-36/37 availability test, and SCRUM-82's TC-82-12. Across six recent
runs, the slowest passing journeys were the SCRUM-13 submit journey (31.2 s,
already under its group's 90-second limit), TC-108-11 (27.8 s), the SCRUM-24
two-user test (25.8 s) and the SCRUM-15 and SCRUM-16 journeys (23.7 s each).

**What changed:** each journey the chore names calls `test.slow()` with its
reason, which gives it three times the 30-second limit. The global timeout is
unchanged (AC 2). None of them waits on a fixed time; the SCRUM-24 test waits
on the status the user would see, for up to 12 s, across the 4-second refresh
(AC 3). The SCRUM-24 test's two browsers are closed in the group's `afterEach`,
so a failed step can't leave them open (AC 4). No assertion was removed, and
the SCRUM-24 test is now "SCRUM-24 [AC7] TC-24-05: …" (AC 5).

**Shared pre-conditions:** a local PostgreSQL migrated with `npm run db:deploy`
and seeded with `npm run db:seed`, as in CI's `build-and-test`.

| ID | Type | Criterion | Automated |
|---|---|---|---|
| [TC-189-01](#tc-189-01) | Positive | AC 1, AC 2, AC 3, AC 5 | e2e (the whole suite, three CI runs) |
| [TC-189-02](#tc-189-02) | Negative | AC 4 | Manual |

---

### TC-189-01

| Item | Content |
|---|---|
| Test Case ID | TC-189-01 |
| Test Scenario | [Positive] AC 1, AC 2, AC 3, AC 5: the long journeys pass first time in CI |
| Pre-conditions | — |
| Test Steps | 1. Run `build-and-test` on the pull request three times in a row. |
| Test Data | The journeys named in the chore: TC-126-08, TC-108-11, TC-108-10, the SCRUM-15 draft journey, the SCRUM-16 drafts-vs-submitted journey, TC-24-05 and TC-126-03 |
| Expected Result | In each of the three runs, every journey above passes on its first attempt, with no "(retry #1)" line in the e2e log. The three runs are linked in the pull request. |

**Automated by:** `e2e/rejection-outcome.spec.ts`, `e2e/clarification-and-amend.spec.ts` and `e2e/events.spec.ts`, in the whole suite in `build-and-test`.

### TC-189-02

| Item | Content |
|---|---|
| Test Case ID | TC-189-02 |
| Test Scenario | [Negative] AC 4: the SCRUM-24 test's browsers are closed when a step fails |
| Pre-conditions | — |
| Test Steps | 1. Make TC-24-05 fail after both browsers are open (e.g. expect a status it never shows). <br> 2. Run `npx playwright test e2e/events.spec.ts -g "TC-24-05"` against the local database. |
| Test Data | — |
| Expected Result | The test fails, and the `afterEach` closes both browser contexts; no browser is left open when the run ends. |

**Automated by:** Manual. A test can't fail on purpose in the suite.
