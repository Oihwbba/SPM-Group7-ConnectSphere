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

**Automated by:** `tests/unit/<domain>.test.ts` › "SCRUM-31 [AC1] TC-31-01: …"
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
- **The test's title** starts with the story, the criteria and the case:
  `SCRUM-31 [AC1, AC2] TC-31-01: what must happen`. The reviewer finds tests
  by the key, and the graders trace story → criterion → case → test by it.

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

### Written from the criteria and existing tests (SCRUM-176)

These Sprint 1 and 2 stories were Done before they had a specification. Each
was written on 2026-10-12 from its acceptance criteria, and maps every
criterion to the tests that already existed, by their current titles. Those
titles predate the `SCRUM-n [ACx] TC-n-xx` format; renaming them waits until
the open pull requests that change the same test files have merged.

| Story | Owner | Test cases | Status |
|---|---|---|---|
| [SCRUM-13](SCRUM-13.md) | Felicia Or | 14 | Automated except the accepted attendance of 1 in TC-13-08; notes what SCRUM-129 and SCRUM-170 changed in AC 1, 2, 4 and 6 |
| [SCRUM-14](SCRUM-14.md) | Hann Qian | 6 | Automated except TC-14-02's whole submission with no Coordinator; its assignment step is unit-tested |
| [SCRUM-15](SCRUM-15.md) | Felicia Or | 12 | Every case automated; AC 9's marking for correction isn't built, since the requirements are free text |
| [SCRUM-16](SCRUM-16.md) | Felicia Or | 5 | Automated except TC-16-05 (AC 8), which is manual |
| [SCRUM-17](SCRUM-17.md) | Hann Qian | 3 | Every case automated |
| [SCRUM-18](SCRUM-18.md) | Hann Qian | 10 | Every case automated |
| [SCRUM-19](SCRUM-19.md) | Hann Qian | 6 | Every case automated; approval now ends in Planning (SCRUM-81) |
| [SCRUM-20](SCRUM-20.md) | Hann Qian | 5 | Every case automated; describes automatic assignment until SCRUM-165 |
| [SCRUM-23](SCRUM-23.md) | Jun Bin | 2 | Every case automated |
| [SCRUM-24](SCRUM-24.md) | Jun Bin | 6 | Automated except TC-24-06 (AC 5, waiting on SCRUM-128) and TC-24-03's message |
| [SCRUM-29](SCRUM-29.md) | Jin Hong | 7 | Every case automated; reserving is SCRUM-155's |
| [SCRUM-30](SCRUM-30.md) | Jin Hong | 7 | Every case automated |
| [SCRUM-65](SCRUM-65.md) | Caylern Goh | 4 | Every case automated |
| [SCRUM-66](SCRUM-66.md) | Caylern Goh | 4 | Every case automated |
| [SCRUM-67](SCRUM-67.md) | Caylern Goh | 6 | Every case automated |
| [SCRUM-68](SCRUM-68.md) | Caylern Goh | 3 | Every case automated |
| [SCRUM-69](SCRUM-69.md) | Hann Qian | 5 | Every case automated; describes the lists until SCRUM-165 and SCRUM-21 |
| [SCRUM-72](SCRUM-72.md) | Hann Qian | 8 | Every case automated |
| [SCRUM-73](SCRUM-73.md) | Hann Qian | 8 | Every case automated |
| [SCRUM-74](SCRUM-74.md) | Hann Qian | 6 | Every case automated |
| [SCRUM-76](SCRUM-76.md) | Hann Qian | 5 | Every case automated |
| [SCRUM-84](SCRUM-84.md) | Felicia Or | 8 | Automated except TC-84-04's message and button |
| [SCRUM-129](SCRUM-129.md) | Felicia Or | 6 | Every case automated |

### Written with the story

| Story | Owner | Test cases | Status |
|---|---|---|---|
| [SCRUM-25](SCRUM-25.md) | Felicia Or | 20 | Every case automated (unit, integration for the row lock, the warning and flags, the safety check and the permanent notes, e2e for both journeys); AC 2's safety check can be tried in the app once SCRUM-166 adds requesting one |
| [SCRUM-27](SCRUM-27.md) | Jin Hong | 15 | Written with the story; every case automated |
| [SCRUM-28](SCRUM-28.md) | Jin Hong | 11 | Written with the story; every case automated |
| [SCRUM-31](SCRUM-31.md) | Jun Bin | 11 | Written from the acceptance criteria and existing tests; TC-31-04, -05 and -09 are partly manual |
| [SCRUM-34](SCRUM-34.md) | Felicia Or | 22 | Every case automated (unit, integration for the database's hours check, the migration converting existing hours, opening hours and retirement refusing requests, holds and approvals, and two retirements at once, e2e for both journeys and the detail page's 404) |
| [SCRUM-36](SCRUM-36.md) | Caylern Goh | 9 | Automated; a real screen-reader pass is manual |
| [SCRUM-37](SCRUM-37.md) | Caylern Goh | 7 | Every case automated |
| [SCRUM-41](SCRUM-41.md) | Jin Hong | 16 | Every case automated (unit, integration for the lock, index and rejection, e2e for both journeys); AC 8's cancellation half waits for SCRUM-82 |
| [SCRUM-45](SCRUM-45.md) | Jin Hong | 8 | Every case automated; the triggers of unbuilt stories (AC 5–7, 9, 10 and the Lead's assignment) are listed as still to do |
| [SCRUM-48](SCRUM-48.md) | Jin Hong | 15 | Every case automated except TC-48-08 and TC-48-10, blocked by SCRUM-166 and SCRUM-121 |
| [SCRUM-50](SCRUM-50.md) | Caylern Goh | 15 | Every case automated |
| [SCRUM-52](SCRUM-52.md) | Caylern Goh | 6 | Every case automated |
| [SCRUM-53](SCRUM-53.md) | Caylern Goh | 9 | Automated except TC-53-09 (AC 9), which is manual; AC 3 and AC 10 point to other cases |
| [SCRUM-81](SCRUM-81.md) | Jun Bin | 13 | Every case automated (unit, integration for the simultaneous confirm, e2e for the journey) |
| [SCRUM-110](SCRUM-110.md) | Jun Bin | 15 | Every case automated (unit, and e2e for the page) |
| [SCRUM-108](SCRUM-108.md) | Jun Bin | 14 | Every case automated (unit, e2e for both journeys); AC 6, 8 and 10 point to existing tests |
| [SCRUM-124](SCRUM-124.md) | Jin Hong | 2 | Grows with the story: AC 4's hold notices (with SCRUM-163) and AC 7 (with SCRUM-41) so far; AC 4's approve and reject notices wait for SCRUM-53, and the withdrawal, line-change and reminder cases are still to add |
| [SCRUM-126](SCRUM-126.md) | Jun Bin | 10 | Every case automated (unit, integration for the constraint, migration and simultaneous clicks, e2e for the journey) |
| [SCRUM-130](SCRUM-130.md) | Felicia Or | 12 | Every case automated (unit, integration, e2e) |
| [SCRUM-117](SCRUM-117.md) | Jun Bin | 10 | Every case automated (unit, integration for releasing arrangements in one transaction, e2e for both journeys) |
| [SCRUM-163](SCRUM-163.md) | Jin Hong | 17 | Every case automated; TC-163-13's cancel and flag halves wait for SCRUM-82 and SCRUM-161 |
| [SCRUM-142](SCRUM-142.md) | Jin Hong | 18 | Every case automated (unit, integration for what each change writes and two withdrawals at once, e2e for the Coordinator's journeys) |
| [SCRUM-155](SCRUM-155.md) | Jin Hong | 16 | Every case automated (unit, integration for all-or-nothing and the races, e2e for the journey) |
| [SCRUM-156](SCRUM-156.md) | Jin Hong | 8 | Every case automated; TC-155-16 retired and the SCRUM-31 reserve cases mapped to SCRUM-155 |
| [SCRUM-159](SCRUM-159.md) | Jun Bin | 17 | Every case automated (unit, integration for the database's range and the simultaneous approvals, e2e for the calendar and the request form); AC 1's form is SCRUM-34's and AC 3's search SCRUM-38's |
| [SCRUM-172](SCRUM-172.md) | Jin Hong | 20 | Integration and unit; TC-172-15 step 3 is manual, and TC-172-16 is the whole suite |
| [SCRUM-26](SCRUM-26.md) | Jun Bin | 15 | Every case automated (unit, integration for blocking, Still stands against real unavailability and simultaneous cancels, e2e for the journey); AC 1's warning screen is SCRUM-25's |
