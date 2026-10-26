# CLAUDE.md — working agreement for ConnectSphere

Read this at the start of every session in this repo. It is how our five-person
team keeps the Jira board accurate and the history traceable, and how an AI
assistant should work here. Follow it without exception.

The other files have the detail: `CONTRIBUTING.md` (how to build a feature,
the pre-PR checklist, what gets a PR rejected), `README.md` (running the app,
seed data, database rules) and `docs/product-context.md` (the product).

## Sources of truth, in order

1. **The course material** in the team's
   [shared Google Drive folder](https://drive.google.com/drive/folders/1G4cNyWOcldw0iawiJfmJ1WbCiy_YZbv0):
   the customer briefing, the Week 4 project instructions (the twenty
   Release 1 features and the rubric) and the customer's Q&A answers. The
   stories already quote the customer where it matters; open the folder only
   when a story doesn't settle a question.
2. **Jira**, for stories, acceptance criteria, sprints and status.
   `docs/backlog/` is a generated snapshot of it.
3. **The code, schema and tests**, for what the system does today. When a
   document and the code disagree, the code is what runs: say so, and fix
   the document in the same PR or flag it.

If sources conflict, don't silently pick one. Name the conflict and the
story it affects, and ask.

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
  The description follows `.github/pull_request_template.md`: what changed
  and how you verified it, with `Closes SCRUM-65`.
- **Work that isn't a story** (docs, tooling) gets a Jira task titled
  `Chore: …` first, and uses its key the same way.

If the right key for a change is not obvious, ask before starting.

## Check your work against the story, not just against the code

Every story's acceptance criteria are mirrored in the repo at
`docs/backlog/<KEY>.md`, and its test cases at `docs/testing/<KEY>.md` — the
same key that is already in your branch name:

```
branch SCRUM-19-approve-reject  ->  docs/backlog/SCRUM-19.md
                                    docs/testing/SCRUM-19.md
```

Read both before you start, and again before you open the PR. Every
criterion should be covered by a test, or visibly still to do — a PR that
silently drops one is the failure this file exists to prevent. Reviewers
check the same files, so make it easy for them: name each test
`SCRUM-n [ACx] TC-n-xx: what must happen`.

**Jira is the source of truth; `docs/backlog/` is a generated snapshot.**
Never edit it by hand — fix the story in Jira and re-sync. If a file
disagrees with Jira, Jira wins and the sync is overdue. The index at
`docs/backlog/README.md` records when it was last synced.

## How to work on a story

1. **Read** the story and test files above, the ADRs that touch the area
   (`docs/adr/README.md` lists them), and the code you will change.
2. **Plan** briefly: the files, the risks, and which test proves each
   criterion. Ask only when a decision blocks a correct implementation.
3. **Build the story end to end** (schema, action, page, tests), copying the
   pattern in `CONTRIBUTING.md`, not layer by layer across stories.
4. **Test as evidence**: expected values come from the acceptance criteria,
   never from running the code; assert that a refused action wrote nothing;
   test both sides of every boundary. Break the code once (drop a lock, flip
   a `>`) and check a test goes red.
5. **Run the checks** before claiming anything works: `npm run verify`, plus
   `npm run test:coverage` and the e2e specs you touched, both against the
   local database (README, "Local database (Docker)"), never `.env`'s shared
   one. Report what actually ran and its result.
6. **Go through "Before you open a pull request"** in `CONTRIBUTING.md`; it is
   the reviewer's own checklist.

## Board discipline

- Columns: **To Do → In Progress → In Review → Done.**
- Opening a PR moves the story to **In Review**, not Done.
- **Done** = merged **and** CI green **and** the Product Owner has accepted it.
- **Never commit to `main`: open a PR.** Merge your own PR once both required
  checks are green: `build-and-test` (including e2e) and the GLM `review`,
  which fails on a critical finding or when no review completes (a PR that
  changes only Markdown, lockfiles or `docs/backlog` isn't reviewed and
  passes, and so does a PR whose review GLM's quota or rate limit stopped:
  the review comment then says it was skipped). Read the GLM
  review before you merge. Changes to `.github/`, `package.json`, the test
  configs, `vercel.json` or `.gitattributes` need a teammate's approval
  (CODEOWNERS lists the whole team), because they control the checks.
- **A stacked PR merges into its base, not `main`.** Retarget it to `main`
  before merging, as soon as the PR it builds on is merged.
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
   the environment traps in `CONTRIBUTING.md`.
4. **The password lives in `User.passwordHash`** (our addition to the Auth.js
   model), hashed with bcrypt in the seed.
5. **`.env` points at the shared Supabase database.** `npm run db:reset` wipes
   it for the whole team, and `npm run db:migrate` (`prisma migrate dev`)
   must never run against it; there, use only `db:deploy` and `db:seed`.
   Reset and migrate only a local Docker database.
6. **Integration tests, the coverage check and e2e need a local Postgres.**
   Start Docker and point the terminal at it first (README, "Local database
   (Docker)"): starting Docker alone leaves `.env` pointing at Supabase.
   Without one the integration tests skip, and `npm run test:coverage` fails
   on files only they cover. Some e2e specs write data without a local-only
   guard.
7. **`next dev` rewrites `next-env.d.ts`.** Don't commit that change.
8. **The GLM reviewer reads `CONTRIBUTING.md` and this file from the PR's
   base branch** (`main` unless the PR is stacked), so editing them in your PR
   doesn't change how that PR is reviewed.

## Where the shared conventions live

- **The product (roles, features, scope, lifecycle):** `docs/product-context.md`
- **How to add a feature, the pre-PR checklist, PR-rejection rules:** `CONTRIBUTING.md`
- **Authorisation — the single gate:** `lib/auth/can.ts`. Never write an inline
  role check (`if (session.user.role === …)`) in a feature.
- **Acceptance criteria, story by story:** `docs/backlog/` (index:
  `docs/backlog/README.md`)
- **Test cases, story by story:** `docs/testing/` (format: `docs/testing/README.md`)
- **Data model & story→table map:** `docs/data-model.md`, `prisma/schema.prisma`
- **Architecture decisions:** `docs/adr/` (index: `docs/adr/README.md`)
- **Setup, seed accounts, run commands:** `README.md`
- **What the AI reviewer checks:** `.github/ai-review/instructions.md`, and
  lessons from past reviews in `.github/ai-review/memory.md`
- **Key diagrams and every Server Action (permission, input, writes, locks):**
  `docs/design/` (the full design pack is a separate team document)

## Do not

- Don't build features that belong to another story or teammate this sprint.
- Don't add libraries beyond the agreed stack.
- Don't invent an abstraction until something is repeated three times.
- Don't add comments that restate the code.
- Don't assume a file, script, column or permission exists because a document
  mentions it; check the code first.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
