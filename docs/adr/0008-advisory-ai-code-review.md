# ADR 0008 — An advisory AI code review on every pull request

## Context

Five developers open pull requests and one person (Jin Hong) reviews and merges
them. Reviews so far have repeatedly caught the same classes of problem late:
an unauthenticated `"use server"` action, an existence leak through a
not-found/forbidden difference, inline date formatting, hard-coded colours, and
tests that only exercise a mock. A first-pass automated review on every PR
catches those before the human review, and every teammate benefits without
needing their own API key (SCRUM-88).

CONTRIBUTING.md requires a team decision and an ADR for any dependency beyond
the agreed stack. This adds two, both CI-only and not shipped in the app: the
`alibaba/open-code-review` GitHub Action and the
`@alibaba-group/open-code-review` CLI it installs.

## Decision

`.github/workflows/ai-review.yml` runs OpenCodeReview against **GLM-5.3**
(BigModel / Zhipu, `open.bigmodel.cn`) on every non-draft pull request and
posts inline comments plus one summary comment that is updated in place.

- **Advisory, never a gate.** It is not a required status check. `build-and-test`
  remains the only merge gate, and a human still reviews and merges. The review
  step also sets `continue-on-error: true`, so a rate limit, exhausted quota,
  LLM timeout or action bug shows as a warning instead of a red check on every
  PR. The trade-off: a broken key or endpoint is also only a warning, so a PR
  that gets no summary comment is the signal that the reviewer is failing.
- **Pinned.** The action is pinned to the v1.12.0 commit SHA and the CLI to
  `1.12.0`, so neither can change underneath a job that holds the API key.
- **Secret handling.** The key is the repository secret `ZHIPU_API_KEY`. The
  workflow uses `pull_request`, not `pull_request_target`, so PR code is never
  run with the secret in a privileged context. With no secret configured, the
  job skips instead of failing.
- **Our conventions, not generic ones.** `.opencodereview/rule.json` carries
  this project's rules (ADRs 0004, 0006, 0007, CONTRIBUTING.md) and restates
  the built-in correctness and security checks, because a project rule replaces
  the built-in rule for the files it matches.
- **Thinking mode.** The action's default request body disables thinking.
  BigModel documents that GLM-5.3's thinking is forced on, so the workflow
  sends `thinking: enabled` explicitly.

## Alternatives rejected

- **Make it a required check.** An LLM outage, quota exhaustion or a wrong
  comment would block merges. Rejected.
- **`pull_request_target`**, as the action's own example uses. It exposes the
  secret to fork PRs and is unnecessary here because every branch lives in this
  repository. Rejected.
- **A floating tag (`@v1` / `@main`).** No `v1` tag exists, and `@main` lets
  upstream change the code that receives our key. Rejected in favour of a SHA.
- **A hand-written curl-to-LLM script.** Less code to trust, but no inline
  line-anchored comments, no incremental posting and no rule matching. Rejected.

## Consequences

- Every PR diff is sent to a **third-party LLM provider** (BigModel). The team
  must be told, and nothing secret belongs in a diff.
- Each push to an open, non-draft PR costs API quota on the owner's key.
  Superseded runs are cancelled, and drafts are skipped.
- Comments are suggestions. A reviewer or author may dismiss one with a reason;
  a comment is not a defect until a human agrees.
- Upgrading the action means changing the SHA and `ocr_version` together.
- `llm_reasoning_effort` is intentionally not set: BigModel's documentation
  does not list a `reasoning_effort` parameter for GLM-5.3, so sending one
  could fail the request. Revisit once a run confirms whether it is accepted.

## Addendum (2026-09-14) — one reviewer, one call; replaces the Copilot review

This supersedes the OpenCodeReview decision above.

**Why it changed.** OpenCodeReview reviews each file separately, and each file
review is a multi-step agent. On #13 it made 20 tool calls (file finds, code
searches, reads), each a further GLM round trip resending the conversation: 2
small files cost 199k tokens and 12 minutes. On #14 a request timed out after
300 seconds with no response, and on #15 the review ran past 16 minutes. The
team wants one reviewer that reads the whole pull request once, not a thorough
per-file audit.

**Decision.**

- `.github/scripts/ai-review.mjs` sends the **whole PR diff** to GLM-5.3 in
  **one streamed call**, with `.github/ai-review/instructions.md` (the
  project's review rules) as the system prompt. `*.md`, lockfiles and
  `docs/backlog/**` are skipped.
- GLM returns JSON findings, and the script posts **one PR review**: a summary,
  plus a findings table whose `file:line` locations link straight to inline
  comments on the changed lines. The review sits in the Conversation timeline
  like a Copilot review.
- No third-party action and no npm packages: Node's built-in `fetch` only. That
  removes the pinned-action and CLI dependencies recorded above.
- **Replaces Copilot.** Copilot was auto-requested by a personal Copilot
  setting, not by this repo, and was failing on quota; each developer turns
  that setting off.
- **Failures are visible.** If GLM errors, times out or returns unusable output,
  the script posts a review saying the review did not complete, with a link to
  the run. It always exits 0, so the check never goes red: advisory, never a gate.

**Trade-offs.**

- One call cannot open other files or search the codebase, so issues that only
  show up across files the PR doesn't touch are less likely to be caught.
- A diff over 120,000 characters is truncated, and the review says so.
- A finding whose line GitHub won't accept for an inline comment stays in the
  table with its detail, without a link.

## Addendum (2026-09-14, later) — one long review comment; red check on critical or high

This supersedes the review format and failure policy in the addendum above.

**Why it changed.** The team found inline comments hard to navigate: reading a
finding meant jumping from the table to a comment thread in the diff. They want
the review written like an AI review in the editor, fully readable in one place,
and they want serious findings to be visible from the checks list.

**Decision.**

- **One long review, posted as a PR comment** in the Conversation tab and
  **updated in place on every push**, so each pull request has exactly one
  current review. It contains a verdict, an overview, a findings-at-a-glance
  table, and a section per finding: severity, title, a **"Where:"** reference
  that links to the exact line of the PR head's code, the explanation, and a
  suggested fix. **No inline comments.**
- **Four severities:** critical, high, medium, low.
- **The check fails (red) when any finding is critical or high.** The script
  exits 1 after posting the review. The check is still **not a required
  status check**, so it never blocks the merge button: `build-and-test`
  remains the only merge gate, and a human decides whether to fix the finding
  or accept it.
- **A GLM or GitHub API failure stays green.** The comment says the review did
  not complete and links to the run. A provider outage must not turn every PR
  red.
- Model-supplied text is normalised before rendering: titles are collapsed to
  one line, table cells escape `|`, and code suggestions use a fence longer
  than any backtick run inside them, so the review's formatting can't break.

**Trade-offs.**

- A red check can be a false positive, because GLM decides severity. That is
  why the check is not required: it draws attention, and a human rules.
- References link to lines rather than sitting on the diff, so a reader clicks
  through to see the surrounding code.

## Addendum (2026-09-14, latest) — project and story context; the reviewer runs from the base branch

**Why it changed.** The reviewer saw only the diff and a short summary of the
team's rules. It could not check a change against CONTRIBUTING.md or
CLAUDE.md in full, and it could not tell which user story a pull request was
for, so it could not say whether the story's acceptance criteria were delivered.

**Decision.**

- **Context sent to GLM** besides the diff:
  - the pull request's title, description and branch name
  - `CONTRIBUTING.md` and `CLAUDE.md` in full, as the team's authoritative
    rules, each capped at 20,000 characters
  - the `docs/backlog/SCRUM-<n>.md` story file for every SCRUM key found in the
    branch name, title or description (at most 6)
  - `README.md` and the ADRs are not sent: most of the README is setup, and the
    ADR rules the reviewer needs are already stated in its instructions
- **Acceptance criteria.** GLM reports every criterion of each story as met,
  partial, missing or unclear, with evidence, and the review shows them as a
  table. A missing criterion becomes a finding only when the pull request
  claims to deliver the story or the code contradicts it, because a pull request
  may deliver part of a story on purpose.
- **Trust boundary: everything comes from the base branch.** The review
  script, its instructions, CONTRIBUTING.md, CLAUDE.md and the story files are
  all read from the pull request's base commit, not its head. A pull request
  therefore cannot edit the reviewer that holds the API key, loosen the rules
  it is judged by, or rewrite its own acceptance criteria.
- **Locations are checked against the diff.** A finding links to an exact line
  only when that line is in the diff; otherwise it links to the file, or shows
  plain text marked "not in the diff". A made-up location is never presented as
  verified.

**Trade-offs.**

- **Changes to the reviewer apply after merge.** A pull request that edits the
  script, its instructions, CONTRIBUTING.md or a story file is still reviewed
  with `main`'s version.
- **Each review sends more tokens:** roughly 8–15 thousand extra, depending on
  how many stories the pull request names.
- **Story files are Jira snapshots.** If they are out of date, the acceptance
  check is too.

## Addendum (2026-09-14, final) — a required merge gate on critical findings

This supersedes "advisory, never a gate" above. Teammates now merge their own
pull requests, so the checks have to hold the line instead of a person.

**Decision.**

- **`main` requires a pull request and two green checks:** `build-and-test`
  (typecheck, lint, unit tests and the Playwright e2e suite) and `review` (this
  GLM review), on a branch that is up to date with `main`. No approval is
  required, so a teammate can merge once both are green. The repository owner
  can still bypass the rules.
- **Only critical findings fail the review.** A high finding is still listed
  first and should be fixed, but it doesn't block. A required check that fails
  on one model's judgement of "high" would stop teammates on a false positive
  that only the owner could override.
- **No review, no merge.** If no review can be completed, the check turns red
  and the comment lists why each attempt failed. The same applies to a missing
  API key and to a crash in the reviewer. A pull request can never merge
  without a review. The trade-off: during a BigModel outage nothing merges
  until the job is re-run or the owner merges as admin.
- **Why a review could fail, and the retry.** GLM-5.3 always thinks before it
  answers, and the answer starts only when the thinking ends. A replay of PR
  #22 used 44–48K thinking tokens and 10+ minutes, then wrote a ~1K-token JSON
  answer in its last 8 seconds. The original run most likely stopped while
  still thinking (its stop reason wasn't recorded then), returned an empty
  answer, and the reviewer counted that as passed. A probe then found the root cause: the request set no
  `reasoning_effort`, and GLM-5.3's default thinks as much as `max` (145
  thinking tokens on a small question, against 143 at `max`, 27 at `high` and
  19 at `low`). Reviews now ask for `high`, the level the team chose. The
  reviewer also asks for up to 100K output tokens, records why GLM stopped and
  how many tokens it used, and treats any stop other than a finished answer as
  a failure. It then retries once at `low`, which is far less likely to be cut
  off. Both attempts share a 27-minute
  budget inside the job's 30-minute timeout.
- **Why some reviews take 3 minutes and others 15.** The time is thinking
  tokens divided by BigModel's speed at that moment, and both vary. A small
  change to tests thinks briefly (PR #21: 180s), while a change to the review
  gate itself makes GLM deliberate for tens of thousands of tokens, at between
  about 40 and 75 tokens a second.

## Addendum (2026-09-14, test coverage and UI checks)

**Decision.**

- **The reviewer sees every existing test.** Besides the diff, GLM gets each
  test file under `tests/` and `e2e/` at the pull request's head, with its kind
  and its describe and test titles (at most 15,000 characters). Before this, a
  criterion already tested outside the diff was reported as missing, as on #21
  and #24.
- **An explicit test checklist:** unit tests for new logic, including the
  permission-denied and invalid-input cases; integration tests against a real
  database for locks, transactions and counted pools; and a Playwright spec with
  a success path and a failure path for each new page or journey.
- **UI checks, as far as code shows them:** loading, empty and error states,
  labelled controls, pending feedback, keyboard-reachable controls, and layouts
  that work at phone width. GLM can't see the page, so visual design isn't
  reviewed.
- **A "Tested by" column** in the acceptance table names the unit, integration
  and e2e tests for each criterion.
- **Story keys come only from the branch name, the title, and description lines
  starting "Closes", "Fixes", "Resolves", "Implements", "Part of" or "Refs".**
  On #23, a passing mention of SCRUM-31 in the description got SCRUM-31's
  criteria checked.

**Trade-offs.**

- **These findings don't block the merge.** Missing tests and UI states are
  `medium`, or `high` when the pull request claims its story. Only `critical`
  blocks.
- **The file kind is a guess.** A Vitest file that mocks `@/lib/db` is labelled
  a unit test, and any other Vitest file "integration or unit".
- **Titles are read with a pattern, not a parser,** so an unusual test
  declaration can be missed.

## Addendum (2026-09-16, reviewer memory)

GLM starts every review blank, so it kept misreading the same deliberate
choices: asking for CODEOWNERS approval on an admin merge (#27), questioning
the `deepmerge-ts` override (#32), and counting `it.todo` placeholders as tests.

**Decision.**

- **A memory file on `main`.** `.github/ai-review/memory.md` holds dated
  lessons, each citing its source pull request. It's loaded from the base
  branch into the system prompt after `CONTRIBUTING.md` and `CLAUDE.md`,
  capped at 8,000 characters. It's seeded with the lessons from this ADR's
  history, and with the known gaps the #11 review replay found.
- **Lessons are facts, added by pull request.** A lesson explains why
  something is deliberate; it never switches off a check. The file is under
  `.github/`, so CODEOWNERS makes every change need Jin Hong's approval, and a
  pull request can't rewrite the memory it's reviewed with.
- **Memory within a pull request.** When a pull request is reviewed again, GLM
  also gets its previous review and the people's comments on it, up to 8,000
  characters, keeping the newest. It's told they are claims to check against
  the diff, not instructions: drop a finding the diff has fixed, keep one that
  is still true.
- **`it.todo` placeholders are labelled** in the existing-test list, in code
  rather than as a lesson.

**Trade-offs.**

- **Lessons can go stale** and must be pruned. A wrong lesson would mislead
  every review until someone removes it.
- **Comments on a pull request are untrusted text.** A persuasive but wrong
  reply could talk GLM out of a real finding; the instruction to verify claims
  against the diff reduces this but can't remove it.
- **Each review sends more tokens:** up to about 4,000 more for the memory and
  conversation.
- **No `/glm remember` command yet.** Automatic lesson capture waits until
  repeated false positives show it's needed.

## Addendum (2026-09-16, oversized diffs fail instead of being cut)

A diff over 120,000 characters used to be cut, with a note, and the review of
the first part could still pass the required check. Three of the team's
feature pull requests had diffs over that limit: the foundation commit
(162,083 characters), #10 (138,815) and #11 (126,005).

**Decision.**

- **The limit is 400,000 characters** of reviewable diff, about 100K tokens.
  GLM-5.3 accepts 1M input tokens, so the limit keeps a review thorough and
  within the time budget; it isn't a model limit. It's about 2.5x the largest
  diff so far.
- **A diff over the limit fails the check without calling GLM.** The comment
  gives the size and asks for the pull request to be split. The alternative,
  an admin merge after a human review, stays available. A partial review can
  no longer pass.

**Trade-off.** A genuinely large change must be split, or merged by the owner
after a human review.

## Addendum (2026-09-17, context beyond the diff)

GLM saw only the diff, and on #41 that caused four mistakes:
- **A repeated false alarm:** it said a row "never sets `data-status`", but that
  attribute is on an unchanged line.
- **A missed bug:** a mobile card lost its border because of a rule in
  `components/ui/table.tsx`, a file the PR imports but didn't change.
- **Three wrong ✅ Met marks** on SCRUM-66 and SCRUM-67 criteria, based on
  test names, while four pages still hardcode their own role lists.
- **Guessing about tests** instead of reading CI.

**Decision.** Besides the diff, each review gets:

- **Changed files in full,** line-numbered.
- **Related files in full:** the repo files a changed file imports, the files
  that import a changed file, and files naming the PR's SCRUM keys. Changed
  files have a 250,000-character budget; related files share 150,000, filled in
  that order. A file that doesn't fit is listed, not silently dropped.
- **A project rule scan** of the whole branch: role checks outside
  `lib/auth/can.ts`, hard deletes, and inline date formatting. It's a text
  search, so it finds every match.
- **CI results for the same commit.** The review waits up to 15 minutes for
  `build-and-test`, then reads each step's result and the coverage of the lines
  the PR added. GLM's 27-minute budget starts after the wait, and the job
  timeout is 50 minutes.

The instructions change with it:
- **Met needs direct evidence:** code that implements the criterion, or a test
  whose title checks that exact criterion.
- **Codebase-wide criteria** are Met only if the rule scan and the files show
  it holds everywhere.
- **Findings stay about this PR.** Problems in untouched code go in the
  overview.

**Trade-offs.**

- **Reviews start later and take longer:** CI's time (about 3 minutes), plus a
  larger prompt. #41's context was about 230,000 characters.
- **Coverage is partial:** it only measures the files the coverage
  configuration includes, and e2e runs aren't measured.
- **Some relevance isn't found:** code that relates to a story but neither
  imports the changed files nor names the story key isn't selected, unless the
  rule scan finds it.

**Also: reviews use the GLM Coding Plan address (owner's decision).** The
reviewer called the general `/api/paas/v4` address, which bills the
pay-as-you-go balance. When that balance ran out, every review failed with
BigModel error 1113 while the owner's Coding Plan quota sat unused. It now calls
`/api/coding/paas/v4`. The owner chose this knowing the risk: BigModel limits
the Coding Plan to its listed coding tools (Claude Code, Cline, OpenCode and
others), and a custom GitHub Actions script isn't one of them. BigModel may
refuse these calls or restrict the plan. If it does, every review fails and the
required check blocks merges. The fallback is to switch back to `/api/paas/v4`
with a topped-up balance.
- **Every edit re-runs the review.** A skipped job counts as a passing required
  check and replaces an earlier red result on the same commit, so edits are no
  longer skipped. Drafts still are, and a draft can't be merged.
- **CODEOWNERS guards the gate.** A `pull_request` run uses the pull request's
  own workflow files, so a pull request could edit `ci.yml` or `ai-review.yml`
  to pass. Changes under `.github/`, to `package.json`, the Playwright and
  Vitest configs, or `vercel.json` need the owner's approval.
- **No Vercel preview deployments.** `vercel.json` sets
  `git.deploymentEnabled` to `{"**": false, "main": true}`. The preview check
  failed on every teammate's pull request (the Hobby plan blocks deploys of
  commits by non-members), and previews wrote to the production database.
  Production still deploys from `main`.

## Addendum (2026-09-17, weakened tests)

On #41 an isolation e2e check changed from `getByText` on the whole page to
`getByRole("cell")`, so it no longer caught the other organiser's event shown
anywhere outside a table cell. The review didn't notice: it looks for missing
tests, and a weakened test still exists.

**Decision.** The script lists every run of lines in a test file that removes a
test or an assertion, next to the lines that replaced it, plus every added
`.skip`, `.only`, `.fixme` or `.todo`. GLM must account for each one: moved,
replaced by an equal or stronger check, or weakened. A weakened check is a
`medium` finding, or `high` when it guards security, data isolation or a
claimed criterion.

**Trade-offs.** It's small: about 2,300 characters (~600 tokens) on #41, capped
at 20,000. It's a text match, so an assertion rewritten without removing a line
that looks like one isn't listed, but it still appears in the diff.

The first version missed a locator narrowed on its own line inside an unchanged
multi-line `expect(`, and counted `.toString()` as an assertion (#43's own
review). A block now also counts when it removes a locator, or when the
unchanged lines just before it are inside an `expect(` that hasn't ended; those
lines are shown with it. Matchers are named in full, and skips come first so
the cap cuts blocks, not skips.

## Addendum (2026-09-17, failing test output)

The review knew a CI step had failed but not why, so it guessed from the diff.
When `build-and-test` fails, the script now downloads the failed job's log and
extracts each failed step's output: from Vitest's "Failed Tests" report or
Playwright's first numbered failure when present, otherwise the end of the
output, where compilers and npm print errors. Each step is capped at 6,000
characters and all of them at 12,000, and a passing run adds nothing.

## Addendum (2026-09-21, context budget)

Files were being dropped from reviews while the model sat far below its limit.
The note called them "over the size limit", but no file in the repo exceeds the
60,000-character per-file cap: the largest is 47,700. What ran out was the
*combined* budget — 250,000 characters for changed files, 150,000 for related
ones. #54 dropped `tests/unit/events.test.ts`, a file that pull request
changed, after it overshot by 1,656 characters, and then judged that pull
request's test coverage without it. #52, #53 and #57 lost 10, 3 and 7 related
files.

There was room to spare: reviews use 95,000-168,000 tokens and GLM-5.3 accepts
1,000,000.

**Decision.**

- **A changed file is never dropped** while the budget can still hold its
  floor — about fifty of them. If it does not fit, the head of it is sent, down
  to a floor of 8,000 characters, and a file that is shortened leaves the ones
  behind it in the diff their own floor. The review judges exactly those files,
  so most of one beats none of it.
- **The seed goes in when the diff touches `e2e/`.** An e2e test can only
  assert what `prisma/seed.ts` writes. #53 hard-coded one of two seeded
  coordinators and broke CI; the reviewer had no way to see that.
- **Budgets raised to 400,000 and 300,000 characters**, not to the model's
  limit. A much longer prompt makes a model less precise about specific lines,
  and precision is what this review is for. With these numbers, #54 and #57
  lose nothing.
- **The wording is honest:** the review names each file that did not fit the
  budget, instead of implying the file was too big.

**Trade-off, and how it is checked.** More context is not automatically a
better review. The claim is tested, not assumed: a pull request carrying the
seven planted bugs of #37 is re-reviewed after this change, and the budgets are
dialled back if the reviewer stops finding them.
