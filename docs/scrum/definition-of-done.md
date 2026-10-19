# Definition of Done

A story is **Done** when it is merged to `main`, CI is green on `main`, and
the Product Owner has accepted it (CLAUDE.md, "Board discipline"). Opening a
pull request moves it to In Review, not Done.

This page collects what the team already works to, from CLAUDE.md,
CONTRIBUTING.md, the pull request template and CI, and says what enforces each
rule. "CI" means the required `build-and-test` check; "GLM" the required GLM
review (`.github/ai-review/`), which blocks a pull request on a critical
finding; "Reviewer" a teammate reading the pull request; "PO" the Product
Owner at acceptance.

## The story

| Rule | Enforced by |
|---|---|
| Every acceptance criterion in `docs/backlog/SCRUM-n.md` is covered by a test, or the pull request says plainly that it is still to do | GLM (its criteria-to-tests table), Reviewer |
| `docs/testing/SCRUM-n.md` lists the test cases, at least one positive case per criterion and a negative or boundary case for each rule, and names the test that automates each | GLM (it reads the document and flags a cited test that no longer exists), Reviewer |
| Each test is named `SCRUM-n [ACx] TC-n-xx: what must happen` | GLM, Reviewer |
| Who did what and when is recorded in the audit log | Reviewer, tests |
| A document the code now contradicts is fixed in the same pull request, or flagged | Reviewer (CLAUDE.md, "Sources of truth") |
| The Product Owner has accepted it | PO, recorded in the sprint's page in `docs/scrum/` |

## The code

| Rule | Enforced by |
|---|---|
| Typecheck and lint pass | CI |
| Unit, integration and end-to-end tests pass against a fresh PostgreSQL, migrated and seeded from nothing (ADR 0005) | CI |
| Every server-side `.ts` file under `lib/` and `app/` keeps 100% statement, branch, function and line coverage; components (`.tsx`) are covered by Playwright instead | CI (`vitest.config.mts`, `perFile: true`) |
| Tests take expected values from the criteria, assert that a refused action wrote nothing, and test both sides of each boundary | Reviewer, GLM |
| Every exported Server Action checks permission first, through `can()` / `requirePermission()`; no inline role checks | GLM (it scans the branch), Reviewer |
| Something the user isn't related to answers "not found", like something that doesn't exist | Reviewer, tests |
| A status change is conditional on the status read (ADR 0006); counted pools are checked under `SELECT … FOR UPDATE` in the agreed lock order (ADR 0007) | Reviewer, GLM, integration tests |
| No hard deletes, no edited migrations, an index on each filtered foreign key | Reviewer, GLM |
| Dates shown only through `lib/datetime.ts` (Singapore time); colours only through theme tokens | GLM (it scans for inline date formatting), Reviewer |
| Loading, empty and error states; labelled controls; disabled submit while pending; usable at phone width | Reviewer, e2e |

## The change

| Rule | Enforced by |
|---|---|
| Branch, commits and pull request title carry the story's key | Reviewer; Jira shows the work only when they do |
| The pull request follows `.github/pull_request_template.md`: what changed per criterion, criteria to tests, how it was verified | Reviewer, GLM |
| AI-assisted commits keep the `Co-Authored-By: Claude` trailer | Reviewer (CLAUDE.md, "AI transparency") |
| Changes to `.github/`, `package.json`, the test configs, `vercel.json` or `.gitattributes` are approved by a teammate | GitHub (CODEOWNERS) |
| Merged through a pull request; a stacked pull request is retargeted to `main` before merging | GitHub branch protection |
| The merge to `main` deploys: pending migrations are applied to the shared database, then the app is built and deployed (ADR 0009) | `deploy.yml` |
