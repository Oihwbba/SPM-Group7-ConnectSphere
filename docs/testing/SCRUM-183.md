# SCRUM-183 — SCRUM-18's clarification.spec.ts fails intermittently: test cases

SCRUM-183 is a Chore task in Jira, created on 14 Oct 2026: "Fails
intermittently, need to make the e2e test more reliable." It has no further
acceptance criteria; this chore reads it as: the spec passes first time in CI,
with nothing in it that depends on timing.

Format and conventions: [README.md](README.md).

**What CI shows:** `e2e/clarification.spec.ts` didn't fail or need a retry in
any of the CI runs from 5 to 24 Oct (about 460 runs, every branch), and it
takes 8–11 s, far from the 30-second limit. So the failures the chore records
weren't in CI; they were most likely local runs, which have no retry and run
against a busier machine. Nothing in CI pins down the cause.

**What was still fragile, and changed:** the journey opened a dialog, typed
into it and closed it with Escape without waiting for it, then moved on. On
a slow run a step could act on a dialog still opening or closing. Since
SCRUM-208 (#275) the event details are a page rather than a dialog, so only
the Ask dialog is left: the second Ask now waits for it to open before
typing, and for it to be gone after Escape. The test is named with the cases
it automates: TC-18-01, TC-18-03, TC-18-05 and TC-18-07.

**Shared pre-conditions:** a local PostgreSQL migrated with `npm run db:deploy`
and seeded with `npm run db:seed`, as in CI's `build-and-test`.

| ID | Type | Criterion | Automated |
|---|---|---|---|
| [TC-183-01](#tc-183-01) | Positive | The spec passes first time | e2e (the whole suite, in CI) |

---

### TC-183-01

| Item | Content |
|---|---|
| Test Case ID | TC-183-01 |
| Test Scenario | [Positive] the clarification journey passes on its first attempt in CI |
| Pre-conditions | — |
| Test Steps | 1. Run `build-and-test` on the pull request. |
| Test Data | — |
| Expected Result | "SCRUM-18 [AC1, AC2, AC4, AC5, AC6] TC-18-01, TC-18-03, TC-18-05, TC-18-07: …" passes with no "(retry #1)" line in the e2e log. |

**Automated by:** `e2e/clarification.spec.ts`, in the whole suite in `build-and-test`.
