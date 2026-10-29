# SCRUM-196 — Check in CI that every test case cites tests and files that exist: test cases

Story and acceptance criteria: [docs/backlog/SCRUM-196.md](../backlog/SCRUM-196.md).
Format and conventions: [README.md](README.md).

**Where the check lives:** `.github/scripts/check-citations.mjs`, run by
`npm run check:citations`, by `npm run verify`, and by the **Check test-case
citations** step of `build-and-test` on every pull request.

- **What it reads.** Every **Automated by** paragraph in
  `docs/testing/SCRUM-n.md`. A citation is a quoted title, or a case id, after
  a test file and its `›`. A quote in prose, after a sentence ends or inside
  parentheses that name no file of their own, is text, not a citation. A case
  id after a quoted title is prose too.
- **What it matches against.** The titles of the `it`, `test` and `describe`
  calls in the cited file, read from its syntax tree, so a title in a comment
  or in test data doesn't count.
- **How a citation matches.** "…" in a citation, and a placeholder kept from a
  template (`${x}`, `%s`, `$x`), stand for any text. So does a title's own
  `${…}`, and an `.each` title's `%s` and `$name`. A citation with no ":" that
  ends in a case id ("SCRUM-124 … TC-124-01", "TC-163-09") matches a title
  naming that key and case anywhere.

**Shared pre-conditions:** none. Cases 01 to 08 call the script's functions
directly; case 09 runs the script on a temporary repository; case 10 reads the
workflow; case 11 is the check on this repository.

| ID | Type | Criterion | Automated |
|---|---|---|---|
| [TC-196-01](#tc-196-01) | Positive | AC 1, AC 4 | unit |
| [TC-196-02](#tc-196-02) | Positive | AC 1, AC 4 | unit |
| [TC-196-03](#tc-196-03) | Positive | AC 1, AC 4 | unit |
| [TC-196-04](#tc-196-04) | Positive | AC 1, AC 4 | unit |
| [TC-196-05](#tc-196-05) | Boundary | AC 1 | unit |
| [TC-196-06](#tc-196-06) | Boundary | AC 1 | unit |
| [TC-196-07](#tc-196-07) | Negative | AC 1, AC 2, AC 4 | unit |
| [TC-196-08](#tc-196-08) | Negative | AC 1, AC 2, AC 4 | unit |
| [TC-196-09](#tc-196-09) | Negative | AC 2 | unit |
| [TC-196-10](#tc-196-10) | Positive | AC 2 | unit |
| [TC-196-11](#tc-196-11) | Positive | AC 3 | CI |

---

### TC-196-01

| Item | Content |
|---|---|
| Test Case ID | TC-196-01 |
| Test Scenario | [Positive] AC 1, AC 4: a citation of a title, word for word, matches it |
| Pre-conditions | — |
| Test Steps | 1. Match the title against itself. <br> 2. Match it against a longer title, and a shorter citation against it. |
| Test Data | `SCRUM-9 [AC1] TC-9-01: a booking is refused` |
| Expected Result | 1 matches. 2: neither matches, since a citation without "…" names the whole title. |

**Automated by:** `tests/unit/check-citations.test.ts` › "SCRUM-196 [AC1, AC4] TC-196-01: a citation of a title, word for word, matches it and no other"

### TC-196-02

| Item | Content |
|---|---|
| Test Case ID | TC-196-02 |
| Test Scenario | [Positive] AC 1, AC 4: a title shortened with "…" still matches its test |
| Pre-conditions | — |
| Test Steps | 1. Cite the title with "…" at its end, at both ends, and in its middle. <br> 2. Cite it with "…" but a word changed, and by a case it doesn't name. |
| Test Data | `SCRUM-9 [AC1, AC2] TC-9-01, TC-9-02: a booking is refused and nothing is written` |
| Expected Result | 1: each matches. 2: neither matches. |

**Automated by:** `tests/unit/check-citations.test.ts` › "SCRUM-196 [AC1, AC4] TC-196-02: a title shortened with … matches, wherever the … is, while its words still must"

### TC-196-03

| Item | Content |
|---|---|
| Test Case ID | TC-196-03 |
| Test Scenario | [Positive] AC 1, AC 4: a citation by key and case alone matches a title naming both |
| Pre-conditions | — |
| Test Steps | 1. Cite `SCRUM-9 … TC-9-01` and `TC-9-01`. <br> 2. Cite `SCRUM-9 … TC-9-02`. |
| Test Data | `SCRUM-6 [AC2] TC-6-02, SCRUM-9 [AC1] TC-9-01: a booking is refused` |
| Expected Result | 1: both match, though SCRUM-9 isn't the title's first key. 2: no match. |

**Automated by:** `tests/unit/check-citations.test.ts` › "SCRUM-196 [AC1, AC4] TC-196-03: a citation by key and case alone matches a title naming both"

### TC-196-04

| Item | Content |
|---|---|
| Test Case ID | TC-196-04 |
| Test Scenario | [Positive] AC 1, AC 4: a title built from a template still matches its test |
| Pre-conditions | — |
| Test Steps | 1. Read the title of ``it(`SCRUM-9 [AC3] ${tc}: ${path} refuses an overnight event`)``. <br> 2. Cite one of its values, its placeholders as written, and a value shortened with "…". <br> 3. Read `.each` titles with `%s` and `$name`, and a plain title with a `$` in it. |
| Test Data | The titles in the steps. |
| Expected Result | 1: the title has a placeholder for each `${…}`. 2: each citation matches; a citation changing a word ("accepts") doesn't. 3: `%s` and `$name` are placeholders in `.each` titles only, and each cited form matches. |

**Automated by:** `tests/unit/check-citations.test.ts` › "SCRUM-196 [AC1, AC4] TC-196-04: a templated title matches a citation of one of its values, and a citation keeping its placeholders", "SCRUM-196 [AC1, AC4] TC-196-04: an .each title's %s and $name stand for its rows, cited as written or as a value"

### TC-196-05

| Item | Content |
|---|---|
| Test Case ID | TC-196-05 |
| Test Scenario | [Boundary] AC 1: only test calls give a file its titles |
| Pre-conditions | — |
| Test Steps | 1. Read a file with a title in a comment, one in test data, hooks, a `test.describe.serial`, a title joined with `+`, and an `it.skip`. |
| Test Data | The file in the test. |
| Expected Result | The titles are the describe's, the joined title and the skipped test's. The comment, the data and the hooks give none. |

**Automated by:** `tests/unit/check-citations.test.ts` › "SCRUM-196 [AC1] TC-196-05: titles come from it, test and describe calls, and not from comments, strings or hooks"

### TC-196-06

| Item | Content |
|---|---|
| Test Case ID | TC-196-06 |
| Test Scenario | [Boundary] AC 1: only quotes that follow a test file's › are citations |
| Pre-conditions | — |
| Test Steps | 1. Read a paragraph citing a case id, then two titles and a case id after them, then a title in a second file. <br> 2. Read a paragraph with a quote in parentheses, a quoted notice after a sentence ends, a citation inside parentheses with its own file, and a case id in prose. |
| Test Data | The paragraphs in the tests. |
| Expected Result | 1: the case id, the two titles and the second file's title, each with its own file; the case id after the titles is prose. 2: only the three quoted titles that follow a file's ›, the one in parentheses included. |

**Automated by:** `tests/unit/check-citations.test.ts` › "SCRUM-196 [AC1] TC-196-06: each quoted title, or case id right after a test file's ›, is a citation of that file; a case id after a title is prose", "SCRUM-196 [AC1] TC-196-06: a quote in prose, after a sentence ends or in parentheses with no file of their own, is not a citation"

### TC-196-07

| Item | Content |
|---|---|
| Test Case ID | TC-196-07 |
| Test Scenario | [Negative] AC 1, AC 2, AC 4: a title no test in the cited file has is reported |
| Pre-conditions | — |
| Test Steps | 1. Cite two titles of `a.test.ts`: one it has, and one only `b.test.ts` has. <br> 2. Cite a case id no title in the file names. |
| Test Data | `docs/testing/SCRUM-9.md`, line 5 |
| Expected Result | 1: two citations checked, and one reported: line 5 of `docs/testing/SCRUM-9.md`, the file, the renamed title, and "no test in the file has this title". The same title in another file doesn't count. 2: the case is reported, because no test title in the file names it. |

**Automated by:** `tests/unit/check-citations.test.ts` › "SCRUM-196 [AC1, AC2, AC4] TC-196-07: a title no test in the cited file has is reported with its document, line and citation", "SCRUM-196 [AC1, AC2, AC4] TC-196-07: a case id no title in the cited file names is reported"

### TC-196-08

| Item | Content |
|---|---|
| Test Case ID | TC-196-08 |
| Test Scenario | [Negative] AC 1, AC 2, AC 4: a cited file that doesn't exist is reported, on its own line |
| Pre-conditions | — |
| Test Steps | 1. Write an Automated by paragraph over two lines, its second citing `e2e/deleted.spec.ts`. <br> 2. Name a missing spec in a test step and in an Expected line. |
| Test Data | The documents in the tests. |
| Expected Result | 1: `docs/testing/SCRUM-9.md:4: … the file does not exist`, on line 4 where it is cited. 2: nothing is reported, since only Automated by paragraphs are read. |

**Automated by:** `tests/unit/check-citations.test.ts` › "SCRUM-196 [AC1, AC2, AC4] TC-196-08: a cited file that doesn't exist is reported, on the line it is cited", "SCRUM-196 [AC1] TC-196-08: only Automated by paragraphs are read, so a file named in a step or note is not a citation"

### TC-196-09

| Item | Content |
|---|---|
| Test Case ID | TC-196-09 |
| Test Scenario | [Negative] AC 2: a broken citation fails the run, and the run passes without one |
| Pre-conditions | A temporary repository with `docs/testing/` and a test file, and `GITHUB_ACTIONS` set. |
| Test Steps | 1. Run the script with a citation of a renamed test. <br> 2. Run it with every citation found, and a broken one in `docs/testing/README.md`. |
| Test Data | The files in the tests. |
| Expected Result | 1: exit code 1; the output names the document, line and citation, and has a `::error file=docs/testing/SCRUM-9.md,line=5::` annotation, so GitHub marks the line. 2: exit code 0 and one summary line. The README isn't a test-case document, so it isn't read. |

**Automated by:** `tests/unit/check-citations.test.ts` › "SCRUM-196 [AC2] TC-196-09: a broken citation fails the run, naming the document, line and citation, as an error on the document", "SCRUM-196 [AC2] TC-196-09: with every citation found, the run passes"

### TC-196-10

| Item | Content |
|---|---|
| Test Case ID | TC-196-10 |
| Test Scenario | [Positive] AC 2: CI runs the check on every pull request |
| Pre-conditions | — |
| Test Steps | 1. Read `.github/workflows/ci.yml` and `package.json`. |
| Test Data | — |
| Expected Result | The workflow runs on `pull_request`; its job runs `npm run check:citations` before the tests; the script is `node .github/scripts/check-citations.mjs`; `npm run verify` runs it too, so it fails locally first. |

**Automated by:** `tests/unit/check-citations.test.ts` › "SCRUM-196 [AC2] TC-196-10: CI runs the check on every pull request, before the tests"

### TC-196-11

| Item | Content |
|---|---|
| Test Case ID | TC-196-11 |
| Test Scenario | [Positive] AC 3: every citation in the repository passes before the check is required |
| Pre-conditions | This branch: `main` with SCRUM-236's renamed titles. |
| Test Steps | 1. Run `npm run check:citations`. |
| Test Data | — |
| Expected Result | No citation is broken: 2,301 in 95 documents on this branch, this one included. Three were fixed for it. SCRUM-72's TC-72-03 cited a title with quote marks in it, so it is now shortened with "…". SCRUM-124's TC-124-08 quoted a notice in prose, which is now read as text. SCRUM-70's titles are built in a loop, and now match as templates. Two citations inside parentheses, in SCRUM-124 and SCRUM-163, are now checked as well. The check runs inside `build-and-test`, which `main` already requires. |

**Automated by:** the **Check test-case citations** step of `build-and-test`, on this pull request and every one after it.
