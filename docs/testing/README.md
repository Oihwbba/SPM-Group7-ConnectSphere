# Test case specifications

One file per user story, holding the **written plan** for each of its tests:
what is tested, from what starting state, with which steps and data, and what
must happen. The format is the team's *Test Case Documentation Template*
(Google Docs, "SPM Documentation"), so a spec reads the same here as there.

```
docs/backlog/SCRUM-31.md   the story and its acceptance criteria (from Jira)
docs/testing/SCRUM-31.md   the test cases that prove those criteria
```

A specification changes only when its story changes. It does **not** record
test runs: see [Execution records](#execution-records).

## Writing a test case

Copy this block for each case:

```markdown
### TC-31-01

| Item | Content |
|---|---|
| Test Case ID | TC-31-01 |
| Test Scenario | [Positive] AC 1: … |
| Pre-conditions | … |
| Test Steps | 1. … <br> 2. … |
| Test Data | … |
| Expected Result | … |

**Automated by:** `tests/unit/reservation.test.ts` › "AC 1 & 2: …"
```

- **Test Case ID:** `TC-<story number>-<two digits>`, e.g. `TC-31-03`. Never
  reuse or renumber an ID, even after deleting a case; other documents and
  test titles refer to it.
- **Test Scenario:** start with its type, then the acceptance criterion it
  proves:
  - `[Positive]`: the intended use succeeds.
  - `[Negative]`: invalid input, a wrong role or a wrong state is refused, and
    nothing is written.
  - `[Boundary]`: the exact edge of a rule, such as equal to the limit, one
    over it, or two periods that touch.
  - `[Concurrency]`: two users acting at the same moment.
  Every acceptance criterion needs at least one positive case, and every rule
  in it needs a negative or boundary case.
- **Pre-conditions:** the signed-in role, the seeded data the case relies on
  (`prisma/seed.ts`), and the state the record must be in.
- **Test Steps:** numbered, one action each, written so a teammate can run
  them by hand in the app.
- **Test Data:** exact values, including the seeded account
  (`techsupport@test.local` / `Password123!`).
- **Expected Result:** what the user sees and what the database must contain
  afterwards. Quote messages exactly.
- **Automated by** (below the table): the test file and test title that
  automate the case, or **Manual** if none does yet. A case marked Manual is a
  test still to be written.

## Execution records

A specification is written once; an execution record is produced every time
the tests run.

- **Automated cases:** every pull request and every push to `main` runs the
  whole Vitest and Playwright suite in GitHub Actions (`build-and-test`). That
  run is the execution record: date, commit, environment, and pass or fail for
  every test, with the Playwright report and coverage kept as run artifacts.
  An integration test that needs a local database and is skipped counts as
  **Not Executed**.
- **Manual cases:** record each run in the Google Docs template: Actual Result,
  Pass / Fail / Not Executed / Blocked, remarks or a defect link, date, build
  (commit) and environment, and who ran it.

## Regression testing

The suite is the regression suite: `build-and-test` runs every existing test
on every pull request and cannot be skipped (it is a required check on
`main`), so a change that breaks an earlier story fails before it merges. When
a defect is fixed, add a test that fails without the fix and name it after the
defect, e.g. `regression: a blank rejection reason was accepted`.

## Stories with a specification

| Story | Owner | Test cases | Status |
|---|---|---|---|
| [SCRUM-31](SCRUM-31.md) | Jun Bin | 11 | Written from the acceptance criteria and existing tests; TC-31-04, -05 and -09 are partly manual |
| [SCRUM-50](SCRUM-50.md) | Caylern Goh | 10 | Every case automated |
| [SCRUM-52](SCRUM-52.md) | Caylern Goh | 4 | Every case automated |
| [SCRUM-53](SCRUM-53.md) | Caylern Goh | 8 | Every case automated; AC 3's calendar view follows with SCRUM-36 |
