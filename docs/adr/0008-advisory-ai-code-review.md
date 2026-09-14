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

## Addendum (2026-09-14) — replaces the Copilot review; findings made direct

- **Replaces Copilot.** GLM-5.3 is the team's automated PR reviewer. Copilot
  was being auto-requested by a personal Copilot setting, not by this repo,
  and was failing on quota; each developer turns that setting off.
- **Findings in the review itself.** OpenCodeReview posts a PR review whose
  body is only a hidden marker, so its findings were hard to find. A follow-up
  step writes a findings table into that review: severity, a `file:line` link
  straight to each inline comment, and a one-line gist. The review sits in the
  Conversation timeline like a Copilot review. When a run posts no review, the
  same table goes into one sticky comment instead.
- **Failures are visible, not silent.** The review step uses
  `continue-on-error`, so without this a failure would show only as a green
  check. The findings step reports "this run's review did not complete" on
  the PR, with a link to the run.
- **Longer timeouts.** The default 300-second request timeout failed #14:
  GLM-5.3, with forced thinking, sent no response headers within 5 minutes.
  A successful two-file review on #13 took about 12 minutes and 199k tokens.
  Requests now get 900 seconds, each file 30 minutes, and the job 60 minutes.
- **Why it was slow, and the speed fixes.** A review is an agent loop: #13
  made 20 tool calls (file finds, code searches, reads), each a further GLM
  round trip resending the conversation, so 2 small files cost 147k input
  tokens. Three changes cut that without lowering `effort: high`:
  - `stream: true` in the request body, so a response starts as soon as GLM
    begins answering instead of after all its thinking.
  - `review_concurrency: 1`, one agent at a time instead of 8 parallel requests
    queueing on one key.
  - `**/*.md` excluded in `.opencodereview/rule.json`, so docs, ADRs and
    backlog files aren't sent for AI review.
