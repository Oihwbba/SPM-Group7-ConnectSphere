# Definition of Done

This is the Definition of Done the team already works to. It is gathered
from [CLAUDE.md](../../CLAUDE.md), [CONTRIBUTING.md](../../CONTRIBUTING.md)
and the [pull request template](../../.github/pull_request_template.md), not
written new.

**A story is Done when it is merged, CI is green on `main`, and the Product
Owner has accepted it** (CLAUDE.md, "Board discipline"). Each item below says
where it is written down and what enforces it. "Review" means the item is
checked by a person or by the GLM reviewer, not by a machine that blocks the
merge.

## The story

| # | Done means | Written in | Enforced by |
|---|---|---|---|
| 1 | Every acceptance criterion in `docs/backlog/SCRUM-n.md` is covered by a test, or the PR says plainly that it is still to do. | CONTRIBUTING.md, "Before you open a pull request"; the PR template's "Acceptance criteria → tests" table | Review. The GLM reviewer reads the story's backlog file and posts an acceptance-criteria table ([instructions](../../.github/ai-review/instructions.md)). |
| 2 | `docs/testing/SCRUM-n.md` lists the story's test cases, each naming the test that automates it, or **Manual**. | CONTRIBUTING.md; [docs/testing/README.md](../testing/README.md) | Review. The GLM reviewer reads each case's "Automated by" line, and a citation of a test that no longer exists is a finding. |
| 3 | Each test is named after what it proves: `SCRUM-n [ACx] TC-n-xx: …`. | CLAUDE.md; CONTRIBUTING.md, "Tests" | Review. [tests/unit/story-keys.test.ts](../../tests/unit/story-keys.test.ts) fails CI on a cited story key that is missing from `docs/backlog`, or retired without saying what replaced it. |
| 4 | Expected values come from the criteria, both sides of every boundary are tested, a refused action is shown to write nothing, and breaking the code turns a test red. | CLAUDE.md, "How to work on a story"; CONTRIBUTING.md, "Tests" | Review. A weakened or removed test is a GLM finding. |
| 5 | Who did what and when is recorded through the audit log. | [docs/product-context.md](../product-context.md) | Review |

## The code

| # | Done means | Written in | Enforced by |
|---|---|---|---|
| 6 | Type-check, lint, and unit and integration tests pass, with **100% statement, branch, function and line coverage on every server-side file** under `lib/` and `app/`. | CONTRIBUTING.md, "Coverage" | CI: the `build-and-test` job in [.github/workflows/ci.yml](../../.github/workflows/ci.yml), a required check on `main`. Coverage is `thresholds: { 100: true, perFile: true }` in [vitest.config.mts](../../vitest.config.mts). |
| 7 | The end-to-end tests pass. | CONTRIBUTING.md, "What runs on every pull request" | CI: the same `build-and-test` job runs Playwright after the unit tests. |
| 8 | Every Server Action checks permission first, through `can()` / `requirePermission()`. There are no inline role checks. | CONTRIBUTING.md, "Rules that are code-review rejections"; ADR 0004 | Review. The GLM reviewer scans the branch for role checks outside `can()`. |
| 9 | Status changes are conditional on the status read (ADR 0006). Counted pools are checked under `SELECT … FOR UPDATE`, locking the event, then the request, then equipment by id (ADR 0007). | CONTRIBUTING.md, "Security and data" | Review, and integration tests against a real Postgres where a story needs them. |
| 10 | No hard deletes, no edited migrations, and an index on every foreign key you filter by. | CONTRIBUTING.md | Review. The GLM reviewer scans for hard deletes. |
| 11 | Loading, empty and error states exist; form controls are labelled; buttons are disabled while pending; pages work at phone width. Dates are shown only through `lib/datetime.ts`. | CONTRIBUTING.md, "UI" and "Conventions cheat-sheet" | Review, and the e2e specs for the journeys. The GLM reviewer scans for inline date formatting. |
| 12 | No hard-coded colours and no new dependencies outside the agreed stack. | CONTRIBUTING.md, "Rules that are code-review rejections" | Review |

## Getting it merged

| # | Done means | Written in | Enforced by |
|---|---|---|---|
| 13 | The branch, every commit and the PR title carry the story's SCRUM key, and the PR description says `Closes SCRUM-n`. | CLAUDE.md, "Jira ↔ GitHub"; the PR template | Review. Jira's GitHub integration links the work to the story only when the key is present. |
| 14 | The change reaches `main` only through a pull request, and the branch is up to date with `main` when it merges. | CONTRIBUTING.md, "Branch → pull request → merge" | Branch protection on `main`: a PR is required and the branch must be up to date ("strict"). |
| 15 | The GLM review finds no critical issue. | CLAUDE.md; CONTRIBUTING.md, "The GLM review"; ADR 0008 | The `review` check in [.github/workflows/ai-review.yml](../../.github/workflows/ai-review.yml). It has not been a required check since 16 Oct 2026: the reviewer's quota ran out, and `main` was set to require `build-and-test` alone. The review is still read before merging when it runs. Making it required again, after the quota resets on 25 Oct, is pending. |
| 16 | Changes to `.github/`, `package.json`, the test configs or `vercel.json` are approved by a teammate. | CLAUDE.md; CONTRIBUTING.md | [CODEOWNERS](../../.github/CODEOWNERS) and branch protection |
| 17 | The PR description says what changed, how it was verified and what actually ran. | CLAUDE.md, "How to work on a story", step 5; the PR template's "How I verified it" | Review |

## After the merge

| # | Done means | Written in | Enforced by |
|---|---|---|---|
| 18 | CI is green on `main`, and `main` deploys to production with pending migrations applied first. | CLAUDE.md, "Board discipline" | [.github/workflows/deploy.yml](../../.github/workflows/deploy.yml) runs on every push to `main` (SCRUM-179). |
| 19 | The story's backlog file matches Jira. | CLAUDE.md, "Check your work against the story" | A re-sync of `docs/backlog` (for example SCRUM-221) |
| 20 | **The Product Owner accepts the story** and moves it to Done in Jira. Opening a PR moves it only to In Review. | CLAUDE.md, "Board discipline"; CONTRIBUTING.md | The Product Owner, in Jira |

How the team checks the Definition of Done at the sprint review, and what
happens to a story that misses it: _To be completed by the team._ One known
case is in [Sprint 1's record](sprint-1.md): SCRUM-114 finished tests three
stories lacked at that sprint's close.
