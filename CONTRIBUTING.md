# Contributing to ConnectSphere

This is how five of us build features on one codebase without fighting each
other's code. Read it once before your first feature, and again when a
review surprises you.

The golden rule: **favour boring, obvious code.** You have to explain every
line in the oral exam, so no clever abstraction that isn't already earning
its keep.

For the product itself (roles, features, scope, the event lifecycle), see
[`docs/product-context.md`](docs/product-context.md). For running the app,
see the [README](README.md).

---

## The one pattern to copy

Every feature is a variation of the same shape. `app/(app)/events` is the
reference, and `app/(app)/equipment-requests` is a smaller, newer example.

| File | Role |
|---|---|
| `page.tsx` | Server component. Guards the role, fetches the data this user may see, renders it. |
| `loading.tsx` | Skeleton shown while the page fetches (see `equipment-requests/loading.tsx`). |
| `actions.ts` | Server actions: the only place data changes. |
| `queries.ts` | Read functions shared by the page and the tests, when the page's reads are more than one query. Rules several routes share go in `lib/<domain>/`. |
| `*-dialog.tsx`, `*-client.tsx` | Client components: a form that calls an action and shows the result. |
| `lib/schemas/<entity>.ts` | The Zod schema, shared by the form and the action. |
| `components/<domain>/` | Presentational pieces shared across pages, such as `components/events/status-badge.tsx`. |
| `tests/unit/<domain>.test.ts` | Vitest with the database mocked: happy path, invalid input, permission denied. |
| `tests/integration/<domain>.test.ts` | Vitest against a real Postgres, only where correctness depends on the database: row locks, transactions, constraints. |
| `e2e/<journey>.spec.ts` | Playwright: the main journey's success path and at least one failure path. |
| `docs/testing/SCRUM-n.md` | The story's test cases, each pointing at the test that automates it. |

**Coverage.** Every server-side `.ts` file under `lib/` and `app/` must stay at
100% statements, branches, functions and lines. `npm run test:coverage` fails
otherwise, naming the file, and so does CI. It counts unit and integration
tests together, so it **needs the local database**: start Docker and point the
terminal at it first ([README, Local database](README.md#local-database-docker)),
never at `.env`'s shared one. Without it the integration tests are skipped,
and a file only they cover fails the run even if you never touched it. Components (`.tsx`) are not measured;
Playwright covers them (SCRUM-87).

Route folders are named for the **domain**, not the role. A route several
roles use is one folder whose `page.tsx` switches on the user's role (see
`app/(app)/events/page.tsx` and ADR 0001's addendum).

## How to add a feature

Say you're building **Approve or reject a booking request** (SCRUM-53) in
`bookings`.

1. **Read the story.** Open `docs/backlog/SCRUM-53.md`. Write the test cases
   in `docs/testing/SCRUM-53.md` (the format is in `docs/testing/README.md`):
   at least one positive case per acceptance criterion, and a negative or
   boundary case for every rule in it.
2. **Branch.** `git checkout -b SCRUM-53-approve-reject-booking`. If someone
   else is working in the same domain folder this sprint, agree who owns
   `page.tsx` before you both edit it.
3. **Schema.** Add `bookingDecisionSchema` to `lib/schemas/booking.ts`. The
   form and the action both import it, so validation is written once.
4. **Action.** In `bookings/actions.ts`, follow this shape:
   ```ts
   "use server";
   export async function decideBookingRequest(input: unknown): Promise<ActionResult<...>> {
     const session = await auth();
     try {
       requirePermission(session?.user, "booking:decide");
       const parsed = bookingDecisionSchema.safeParse(input);
       if (!parsed.success) return err("…", parsed.error.flatten().fieldErrors);
       // …do the work…
       revalidatePath("/bookings");
       return ok(result);
     } catch (e) {
       if (e instanceof PermissionError) return err(e.message);
       throw e;
     }
   }
   ```
5. **Permission.** If the action isn't in the `Action` union yet, add it to
   `lib/auth/can.ts` and grant it to the right role in `ROLE_ACTIONS`. **Never**
   write a role check anywhere else (see the rules below).
6. **Page.** A server component that guards the role, fetches only what this
   user may see, and renders it, with a real empty state, an error state and a
   `loading.tsx`.
7. **Tests.** Unit tests for the action (happy, invalid, denied); an
   integration test if it relies on locks, transactions or constraints; a
   Playwright spec for the journey. Name each after the criterion it proves
   (see [Tests](#tests)).
8. **Check, then ship.** Go through [Before you open a pull request](#before-you-open-a-pull-request),
   run `npm run verify`, push, and open a pull request.

---

## Before you open a pull request

These are the checks the GLM reviewer applies. Catching them yourself saves a
CI and review round.

**The story**

- [ ] Every acceptance criterion in `docs/backlog/SCRUM-n.md` is covered by a
      test, or the PR says plainly that it is still to do.
- [ ] `docs/testing/SCRUM-n.md` lists the cases and which test automates each.

**Security and data**

- [ ] Every exported `"use server"` function is a public endpoint: its first
      work is `requirePermission()` / `can()`.
- [ ] Loading something the user isn't related to returns the same "not
      found" as something that doesn't exist, so ids can't be probed.
- [ ] A status change is conditional on the status you read (ADR 0006), so
      two people acting at once can't both succeed.
- [ ] Counted pools (registration capacity, equipment quantity) are checked
      under `SELECT … FOR UPDATE` in the writing transaction (ADR 0007). Lock
      in the same order as everywhere else: event, then request, then
      equipment rows by id.
- [ ] No hard deletes, no edited migrations, and an index on any foreign key
      you filter by.

**UI**

- [ ] Loading, empty and error states; never a blank screen.
- [ ] Every form control has a label, icon-only buttons have an accessible
      name, and an error appears next to the field it belongs to.
- [ ] Submit buttons are disabled while pending, and the page works at phone
      width.
- [ ] A `datetime-local` value is converted to a UTC ISO instant in the
      browser before it reaches the server.

**Tests**

- [ ] See [Tests](#tests). If you weaken or remove a test on purpose, say why
      in the PR description.

## Tests

The graders check that tests are **evidence**, not just that they exist.

- **Take expected values from the acceptance criteria**, never from running
  the code. A value copied from the output only confirms what the code
  already does.
- **Ask what wrong implementation would make each test fail.** If nothing
  would, strengthen or delete the test. The surest check: break the code (drop
  a lock, flip a `>`), and the test must go red.
- **Test both sides of every boundary** (equal to the limit and one over;
  periods that touch and periods that overlap).
- **When an action is refused, assert that nothing was written**, not just
  that an error came back.
- **Name every test after what it proves**, using the story key, the
  criterion and the test case:

  ```
  SCRUM-53 [AC2] TC-53-03: a rejection cannot be saved without a reason
  ```

  The reviewer finds your tests by the key, and the graders trace story →
  criterion → test case → test by these titles. Leave out the `TC-` part only
  if the story has no specification yet.

---

## Branch → pull request → merge

`main` is protected. You can't push to it, and a pull request can merge only
when both required checks are green: **`build-and-test`** (including e2e) and
the **GLM review**, which fails on a critical finding (it passes, skipped,
when GLM's quota or rate limit stops it reviewing). Once both pass, merge
your own PR. `main` is what deploys to production and what the graders see,
so it stays green by construction, not by discipline.

### Every change carries a SCRUM key

Jira links work to a story by finding its key. A change without one is
invisible to Jira, and that linkage is graded.

| | Format | Example |
|---|---|---|
| Branch | key first, then a few words | `SCRUM-53-approve-reject-booking` |
| Commit | key, then an imperative summary | `SCRUM-53 refuse a rejection without a reason` |
| Pull request title | key, then the story's name | `SCRUM-53 Approve or reject a booking request` |
| PR description | a `Closes SCRUM-n` line | `Closes SCRUM-53` |

Never commit `wip` or `fix stuff`, or a bare key with no summary. A commit
that spans two stories is two commits. Work that is not a story (docs,
tooling) gets a Jira task first, titled `Chore: …`.

### The flow

```bash
# 1. Branch off an up-to-date main
git checkout main && git pull
git checkout -b SCRUM-53-approve-reject-booking

# 2. Work, then run the checks CI fails on most
npm run verify

# 3. Commit and push
git add -A && git commit -m "SCRUM-53 refuse a rejection without a reason"
git push -u origin SCRUM-53-approve-reject-booking

# 4. Open the pull request (the template asks for the sections reviewers need)
gh pr create

# 5. Merge once both checks are green
gh pr checks
gh pr merge --delete-branch
```

Squash or merge commit are both fine. If you squash, keep the key at the
start of the squashed title.

Opening a PR moves its story to **In Review** in Jira, not Done. A story is
**Done** when it is merged, CI is green on `main`, and the Product Owner has
accepted it.

### Things that will otherwise surprise you

1. **No pull request, no CI.** CI runs on pull requests and on `main`, not on
   other pushes (SCRUM-151). Run `npm run verify` locally until you open one.
   It runs typecheck, lint and unit tests in a couple of minutes, but not the
   integration or e2e tests, so CI can still catch something it didn't.
2. **Your branch must be up to date with `main` to merge.** If someone merges
   first, run `git pull origin main` in your branch and let CI run again. What
   was tested is then exactly what lands.
3. **Stacked pull requests merge into their base, not into `main`.** If your
   PR builds on another unmerged PR, its base is that PR's branch. When the
   first PR merges, change the second PR's base to `main` **before** merging
   it, or it lands in the old branch and never reaches `main` (this happened
   to SCRUM-156: #135 merged into SCRUM-155's branch and needed #137).
   Deleting the first branch on merge makes GitHub retarget it for you.
4. **There are no preview deployments.** Check UI changes with `npm run dev`;
   CI's e2e tests check the key journeys. Only `main` deploys.
5. **Some files need a teammate's approval.** Changes to `.github/`,
   `package.json`, the test configs, `vercel.json` or `.gitattributes` control
   the checks themselves, so CODEOWNERS requires a review from someone other
   than the author. Every team member is a code owner, so any teammate can
   approve.

### What runs on every pull request

| | What happens | Takes |
|---|---|---|
| **GitHub Actions** (`build-and-test`) | migrate → seed → typecheck → lint → unit and integration tests with the coverage check → e2e | 10–20 minutes |
| **GLM review** | one AI reviewer reads the change (except Markdown, lockfiles and `docs/backlog`) and posts one review comment; skipped for drafts, and passes without a review when only those files changed | 5–15 minutes after CI finishes |

Every push re-runs both.

---

## The GLM review

**What you get.** One comment from `github-actions` in the PR's
**Conversation** tab, updated on every push: a verdict, an overview, an
**acceptance criteria** table showing which test covers each criterion, and a
section per finding with a **Where:** link to the line and a suggested fix.
There are no inline comments.

**What blocks.** A **critical** finding turns the check red, and the merge
button stays disabled until you fix it and push. High findings don't block,
but fix them or reply on the PR saying why they don't apply.

**What it reads.**

- Your PR title, description and branch name.
- `CONTRIBUTING.md` and `CLAUDE.md`, and the `docs/backlog` file for each
  SCRUM key in your branch name, your title, or a `Closes`, `Part of`,
  `Fixes` or `Refs` line of your description (at most six stories). It reads
  these from the PR's base branch (`main`, unless the PR is stacked), so
  editing them in your own PR doesn't change your review.
- Your changed files (Markdown, lockfiles and `docs/backlog` excepted), the
  files they import and the files that import them, and any file that
  mentions your SCRUM keys. **Put the key in code
  comments and test titles** so it finds them.
- The `docs/testing` test-case document for each of your stories: each case's
  scenario and its "Automated by" line. A citation of a test title that no
  longer exists (you renamed the test) is a finding.
- When you change the schema or a migration, every `CREATE`, `ALTER` and
  `DROP` line of every migration, so it knows what older migrations created.
- A scan of the whole branch for role checks outside `can()`, hard deletes and
  inline date formatting.
- CI's results for your commit: lines you added that no test ran, and the
  failing tests and their errors when CI fails.
- Every test you removed, changed or skipped, next to what replaced it. A
  check made weaker (a narrower locator, a looser matcher, a deleted test, a
  `.skip`) is a finding.
- Its previous review's findings, the comments on your PR, and
  `.github/ai-review/memory.md` (lessons from past reviews).

**When it's wrong.** Reply on the PR and say why; on the next run it checks
your reason against the code before dropping the finding. Re-running it on
the same commit doesn't clear a finding: it is told the code hasn't changed.
After each merge it proposes lessons for its memory in a pull request from
`ai-review/memory`; read the lesson before approving it. If it keeps
misreading something deliberate, you can also add a dated lesson by hand.

**When it fails to run.** It retries once. If that also fails, the check
turns red and says why: re-run the **GLM Code Review** job from the PR's
Checks tab. The exception is GLM refusing to serve. When its quota is used
up it refuses every call until the reset; when many reviews call at once its
rate limit refuses some, and the review waits and tries again a few times.
If GLM still won't serve, the review is skipped, the comment says why, and
the check passes. Read the diff yourself before merging, or re-run the job
later. A PR whose reviewable diff is over 400,000 characters is not
reviewed and fails the check, so split it.

**Why GLM and not Copilot.** Copilot code review spends Copilot credits,
which are limited, and the team doesn't have them; a required check can't
depend on a quota that runs out. So the team runs its own reviewer on GLM
(ADR 0008). If Copilot still reviews your PRs, turn off automatic Copilot
code review in your personal GitHub settings.

**A caution.** Your diff is sent to BigModel (Zhipu), a third-party
provider, so never put secrets in a diff.

The reviewer's own rules are in `.github/ai-review/instructions.md`, and
ADR 0008 records how it came to work this way.

---

## Rules that are code-review rejections

- **No inline permission checks.** `if (session.user.role === "COORDINATOR")`
  in a feature is rejected. All authorisation goes through `can()` /
  `requirePermission()` in `lib/auth/can.ts` (ADR 0004): add an `Action` and a
  row in the table instead.
- **No hard-coded colours.** No hex, `rgb()`, or Tailwind palette class such
  as `bg-slate-100` in a component. Every colour is a token in
  `app/globals.css`, used through the Tailwind theme, so a rebrand only
  changes the tokens.
- **Actions return `ActionResult`; they don't throw** for expected failures
  such as invalid input or a refused permission. Throw only for real bugs.
- **Schemas are shared.** The form and the action import the same Zod schema.
  Don't validate twice with two different rules.
- **No new dependencies** outside the agreed stack (listed in the README)
  without a team decision and an ADR. No state-management library, no tRPC,
  no generic service or repository layer, and no shared `<DataTable>` (one
  table is not yet a pattern).
- **No comments that restate the code.** Comment the *why*, not the *what*.

## Conventions cheat-sheet

- **Datetimes:** store UTC; display only through `formatDate` /
  `formatDateTime` in `lib/datetime.ts` (Singapore time). Never format a date
  inline.
- **Periods:** use `lib/period.ts`. Periods that touch at an endpoint don't
  overlap.
- **No hard deletes:** a lifecycle change is a status change.
- **Indexes:** if you add a foreign key you filter on, add an `@@index`.
- **Server-side checks are the real gate.** Hiding a link or a button is not
  access control; guard the page and the action too.

## Three environment traps (already handled, don't undo them)

1. **Sessions are JWT**, because the Credentials provider can't use database
   sessions (ADR 0002). Don't switch to database sessions.
2. **Both database URLs go through the Supabase session pooler** on port
   5432. The direct host `db.<ref>.supabase.co` is IPv6-only, and the 6543
   transaction pooler breaks the pg adapter's prepared statements. Both URLs
   are documented in `.env.example`.
3. **`passwordHash`** is our addition to the Auth.js `User`; the seed hashes
   it with bcrypt.
