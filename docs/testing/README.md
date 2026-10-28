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

These Sprint 1 and 2 stories, and the Sprint 3 task SCRUM-168, were Done
before they had a specification. Each was written on 2026-10-12 (SCRUM-168 on
2026-10-13) from its acceptance criteria, and maps every criterion to the
tests that already existed, by their current titles. Those titles predate the `SCRUM-n [ACx] TC-n-xx` format; renaming them waits until
the open pull requests that change the same test files have merged.

| Story | Owner | Test cases | Status |
|---|---|---|---|
| [SCRUM-13](SCRUM-13.md) | Felicia Or | 14 | Every case automated; notes what SCRUM-129 and SCRUM-170 changed in AC 1, 2, 4 and 6 |
| [SCRUM-14](SCRUM-14.md) | Hann Qian | 6 | Every current case automated; TC-14-02, and TC-14-01's assignment step, superseded by SCRUM-165 |
| [SCRUM-15](SCRUM-15.md) | Felicia Or | 12 | Every case automated; AC 9's marking for correction isn't built, since the requirements are free text |
| [SCRUM-16](SCRUM-16.md) | Felicia Or | 5 | Every case automated (TC-16-05 by e2e) |
| [SCRUM-17](SCRUM-17.md) | Hann Qian | 3 | Every case automated; TC-17-02's unassigned request superseded by SCRUM-165 |
| [SCRUM-18](SCRUM-18.md) | Hann Qian | 11 | Every case automated |
| [SCRUM-183](SCRUM-183.md) | Jun Bin | 1 | A Chore task: SCRUM-18's clarification spec waits for each dialog to close; automated (the whole suite, in CI) |
| [SCRUM-19](SCRUM-19.md) | Hann Qian | 6 | Every case automated; approval now ends in Planning (SCRUM-81) |
| [SCRUM-20](SCRUM-20.md) | Hann Qian | 5 | TC-20-01 to TC-20-04 superseded by SCRUM-165, citing its tests; TC-20-05 automated |
| [SCRUM-23](SCRUM-23.md) | Jun Bin | 2 | Every case automated |
| [SCRUM-24](SCRUM-24.md) | Jun Bin | 6 | Every case automated; TC-24-06 tests the refusals, and AC 5's two ways back to Planning are SCRUM-128's and SCRUM-26's tests |
| [SCRUM-29](SCRUM-29.md) | Jin Hong | 8 | Every case automated; reserving is SCRUM-155's |
| [SCRUM-30](SCRUM-30.md) | Jin Hong | 7 | Every case automated |
| [SCRUM-65](SCRUM-65.md) | Caylern Goh | 4 | Every case automated |
| [SCRUM-66](SCRUM-66.md) | Caylern Goh | 4 | Every case automated |
| [SCRUM-67](SCRUM-67.md) | Caylern Goh | 6 | Every case automated; TC-67-01's Venue Staff catalogue step superseded by SCRUM-34 AC 2 |
| [SCRUM-68](SCRUM-68.md) | Caylern Goh | 3 | Every case automated |
| [SCRUM-69](SCRUM-69.md) | Hann Qian | 5 | Every current case automated; TC-69-05, and TC-69-01's unassigned events, superseded by SCRUM-165 |
| [SCRUM-72](SCRUM-72.md) | Hann Qian | 8 | Every case automated |
| [SCRUM-73](SCRUM-73.md) | Hann Qian | 8 | Every case automated |
| [SCRUM-74](SCRUM-74.md) | Hann Qian | 6 | Every case automated |
| [SCRUM-75](SCRUM-75.md) | Felicia Or | 14 | Automated (unit, integration for closing against real registrations, a close racing a registration and a new confirmation, e2e for the journey). TC-75-14 is retired: AC 11 moved to SCRUM-128 AC11 |
| [SCRUM-76](SCRUM-76.md) | Hann Qian | 5 | Every case automated |
| [SCRUM-84](SCRUM-84.md) | Felicia Or | 9 | Every case automated |
| [SCRUM-129](SCRUM-129.md) | Felicia Or | 6 | Every case automated |
| [SCRUM-168](SCRUM-168.md) | Felicia Or | 3 | Automated at phone width; TC-168-01 at desktop width is manual |

### Written with the story

| Story | Owner | Test cases | Status |
|---|---|---|---|
| [SCRUM-25](SCRUM-25.md) | Felicia Or | 22 | Every case automated (unit, integration for the row lock, the warning and flags, the safety check and the permanent notes, e2e for both journeys, the safety check going Outdated and a Confirmed event's registration and notes) |
| [SCRUM-27](SCRUM-27.md) | Jin Hong | 18 | Written with the story; every case automated. TC-27-18 added by SCRUM-229 |
| [SCRUM-28](SCRUM-28.md) | Jin Hong | 13 | Written with the story; every case automated. TC-28-12 and TC-28-13 added by SCRUM-227 |
| [SCRUM-31](SCRUM-31.md) | Jun Bin | 11 | Written from the acceptance criteria and existing tests; every case automated, TC-31-04 and -09 through SCRUM-155's |
| [SCRUM-32](SCRUM-32.md) | Jin Hong | 6 | Written with the story; every case automated |
| [SCRUM-34](SCRUM-34.md) | Felicia Or | 22 | Every case automated (unit, integration for the database's hours check, the migration converting existing hours, opening hours and retirement refusing requests, holds and approvals, and two retirements at once, e2e for both journeys and the detail page's 404) |
| [SCRUM-36](SCRUM-36.md) | Caylern Goh | 9 | Automated; a real screen-reader pass is manual |
| [SCRUM-37](SCRUM-37.md) | Caylern Goh | 7 | Every case automated |
| [SCRUM-38](SCRUM-38.md) | Felicia Or | 21 | Every current case automated (unit, integration for occupied periods and opening hours against real rows, e2e for the journeys); TC-38-19 retired before merge, a date alone is searched as the whole day (TC-38-04) |
| [SCRUM-40](SCRUM-40.md) | Felicia Or | 11 | Every case automated (unit, integration for the one-per-event judgement and the advisory rule, e2e for the journey and the venue detail view); the search-results half of AC 1–AC 4 and AC 7 is SCRUM-38's TC-38-09 |
| [SCRUM-41](SCRUM-41.md) | Jin Hong | 18 | Every case automated (unit, integration for the lock, index and rejection, e2e for both journeys); AC 8's cancellation half is SCRUM-82's TC-82-04 |
| [SCRUM-45](SCRUM-45.md) | Jin Hong | 13 | Every case automated; AC 6, AC 9, AC 10 and the Lead's assignment are notices SCRUM-82, SCRUM-128, SCRUM-21 and SCRUM-165 send |
| [SCRUM-48](SCRUM-48.md) | Jin Hong | 15 | Every case automated |
| [SCRUM-50](SCRUM-50.md) | Caylern Goh | 16 | Every case automated |
| [SCRUM-52](SCRUM-52.md) | Caylern Goh | 6 | Every case automated |
| [SCRUM-53](SCRUM-53.md) | Caylern Goh | 9 | Every case automated; AC 3 and AC 10 point to other cases |
| [SCRUM-81](SCRUM-81.md) | Jun Bin | 13 | Every case automated (unit, integration for the simultaneous confirm, e2e for the journey) |
| [SCRUM-110](SCRUM-110.md) | Jun Bin | 15 | Every case automated (unit, and e2e for the page); AC 3 is superseded by SCRUM-170 AC 4 (TC-110-01 and TC-110-09 note it) |
| [SCRUM-108](SCRUM-108.md) | Jun Bin | 14 | Every current case automated (unit, e2e for both journeys); AC 6, 8 and 10 point to existing tests; TC-108-06 superseded by SCRUM-165 and TC-108-07 by SCRUM-135 |
| [SCRUM-134](SCRUM-134.md) | Jin Hong | 6 | Written with the story; every case automated |
| [SCRUM-135](SCRUM-135.md) | Jun Bin | 12 | Every case automated (unit for the lifecycle table and every action asking it, integration for a repeated transition recorded once and a reassignment leaving the status alone, e2e through SCRUM-165's Lead queue and assigned-events journeys) |
| [SCRUM-121](SCRUM-121.md) | Jin Hong | 5 | Written with the story; every case automated |
| [SCRUM-124](SCRUM-124.md) | Jin Hong | 11 | Every case automated (unit, integration); the unavailability notices are SCRUM-161's and the safety check's SCRUM-166's own tests |
| [SCRUM-126](SCRUM-126.md) | Jun Bin | 10 | Every case automated (unit, integration for the constraint, migration and simultaneous clicks, e2e for the journey) |
| [SCRUM-130](SCRUM-130.md) | Felicia Or | 12 | Every case automated (unit, integration, e2e) |
| [SCRUM-117](SCRUM-117.md) | Jun Bin | 10 | Every case automated (unit, integration for releasing arrangements in one transaction, e2e for both journeys) |
| [SCRUM-163](SCRUM-163.md) | Jin Hong | 17 | Every case automated; TC-163-13's cancel and flag halves are SCRUM-82's and SCRUM-161's tests |
| [SCRUM-142](SCRUM-142.md) | Jin Hong | 19 | Every case automated (unit, integration for what each change writes and two withdrawals at once, e2e for the Coordinator's journeys) |
| [SCRUM-191](SCRUM-191.md) | Jin Hong | 6 | A Bug task: the suites that raced each other, and the docs; automated except TC-191-06, a documentation check |
| [SCRUM-193](SCRUM-193.md) | Jin Hong | 2 | A Bug task: the tests that timed out alongside other files; automated except TC-193-02, a forced timeout |
| [SCRUM-189](SCRUM-189.md) | Jun Bin | 2 | A Chore task: the long e2e journeys marked slow, and the SCRUM-24 test's browsers always closed; TC-189-01 needs three CI runs, TC-189-02 is manual |
| [SCRUM-201](SCRUM-201.md) | Jin Hong | 1 | A Bug task: TC-124-02 used another suite's equipment; automated (the whole suite) |
| [SCRUM-187](SCRUM-187.md) | Jun Bin | 3 | A Bug task: the clarification answer form stuck on "Sending…"; automated by e2e (TC-187-03 by SCRUM-108's TC-108-10) |
| [SCRUM-155](SCRUM-155.md) | Jin Hong | 17 | Every case automated (unit, integration for all-or-nothing and the races, e2e for the journey). TC-155-17 added by SCRUM-226 |
| [SCRUM-156](SCRUM-156.md) | Jin Hong | 8 | Every case automated; TC-155-16 retired and the SCRUM-31 reserve cases mapped to SCRUM-155 |
| [SCRUM-190](SCRUM-190.md) | Felicia Or | 10 | Every case automated (unit, e2e for the form); supersedes SCRUM-13 AC 1 and TC-13-09 step 3 |
| [SCRUM-161](SCRUM-161.md) | Felicia Or | 17 | Every current case automated; TC-161-08 to TC-161-11 retired with former AC 5 and AC 6; supersedes TC-37-05 step 1 and TC-37-06 |
| [SCRUM-159](SCRUM-159.md) | Jun Bin | 19 | Every case automated (unit, integration for the database's range and the simultaneous approvals, e2e for the calendar and the request form); AC 1's form is SCRUM-34's and AC 3's search SCRUM-38's |
| [SCRUM-170](SCRUM-170.md) | Felicia Or | 13 | Every case automated (unit, integration for the No equipment needed decision racing a new request, e2e for the Organiser's answers on each form and review queue); TC-170-12 and TC-170-13 are automated by SCRUM-25's, SCRUM-128's and SCRUM-38's tests |
| [SCRUM-171](SCRUM-171.md) | Felicia Or | 10 | Every case automated (unit, integration for registering, editing and the change-request decision against real rows, e2e for browsing and an older request) |
| [SCRUM-131](SCRUM-131.md) | Felicia Or | 11 | Every case automated (unit for every status name and the checklist badge, e2e for the Organiser's Sent tab and status filter and the Needs Reconsideration badge beside a booking and a reservation, integration for the safety check keeping the event in Planning); AC 6 is SCRUM-85's TC-85-06 |
| [SCRUM-132](SCRUM-132.md) | Felicia Or | 10 | Automated except two reviews (e2e for every AC 1 page at 360 px, AC 2's five timings and AC 3's desktop view; unit for AC 4's date messages); TC-132-09's confirmation audit and TC-132-10's README check are manual |
| [SCRUM-172](SCRUM-172.md) | Jin Hong | 20 | Integration and unit; TC-172-15 step 3 is manual, and TC-172-16 is the whole suite |
| [SCRUM-26](SCRUM-26.md) | Jun Bin | 15 | Every case automated (unit, integration for blocking, Still stands against real unavailability and simultaneous cancels, e2e for the journey); AC 1's warning screen is SCRUM-25's |
| [SCRUM-70](SCRUM-70.md) | Hann Qian | 10 | Every case automated (unit for each role and the counts, e2e for the Organiser's and the Coordinator's view); AC 6 points to the withdraw action's not-found test |
| [SCRUM-77](SCRUM-77.md) | Hann Qian | 9 | Every case automated (unit for the start cut-off and the history entry, e2e for the Attendee's, Organiser's and Coordinator's view); AC 1, 2, 5 and 7 came with SCRUM-74 |
| [SCRUM-82](SCRUM-82.md) | Jun Bin | 16 | Every case automated (unit, integration for releasing everything at once, simultaneous cancels and completion, e2e for cancelling, Overdue and Completed); AC 2's cancellation by change request is SCRUM-128's TC-128-07 |
| [SCRUM-128](SCRUM-128.md) | Jun Bin | 17 | Every case automated (unit, integration for all-or-nothing, flags, cancellation and simultaneous decisions, e2e for approving, rejecting, approving a cancellation and failed loads or sends); AC 10's attendee notices are SCRUM-85's tests and AC 11's No half SCRUM-171's |
| [SCRUM-166](SCRUM-166.md) | Jun Bin | 17 | Every case automated (unit, integration for one check per event, simultaneous officers, flags and Outdated, e2e for both journeys); "No equipment needed" as a complete Equipment item is SCRUM-170's TC-170-06 to TC-170-08 |
| [SCRUM-162](SCRUM-162.md) | Hann Qian | 14 | Every case automated (unit for the checklist, the bookings list and the form, integration for several venues, the same venue again, the covering period, separate decisions and simultaneous requests, e2e for the form); AC 5's releases are SCRUM-82's and SCRUM-117's tests |
| [SCRUM-164](SCRUM-164.md) | Hann Qian | 6 | Automated (unit, integration for the direct call, e2e for the Lead's sign-in and refusals) except TC-164-06, a document check; the Lead's own work (TC-164-05) is SCRUM-165's, SCRUM-21's and SCRUM-141's tests |
| [SCRUM-165](SCRUM-165.md) | Hann Qian | 14 | Every case automated (unit, integration for two Leads at once, e2e for the journey); AC 1's Lead notice is SCRUM-124's tests, AC 7's real multi-role case SCRUM-121's, and AC 8's all-events list SCRUM-141's |
| [SCRUM-141](SCRUM-141.md) | Hann Qian | 11 | Every case automated (unit, e2e for each role's view, the Lead's filters and refusals); AC 3's reassign and AC 4's reassignment are SCRUM-21's tests |
| [SCRUM-85](SCRUM-85.md) | Hann Qian | 9 | Every case automated (unit for each notice and view, integration for confirming again and registering twice at once, e2e for the re-planning journey); AC 4 and AC 12's cancellation was built and tested with SCRUM-82 |
| [SCRUM-21](SCRUM-21.md) | Hann Qian | 11 | Every case automated (unit for the permission rule and every refusal, integration for two Leads at once, e2e for the Lead's reassignment, the previous Coordinator's read-only view and the Organiser's view) |
| [SCRUM-160](SCRUM-160.md) | Jun Bin | 13 | Every case automated (unit, integration for flagging through SCRUM-34's venue edit against real bookings and the seed, e2e for the Venue Staff list) |
| [SCRUM-188](SCRUM-188.md) | Felicia Or | 6 | Every case automated (unit for the period and the server's boundary, integration for search and the request agreeing against real bookings, e2e from the form and from venue search); supersedes TC-50-15's rounding |
| [SCRUM-186](SCRUM-186.md) | Jin Hong | 8 | Every case automated (unit for the check under the event's lock, integration for each active status, the Rejected and Cancelled boundary, simultaneous submissions and legacy requests, e2e for the Approved request shown); AC 3 is SCRUM-142's tests and AC 5's checklist and reserving SCRUM-110's and SCRUM-156's |
| [SCRUM-202](SCRUM-202.md) | Jun Bin | 3 | A Bug task: a venue edit deadlocking with a booking decision; automated (unit for the retry, integration for a forced deadlock and a real race) |
| [SCRUM-207](SCRUM-207.md) | Caylern Goh | 24 | Part of the story: AC 2, AC 3 and the shared confirmation automated (unit for the shared badge and empty states, e2e for the submit and approve pop-ups), and the customer's page-by-page changes automated (TC-207-11 to TC-207-24); TC-207-01, -02, -09 and -10 (AC 1, AC 4 across every page, AC 5) are still to do, marked Manual |
| [SCRUM-208](SCRUM-208.md) | Caylern Goh | 20 | Every case automated (unit for the Next step, the tab chosen, the progress and the stat strips, e2e for the page, its link and tabs, the answer box, not found, the phone layout, the Attendee page and the live view); the panels' own rules stay with their stories' tests |
| [SCRUM-209](SCRUM-209.md) | Caylern Goh | 13 | Every case automated (unit for who is offered Find a venue and the equipment actions, and the Next step's sections; e2e for the venue round trip, equipment in place, No equipment needed, the safety check, and the read-only and refused views); the actions' own refusals stay with their stories' tests |
| [SCRUM-210](SCRUM-210.md) | Caylern Goh | 9 | Every case automated (unit for each role's groups, single-link groups, permission changes, Notifications, the pinned landing pages and several roles; e2e for each role's landing page and menu, collapsed, expanded and on a phone) |
| [SCRUM-211](SCRUM-211.md) | Caylern Goh | 12 | Every case automated (unit for the shared columns, sort, filter, search, Requested and next item; integration for each queue's Decided list, including holds that were released or expired; e2e for every queue's list, decisions, next item, refusals, need-to-know and phone layout). AC1 as reworded with the PO's approval on 27 Oct |
| [SCRUM-225](SCRUM-225.md) | Jin Hong | 5 | A Chore task: the GLM review skipped with a passing check on its quota or rate limit; automated by unit tests except TC-225-05, a document check |
