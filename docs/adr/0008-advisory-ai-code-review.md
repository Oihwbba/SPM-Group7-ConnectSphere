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
