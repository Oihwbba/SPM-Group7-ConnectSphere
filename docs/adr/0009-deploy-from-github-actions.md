# ADR 0009 — Deploy production from GitHub Actions, not Vercel's Git integration

Stories: none; a team decision about deploying.

## Context

The project runs on Vercel's Hobby plan from a private repository. On Hobby,
Vercel's Git integration deploys a commit only when its git author is the
account owner; the plan does not support collaboration on private
repositories. A squash merge credits the pull request's author, so every
teammate-authored merge left production blocked (#4, #11, and the integration
work around #52–#54).

The workaround was to re-land each teammate's work in a pull request authored
by Jin Hong, with their commits credited through `Co-Authored-By`. It kept
production deploying, but every merge depended on one person, and teammates
could not ship their own work.

## Decision

`.github/workflows/deploy.yml` deploys every push to `main` with the Vercel CLI
and a token belonging to the account owner (the repository secret
`VERCEL_TOKEN`): `vercel pull`, `vercel build --prod`, then
`vercel deploy --prebuilt --prod`. The job removes `.git` before deploying, so
the deployment carries no commit author and is attributed to the token's
owner. The commit SHA is still recorded as deployment metadata.

`vercel.json` turns Vercel's own Git deployments off entirely, so the workflow
is the only path to production and a blocked duplicate deploy cannot appear.

## Alternatives rejected

- **Keep re-authoring teammates' work.** Works, but every merge waits on one
  person and the history misattributes the author.
- **Vercel Pro.** Supports collaboration, at $20 per member per month.
- **Make the repository public.** Collaboration is free on public repositories,
  but course work may not be allowed in public.
- **Move to Cloudflare.** Next.js 16 runs there only through the OpenNext
  adapter; Prisma needs further setup on the Workers runtime; and a Next.js
  plus Prisma bundle usually exceeds the free plan's size limit. Days of work,
  mid-sprint, to fix what this does in one workflow.

## Consequences

- Teammates can merge their own pull requests and production deploys.
- The token is a secret with deploy rights on the account. It lives only in
  GitHub's secret store and is scoped to the Hobby team; rotating it means
  replacing the secret and re-running the workflow by hand.
- Production no longer shows a Vercel check on the commit. The deploy is the
  workflow run on `main`.
- Preview deployments stay off, as before (PR #22).

## Addendum (2026-10-11) — Corrections from the docs audit (SCRUM-173)

"Production no longer shows a Vercel check on the commit" is out of date.
`deploy.yml` now opens a GitHub deployment and records its result on the
commit, so each deploy shows as a "Production" deployment linking to the
workflow run.
