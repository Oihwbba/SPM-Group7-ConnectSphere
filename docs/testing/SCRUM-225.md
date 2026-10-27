# SCRUM-225 — Skip the GLM review with a green check when GLM's quota or rate limit stops it: test cases

SCRUM-225 is a Chore task in Jira. Its "Done when" list is read here as five
criteria, in its order:

- **AC 1:** a quota refusal (HTTP 429, code 1310) posts a "review skipped"
  comment and exits green, without a second attempt.
- **AC 2:** a rate-limit refusal (HTTP 429, code 1302) is waited out and
  retried within the time budget, and skipped green if it never clears.
- **AC 3:** every other failure still posts "did not complete" and fails.
- **AC 4:** unit tests cover each. This is the file you are reading, and the
  tests it cites.
- **AC 5:** `ai-review.yml`, `CONTRIBUTING.md`, `CLAUDE.md` and an ADR 0008
  addendum say so.

Format and conventions: [README.md](README.md).

**Where the behaviour lives:** `.github/scripts/ai-review.mjs`.
`askGlmPatiently` turns a 1310 or 1302 refusal into a `GlmUnavailableError`
and waits out the rate limit. `attemptReview` runs the high-effort attempt,
then the low-effort retry, and stops at the first `GlmUnavailableError`.
`unreviewedOutcome` decides what `main()` posts and its exit code when there
is no review. `main()` only wires these to GitHub and to `process.exitCode`.

**Shared pre-conditions:** none. Every case is a unit test with GLM and the
clock replaced by stubs, so no network call, key or wait is made.

| ID | Type | Criterion | Automated |
|---|---|---|---|
| [TC-225-01](#tc-225-01) | Positive | AC 1 | unit |
| [TC-225-02](#tc-225-02) | Boundary | AC 2 | unit |
| [TC-225-03](#tc-225-03) | Negative | AC 3 | unit |
| [TC-225-04](#tc-225-04) | Positive | AC 1, AC 2 | unit |
| [TC-225-05](#tc-225-05) | Positive | AC 5 | Manual (a document check) |

---

### TC-225-01

| Item | Content |
|---|---|
| Test Case ID | TC-225-01 |
| Test Scenario | [Positive] AC 1: a used-up quota skips the review at once and passes the check |
| Pre-conditions | GLM answers every call with HTTP 429 and code 1310. |
| Test Steps | 1. Run the review's attempts. <br> 2. Work out what is posted and the exit code. |
| Test Data | `{"error":{"code":"1310","message":"您已达到每周/每月使用上限，您的限额将在 2026-10-25 14:23:41 重置。"}}` |
| Expected Result | The error is a quota refusal carrying the reset time `2026-10-25 14:23:41`. GLM is called once, at high effort, with no wait and no low-effort retry. The comment is the "review skipped" comment, not "did not complete"; the log line is a `::warning::`; the exit code is 0. When GLM answers instead, the review is returned and nothing is skipped. |

**Automated by:** `tests/unit/ai-review.test.ts` ›
- "SCRUM-225 [AC1] TC-225-01: HTTP 429 with code 1310 is a used-up quota, carrying the reset time"
- "SCRUM-225 [AC1, AC2] TC-225-01, TC-225-02: no wait runs past the deadline, and a used-up quota is never waited out"
- "SCRUM-225 [AC1] TC-225-01: a used-up quota ends the attempts at once, with no second, low-effort attempt"
- "SCRUM-225 [AC1] TC-225-01: without a review because of the quota, the skip comment is posted and the check exits 0"
- "SCRUM-225 [AC1, AC2] TC-225-01, TC-225-02: when GLM answers, the review is returned and nothing is skipped"

### TC-225-02

| Item | Content |
|---|---|
| Test Case ID | TC-225-02 |
| Test Scenario | [Boundary] AC 2: the rate limit is waited out within the deadline, and a limit that never clears skips the review and passes |
| Pre-conditions | GLM answers with HTTP 429 and code 1302, then either answers or keeps refusing. |
| Test Steps | 1. Refuse twice, then answer. <br> 2. Refuse every call. <br> 3. Refuse with the deadline 60 seconds away and a 30-second wait: a wait is taken only if it still leaves 8 minutes for the next call. <br> 4. Fail the first attempt for another reason, then refuse the low-effort retry on the rate limit. |
| Test Data | `HTTP 429 {"error":{"code":"1302", …}}`; waits of 30, 60 and 120 seconds, each randomised to between the wait and twice it (the script's own waits are 30, 60, 120 and 240) |
| Expected Result | 1. The review goes ahead with GLM's answer after two waits: the first between 30 and 60 seconds, the second between 60 and 120. <br> 2. After the last wait the call is given up as the rate limit, with no reset time. <br> 3. GLM is called once and nothing is waited. <br> 4. GLM is called twice, high then low; the result is the rate limit, the comment says "GLM's rate limit kept refusing the call", and the exit code is 0. |

**Automated by:** `tests/unit/ai-review.test.ts` ›
- "SCRUM-225 [AC2] TC-225-02: HTTP 429 with code 1302 is the rate limit, with no reset time"
- "SCRUM-225 [AC2] TC-225-02: the rate limit is waited out, and the review goes ahead once GLM answers"
- "SCRUM-225 [AC2] TC-225-02: a rate limit that outlasts every wait is given up on, as the rate limit"
- "SCRUM-225 [AC1, AC2] TC-225-01, TC-225-02: no wait runs past the deadline, and a used-up quota is never waited out"
- "SCRUM-225 [AC2] TC-225-02: a rate limit that never clears, even after a first attempt failed for another reason, skips the review and exits 0"

### TC-225-03

| Item | Content |
|---|---|
| Test Case ID | TC-225-03 |
| Test Scenario | [Negative] AC 3: any other failure still posts "did not complete" and fails the check |
| Pre-conditions | GLM fails for a reason other than codes 1310 and 1302. |
| Test Steps | 1. Refuse with HTTP 429 carrying another code, with HTTP 500 carrying code 1310, and with HTTP 401. <br> 2. Fail both attempts with HTTP 500 and then HTTP 502. <br> 3. Fail the first attempt with too little of the time budget left for a retry. |
| Test Data | 1. `429 {"error":{"code":"1113","message":"insufficient balance"}}`, `500 {"error":{"code":"1310"}}`, `401 unauthorised` <br> 2. `HTTP 500 boom`, `HTTP 502 bad gateway` <br> 3. A 1-second budget against a 60-second minimum for a retry |
| Expected Result | 1. Each refusal is an ordinary failure, not a skip: `GLM request failed: HTTP <status> <body>`. <br> 2. The comment says "❌ **The review did not complete** for commit `abc1234`" and lists `attempt 1: …` and `attempt 2: …`; the log line is an `::error::`; the exit code is 1. <br> 3. GLM is called once, the failures say `no retry: only 0 minute(s) of the time budget were left`, and the exit code is 1. |

**Automated by:** `tests/unit/ai-review.test.ts` ›
- "SCRUM-225 [AC3] TC-225-03: any other refusal still fails the review, a 429 with another code included"
- "SCRUM-225 [AC3] TC-225-03: any other failure on both attempts leaves no review, posts did not complete with each failure, and fails the check"
- "SCRUM-225 [AC3] TC-225-03: with too little of the budget left, there is no retry, and the check fails"

### TC-225-04

| Item | Content |
|---|---|
| Test Case ID | TC-225-04 |
| Test Scenario | [Positive] AC 1, AC 2: the skip comment says why, until when, and that `build-and-test` still gates the merge |
| Pre-conditions | — |
| Test Steps | 1. Render the skip comment for a quota refusal with a reset time. <br> 2. Render it for the rate limit, and for a quota refusal with no reset time. |
| Test Data | Reset time `2026-10-25 14:23:41`; model `glm-5.3`; commit `abc1234def5678` |
| Expected Result | 1. The comment says "⏭️ **Review skipped** for commit `abc1234`: the GLM quota is used up until 2026-10-25 14:23:41 (UTC+8), so this check passed without a review.", "`build-and-test` still has to pass before merging." and "re-run the **GLM Code Review** job after the reset". It is not read as a review of that commit. <br> 2. The rate-limit comment says "GLM's rate limit kept refusing the call, after every wait, so this check passed without a review." and "re-run the **GLM Code Review** job later". A quota refusal with no reset time says "the GLM quota is used up, so this check passed without a review." |

**Automated by:** `tests/unit/ai-review.test.ts` ›
- "SCRUM-225 [AC1] TC-225-04: a skipped review says why, until when, and that build-and-test still gates the merge"
- "SCRUM-225 [AC1, AC2] TC-225-04: a rate-limit skip, and a quota with no reset time, say so without inventing one"

### TC-225-05

| Item | Content |
|---|---|
| Test Case ID | TC-225-05 |
| Test Scenario | [Positive] AC 5: the workflow and the team's documents describe the skip |
| Pre-conditions | — |
| Test Steps | 1. Read `.github/workflows/ai-review.yml`, `CONTRIBUTING.md` ("The GLM review"), `CLAUDE.md` ("Board discipline") and ADR 0008's SCRUM-225 addendum. |
| Test Data | — |
| Expected Result | Each says that a quota or rate-limit refusal skips the review with a passing check, that any other failure still fails it, and that `build-and-test` remains the gate. |

**Automated by:** Manual (a document check, done in review of #288).
