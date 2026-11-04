<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-11-04. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-200 - [NOT NEEDED] Decide whether to format the repo with Prettier and check it in CI

| | |
|---|---|
| **Type** | Task |
| **Epic** | - |
| **Priority** | Low |
| **Story points** | - |
| **Status in Jira** | To Do |
| **Sprint** | Backlog |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-200 |

---

**Won't Do.** Prettier was installed with the project scaffold, but it was never part of our agreed stack (README, "Stack"; ADR 0016), our Definition of Done or our CI checks. This ticket's description overstated that. Our enforced quality checks (ESLint, type checks, tests at 100% coverage, e2e and the AI review) ran on every pull request. Prettier only changes layout, not behaviour or structure. Applying it now would rewrite 663 files in one commit and bury the story-by-story history, so we chose not to adopt it.

---

Prettier is in the agreed stack with `npm run format:check`, but 663 files fail it on `main` and CI doesn't run it, so the stated practice isn't sustained. Formatting everything is one large diff that conflicts with every open pull request, so it needs a team decision and a moment with few open PRs. Found by the rubric audit on 2026-10-19.

**Acceptance criteria**

1. The team decides at standup: format once and check in CI, or drop Prettier from the stated stack. The decision and its reason are recorded here.
2. If formatting: one PR formats the repo when few PRs are open, adds `npm run format:check` to CI, and changes nothing but formatting (`git diff --ignore-all-space` shows no change). The `.github/` and `package.json` changes get a teammate's approval (CODEOWNERS).
3. If dropping: README.md, CONTRIBUTING.md and `package.json` no longer claim it.

**Change log**

* 2026-10-19: created from the rubric audit (Felicia).
