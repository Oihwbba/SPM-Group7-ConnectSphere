# SCRUM-236 — Name every unit and integration test after its story, criteria and case: test cases

Story and acceptance criteria: [docs/backlog/SCRUM-236.md](../backlog/SCRUM-236.md).
Format and conventions: [README.md](README.md).

SCRUM-236 is a Chore task. What it delivers is the test titles and the
test-case documents themselves, so its cases are checks over the whole suite
rather than new tests. Each was run by the audit described in pull request
#313. TC-236-04 is automated by SCRUM-196's citation check once that merges.

**Shared pre-conditions:** this branch checked out. Each check reads every
`it`, `test` and `describe` title in `tests/` and `e2e/`, and every file in
`docs/testing/`.

| ID | Type | Criterion | Automated |
|---|---|---|---|
| [TC-236-01](#tc-236-01) | Positive | AC 1 | Manual (an audit of every title) |
| [TC-236-02](#tc-236-02) | Negative | AC 2 | Manual (an audit of every title) |
| [TC-236-03](#tc-236-03) | Positive | AC 3 | Manual (an audit of every title) |
| [TC-236-04](#tc-236-04) | Negative | AC 4 | CI, by SCRUM-196's check once it merges |
| [TC-236-05](#tc-236-05) | Positive | AC 5 | Manual (a document check) |
| [TC-236-06](#tc-236-06) | Negative | AC 6 | Manual (a diff review) |

---

### TC-236-01

| Item | Content |
|---|---|
| Test Case ID | TC-236-01 |
| Test Scenario | [Positive] AC 1: every unit and integration test a document cites is titled after its story, criteria and case |
| Pre-conditions | Shared. |
| Test Steps | 1. For each citation in `docs/testing`, find the test it names. <br> 2. Read that test's title. |
| Test Data | — |
| Expected Result | Each title starts `SCRUM-n [ACx] TC-n-xx:`, with the story, criteria and case of the document citing it. A test under several cases names each, in groups separated by ", ". The description after the colon is the test's earlier description, with no second prefix inside it. |

**Automated by:** Manual (an audit of every title, in #313).

### TC-236-02

| Item | Content |
|---|---|
| Test Case ID | TC-236-02 |
| Test Scenario | [Negative] AC 2: no title names a criterion its case doesn't cover, a case under another story's key, or a superseded case |
| Pre-conditions | Shared. |
| Test Steps | 1. For each case a title names, compare the criteria in the title with the case's row in its summary table. <br> 2. Check the case's number matches the key it sits under. <br> 3. Check the case isn't marked fully superseded. |
| Test Data | The errors listed in the story, e.g. `SCRUM-226 [AC2] TC-155-17`, `SCRUM-48 [AC6] TC-48-15`, TC-20-01 and TC-69-05. |
| Expected Result | Every title's criteria overlap its case's. Every case sits under its own story's key, so `SCRUM-226 [AC2], SCRUM-155 [AC5, AC6] TC-155-17`. No title names TC-20-01, TC-69-05 or another fully superseded case. |

**Automated by:** Manual (an audit of every title, in #313).

### TC-236-03

| Item | Content |
|---|---|
| Test Case ID | TC-236-03 |
| Test Scenario | [Positive] AC 3: a test no document cites carries its story's or chore's key, and a test of no story is left plain and listed |
| Pre-conditions | Shared. |
| Test Steps | 1. List the unit and integration tests no document cites. <br> 2. Read their titles. |
| Test Data | — |
| Expected Result | Each carries its story's or chore's key, and its criterion where one applies (for example `SCRUM-112: …` for the reviewer's memory). The 25 tests that belong to no story or chore keep plain titles, and #313 lists each with the reason. |

**Automated by:** Manual (an audit of every title, in #313).

### TC-236-04

| Item | Content |
|---|---|
| Test Case ID | TC-236-04 |
| Test Scenario | [Negative] AC 4: no citation in `docs/testing` names a test that doesn't exist |
| Pre-conditions | Shared. |
| Test Steps | 1. Run SCRUM-196's citation check, `npm run check:citations`. |
| Test Data | — |
| Expected Result | No citation is reported. Every citation of a renamed test cites its new title. |

**Automated by:** the **Check test-case citations** step of `build-and-test`, once SCRUM-196 merges. On this branch the same check ran from the audit before SCRUM-196 existed.

### TC-236-05

| Item | Content |
|---|---|
| Test Case ID | TC-236-05 |
| Test Scenario | [Positive] AC 5: every case follows the README template, and the README's counts match |
| Pre-conditions | Shared. |
| Test Steps | 1. For every case in `docs/testing`, check it has a Test Case ID row and an Automated by line, and that its summary row's criteria and Automated column agree with it. <br> 2. Count the cases in each file and compare with the README index. <br> 3. Read the README's rules for test titles. |
| Test Data | — |
| Expected Result | 1: every case has both, and every summary row agrees. 2: every count matches. 3: the README says how a test of several stories, a case with no criterion, a bug task whose case lives in another story's document and an uncited test are named. |

**Automated by:** Manual (a document check, in #313).

### TC-236-06

| Item | Content |
|---|---|
| Test Case ID | TC-236-06 |
| Test Scenario | [Negative] AC 6: no test's steps or assertions change |
| Pre-conditions | Shared. |
| Test Steps | 1. List every changed line in `tests/` between `main` and this branch. |
| Test Data | — |
| Expected Result | Each is a title string, apart from the two `it.todo`s removed from `tests/integration/concurrency.test.ts` with the comments around them, which now point to SCRUM-53's TC-53-05 and TC-53-06, the tests that cover them. |

**Automated by:** Manual (a diff review, in #313).
