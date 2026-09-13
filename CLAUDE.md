# CLAUDE.md — working agreement for ConnectSphere

Read this at the start of every session in this repo. It is how our five-person
team keeps the Jira board accurate and the history traceable. Follow it without
exception. Feature-level conventions (how to add a feature, what gets a PR
rejected) live in `CONTRIBUTING.md`; this file is about process and traceability.

## Jira ↔ GitHub: every change carries a SCRUM key

The repo is linked to Jira, which scans branch names, commit messages and PR
titles for a work-item key (e.g. `SCRUM-65`) and attaches the work to that
story. **A change without a key is invisible to Jira and effectively
undocumented**, and that linkage is graded evidence. So, without exception:

- **Branch — one per story, key first:**
  `SCRUM-65-sign-in`, `SCRUM-67-server-side-permission-guard`
- **Commit — key, then an imperative summary:**
  `SCRUM-65 add credentials sign-in with role on session`
  Never `wip`, never `fix stuff`, never a bare key with no summary. A commit
  that genuinely spans two stories is two commits.
- **Pull request — key in the title:** `SCRUM-65 Sign in to the system`.
  In the description, say what changed and how you verified it, and reference
  the story with `Closes SCRUM-65`.

If the right key for a change is not obvious, ask before starting.

## Check your work against the story, not just against the code

Every story's acceptance criteria are mirrored in the repo at
`docs/backlog/<KEY>.md` — the same key that is already in your branch name:

```
branch SCRUM-19-approve-reject  ->  docs/backlog/SCRUM-19.md
```

Read yours before you start, and again before you open the PR. Every
criterion should be covered by a test, or visibly still to do — a PR that
silently drops one is the failure this file exists to prevent. Reviewers
check the same file, so make it easy for them: name tests after the criterion
they cover.

**Jira is the source of truth; these files are a generated snapshot.** Never
edit them by hand — fix the story in Jira and re-sync. If a file disagrees
with Jira, Jira wins and the sync is overdue. The index at
`docs/backlog/README.md` records when it was last synced.

## Board discipline

- Columns: **To Do → In Progress → In Review → Done.**
- Opening a PR moves the story to **In Review**, not Done.
- **Done** = merged **and** CI green **and** the Product Owner has accepted it.
- **Never commit to `main`. Never merge your own PR** — Jin Hong reviews.
- A story is not finished until its tests pass in CI.

## AI transparency

Keep the `Co-Authored-By: Claude ...` trailer on AI-assisted commits — our
module requires us to be transparent about AI assistance.

## Facts about this repo you cannot infer (they cost hours)

1. **Auth.js's Credentials provider cannot use database sessions.** Sessions are
   JWT (`session.strategy = "jwt"`); `id` and `role` are carried on the token
   and typed onto the session. See `auth.config.ts` and ADR 0002.
2. **`"There was a problem with the server configuration"`** at startup means a
   missing `AUTH_SECRET`. Every required variable is documented in
   `.env.example`.
3. **Supabase needs two database URLs** — a pooled one for the app and a direct
   one for migrations, both through the session pooler. See `.env.example` and
   the traps section of `CONTRIBUTING.md`.
4. **The password lives in `User.passwordHash`** (our addition to the Auth.js
   model), hashed with bcrypt in the seed.

## Where the shared conventions live

- **How to add a feature / PR-rejection rules:** `CONTRIBUTING.md`
- **Authorisation — the single gate:** `lib/auth/can.ts`. Never write an inline
  role check (`if (session.user.role === …)`) in a feature.
- **Acceptance criteria, story by story:** `docs/backlog/` (index:
  `docs/backlog/README.md`)
- **Data model & story→table map:** `docs/data-model.md`, `prisma/schema.prisma`
- **Architecture decisions:** `docs/adr/`
- **Setup, seed accounts, run commands:** `README.md`

## Do not

- Don't build features that belong to another story or teammate this sprint.
- Don't add libraries beyond the agreed stack.
- Don't invent an abstraction until something is repeated three times.
- Don't add comments that restate the code.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
