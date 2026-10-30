# SCRUM-216 — Chore: Epic check for SCRUM-9 Access Control: test cases

Story and acceptance criteria: [docs/backlog/SCRUM-216.md](../backlog/SCRUM-216.md).
Format and conventions: [README.md](README.md).

**Shared pre-conditions for every case:** the database is migrated and seeded
(`npm run db:deploy && npm run db:seed`), the app is running, and every seeded
account signs in with `Password123!`.

The epic's children are SCRUM-65, 66, 67, 68, 69, 70, 121, 141 and 164.
SCRUM-153 is marked NOT NEEDED, and SCRUM-120 is beyond Release 1. The check
was run on 29 October 2026; its per-story table, its role × page matrix and
every finding are in pull request #311. The cases below are what was checked
and what proves each criterion. Those that depend on Jira are Manual.

| ID | Type | Criterion | Automated |
|---|---|---|---|
| [TC-216-01](#tc-216-01) | Positive | AC 1 | Manual (Jira) |
| [TC-216-02](#tc-216-02) | Positive | AC 2 | Manual (the citation check), Unit |
| [TC-216-03](#tc-216-03) | Positive | AC 3 | e2e |
| [TC-216-04](#tc-216-04) | Negative | AC 3 | Integration, e2e |
| [TC-216-05](#tc-216-05) | Positive, Negative | AC 3 | e2e |
| [TC-216-06](#tc-216-06) | Positive | AC 4 | Manual (Jira) |
| [TC-216-07](#tc-216-07) | Positive | AC 5 | Manual (Jira) |

---

### TC-216-01

| Item | Content |
|---|---|
| Test Case ID | TC-216-01 |
| Test Scenario | [Positive] AC 1: every child story is Done and was accepted by the Product Owner of its sprint |
| Pre-conditions | Access to the SCRUM project in Jira. |
| Test Steps | 1. Open epic SCRUM-9 and list its children. <br> 2. For each, read its status and its sprint's acceptance record. |
| Test Data | SCRUM-65, 66, 67, 68, 69, 70, 121, 141, 164 |
| Expected Result | Every child is Done and accepted, except SCRUM-120 (beyond Release 1) and SCRUM-153 (not needed). |

**Automated by:** Manual (Jira; the repository holds no acceptance record).

### TC-216-02

| Item | Content |
|---|---|
| Test Case ID | TC-216-02 |
| Test Scenario | [Positive] AC 2: every Done child has its criteria in docs/backlog and its test cases in docs/testing, and each case cites a test that exists |
| Pre-conditions | — |
| Test Steps | 1. For each child, open `docs/backlog/SCRUM-n.md` and `docs/testing/SCRUM-n.md`. <br> 2. Check that every criterion has at least one case. <br> 3. For every "Automated by", check that the file exists and that the cited title is in it. |
| Test Data | The nine children above |
| Expected Result | Every child has both files and a case for every criterion. Every cited file exists and contains its title: titles cited in full appear verbatim (titles a test builds in a loop are checked as built), and a title cited as its start followed by "…" starts a test in that file, as the template in README.md allows. A case marked Manual is a test still to be written, or a check outside the code. |

**Automated by:** Manual: the citation check run on 29 October 2026 over all nine children (results in pull request #311; every citation valid). The one manual case it found, TC-164-06, is now automated: `tests/unit/product-context.test.ts` › "SCRUM-164 [AC5] TC-164-06: the product overview lists all seven roles" and "SCRUM-164 [AC5] TC-164-06: the overview has a row for every role the app has, so a new role can't be left out".

### TC-216-03

| Item | Content |
|---|---|
| Test Case ID | TC-216-03 |
| Test Scenario | [Positive] AC 3: each role signs in to its own home page, and its menu shows only what its role allows |
| Pre-conditions | — |
| Test Steps | 1. Sign in as each seeded role, and as the multi-role account. <br> 2. Read the landing page and every menu link. |
| Test Data | `organiser@`, `coordinator@`, `venuestaff@`, `techsupport@`, `attendee@`, `lead@`, `safety@`, `multirole@test.local` |
| Expected Result | Each role lands on its own list, and its menu has exactly the pages its permissions allow (`lib/auth/can.ts`). The multi-role account sees every page of every role it holds, once. Notifications are reached from the bell, not the menu. |

**Automated by:** `e2e/access-control.spec.ts` › "SCRUM-65 [AC1, AC3] TC-65-01, SCRUM-66 [AC1, AC2, AC3] TC-66-01: Organiser sees only /events" and the same test for the Coordinator, Venue Staff, Tech Support and Attendee; `e2e/coordinator-lead-role.spec.ts` › "SCRUM-164 [AC1, AC4] TC-164-01: the seeded Lead signs in, lands on its home page, and its menu shows only what the role allows"; `e2e/multiple-roles.spec.ts` › "SCRUM-121 [AC1, AC2] TC-121-01, TC-121-02: the navigation has every role's pages once, and the user menu names every role". The role × page sweep in pull request #311 checked all ten accounts by hand.

### TC-216-04

| Item | Content |
|---|---|
| Test Case ID | TC-216-04 |
| Test Scenario | [Negative] AC 3: a role is refused what it may not do, by direct URL or direct call, and a refusal writes nothing |
| Pre-conditions | — |
| Test Steps | 1. As an Organiser, type the URL of a page for another role. <br> 2. As another Organiser, list events and open the first Organiser's. <br> 3. Call a Server Action as every role that may not use it. <br> 4. As the multi-role account, approve the venue booking of an event it coordinates. |
| Test Data | `organiser@`, `organiser2@`, `multirole@test.local`; `createDraftEvent` for every role but Organiser |
| Expected Result | The page is refused by the server; another Organiser's event is neither listed nor openable, and reads like one that doesn't exist; each direct call is refused and the database is unchanged; the multi-role approval is refused and the request stays pending. |

**Automated by:** `e2e/access-control.spec.ts` › "SCRUM-67 [AC3] TC-67-04: an Organiser is refused the staff-only venues page (/venues)" and the same test for the venue search, bookings and equipment pages; `e2e/events.spec.ts` › "SCRUM-68 [AC1, AC5] TC-68-01, SCRUM-84 [AC1] TC-84-01: enforces ownership isolation: organiser2 sees only their own events"; `e2e/all-events.spec.ts` › "SCRUM-141 [AC1] TC-141-11: a draft or a missing id is a real 404"; `tests/integration/permission-guard.test.ts` › "refuses %s directly and leaves the database unchanged" (each of six roles); `e2e/multiple-roles.spec.ts` › "SCRUM-121 [AC5] TC-121-05: approving the venue booking of an event it coordinates is refused, and the request stays pending".

### TC-216-05

| Item | Content |
|---|---|
| Test Case ID | TC-216-05 |
| Test Scenario | [Positive, Negative] AC 3: signing in and out works end to end, and a wrong sign-in reveals nothing |
| Pre-conditions | — |
| Test Steps | 1. Sign in with a wrong password, then with an unknown email. <br> 2. Sign in correctly, sign out, and open a protected page. |
| Test Data | `organiser@test.local`, `nobody@test.local` |
| Expected Result | Both wrong sign-ins get the same refusal. After signing out, the protected page sends you to sign in. |

**Automated by:** `e2e/auth.spec.ts` › "SCRUM-65 [AC2] TC-65-02: a wrong password is refused", "SCRUM-65 [AC2] TC-65-02: an unknown email gets the same refusal (no account enumeration)" and "SCRUM-65 [AC4, AC5] TC-65-04: signing out makes protected pages unreachable again"

### TC-216-06

| Item | Content |
|---|---|
| Test Case ID | TC-216-06 |
| Test Scenario | [Positive] AC 4: every open child is in Sprint 4 or labelled beyond-release-1, and new stories are linked to the right epic |
| Pre-conditions | Access to the SCRUM project in Jira. |
| Test Steps | 1. List SCRUM-9's open children. <br> 2. Read each one's sprint and labels. |
| Test Data | SCRUM-120 |
| Expected Result | SCRUM-120 carries the beyond-release-1 label with its reason; no other child is open. |

**Automated by:** Manual (Jira).

### TC-216-07

| Item | Content |
|---|---|
| Test Case ID | TC-216-07 |
| Test Scenario | [Positive] AC 5: once only beyond-release-1 children are left, the epic is Done, with a comment listing them as future work |
| Pre-conditions | TC-216-01 and TC-216-06 pass, and pull request #311 is merged. |
| Test Steps | 1. Open SCRUM-9. |
| Test Data | SCRUM-9 |
| Expected Result | SCRUM-9 is Done, with a comment naming SCRUM-120 as future work. |

**Automated by:** Manual (Jira; the Product Owner closes the epic).
