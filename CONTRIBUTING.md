# Contributing to ConnectSphere

This is the **foundation**. Your job in the sprints is to build features on top
of it without fighting each other's code. This document is the contract that
makes that possible. Read it once before your first feature.

The golden rule: **favour boring, obvious code.** You have to explain every
line in the oral exam. No clever abstraction that isn't already earning its
keep.

---

## The one pattern to copy

`app/(app)/events` is the **reference implementation**. Every feature is a
variation of it. When you build your feature, copy that folder's shape:

| File | Role |
|---|---|
| `page.tsx` | Server component. Dispatches on role, guards it, fetches data scoped to the user via Prisma, renders it. |
| `loading.tsx` | Skeleton shown while the server component fetches. |
| `actions.ts` | Server Actions — the only place data changes. |
| `create-event-dialog.tsx` | Client component; a form that calls an action and shows the result. |
| `lib/schemas/<entity>.ts` | The Zod schema, shared by the form and the action. |
| `components/events/status-badge.tsx` | Shared presentational bits for the entity. |
| `tests/unit/<domain>.test.ts` | Vitest unit test of the action with the database mocked: happy path, validation failure, permission denied. Runs with `npm run test:unit`. |
| `tests/integration/<domain>.test.ts` | Vitest test against a real Postgres, only where correctness depends on the database: row locks, transactions, constraints. Runs with `npm run test:integration` and needs a local database. |
| `e2e/*.spec.ts` | One Playwright test of the main user journey. |

Route folders are named for the **domain**, not the role. A route that several
roles use is one folder whose `page.tsx` switches on `session.user.role` — see
`app/(app)/events/page.tsx` and the addendum to ADR 0001.

## How to add a feature (walkthrough)

Say you're building **Venue Booking Approval** in `bookings`.

1. **Branch.** `git checkout -b feat/SCRUM-22-booking-approval`. If someone
   else is in the same domain folder this sprint, agree who owns `page.tsx`
   before you both edit it.
2. **Schema first.** Add `approveBookingSchema` to `lib/schemas/booking.ts`.
   The form and the action both import it; validation is written once.
3. **Action.** In `bookings/actions.ts`, copy the shape of
   `createDraftEvent`:
   ```ts
   "use server";
   export async function approveBooking(input: unknown): Promise<ActionResult<...>> {
     const session = await auth();
     try {
       requirePermission(session?.user, "booking:review", /* resource */);
       const parsed = approveBookingSchema.safeParse(input);
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
4. **Permission.** If `"booking:review"` isn't in the `Action` union yet, add it
   to `lib/auth/can.ts` and grant it to `VENUE_STAFF` in the `ROLE_ACTIONS`
   table. **Do not** write a role check anywhere else (see below).
5. **Page.** Replace the placeholder `page.tsx` with a server component that
   guards the role, fetches bookings scoped to what this user may see, and
   renders a table. Keep a real empty state and a `loading.tsx`.
6. **Tests.** Add a unit test for the action in `tests/unit/` (happy / invalid /
   denied); an integration test in `tests/integration/` if it relies on locks,
   transactions or constraints; and, if the feature has a key journey, a
   Playwright spec in `e2e/`. Trace them back to your
   user story in the test description — the graders check traceability.
7. **Ship it** — `npm run verify`, push, open a PR, merge once CI is green.
   The next section is that flow in full.

---

## The branch → PR → merge flow

**One branch per SCRUM ticket.** `main` is protected: you cannot push to it
directly, and a pull request cannot merge until both required checks pass:
`build-and-test` (including the e2e tests) and the GLM `review`, which fails
on a critical finding. Once both are green, you can merge your own PR. That is deliberate — `main` is what deploys to production and what the
graders see, so it stays green by construction rather than by discipline.

```bash
# 1. Branch off an up-to-date main
git checkout main && git pull
git checkout -b feat/SCRUM-22-booking-approval

# 2. Work, then run the same checks CI will run
npm run verify

# 3. Push
git add -A && git commit -m "SCRUM-22: approve or reject a booking"
git push -u origin feat/SCRUM-22-booking-approval

# 4. Open the pull request
gh pr create --fill        # or use the link git prints

# 5. Merge once the check is green
gh pr checks               # watch it
gh pr merge --squash --delete-branch
```

Pushing the branch starts two things automatically:

| | What happens | Takes |
|---|---|---|
| **GitHub Actions** | migrate → seed → typecheck → lint → unit tests → e2e | ~2m30s |
| **GLM code review** | one AI reviewer reads the whole diff and posts one long review comment; red on a critical finding (skipped for drafts) | ~3–10 minutes |

There are no Vercel preview deployments. Only `main` deploys.

Merging to `main` runs CI again and deploys production.

### Four things that will otherwise surprise you

1. **`npm run verify` before you push.** It runs typecheck, lint and the unit
   tests — the three things CI fails on most. Budget a couple of minutes on a
   cold run; most of that is the first `tsc`, and repeat runs are quicker
   because typechecking is incremental. The win is not raw speed, it is that a
   failure lands in your terminal with the error in front of you, instead of
   as a red cross you have to open CI logs to understand — and it keeps the
   branch history clean of "fix lint" commits.
   It does not run the e2e suite (that needs a build and a database), so CI can
   still catch something `verify` did not.
2. **Your branch must be up to date with `main` before it can merge.** If
   someone merges while your PR is open, run `git pull origin main` inside your
   branch and let CI re-run. This guarantees the combination that was tested is
   the combination that lands.
3. **There are no preview deployments.** Check UI changes locally with
   `npm run dev`; CI's e2e tests check the key journeys. Production uses the
   shared Supabase database, so never run `db:reset` against it.
4. **Read the GLM review before you merge; a critical finding blocks it.** Every non-draft
   PR gets one long AI review from GLM-5.3, which reads the whole diff in a
   single pass (ADR 0008). It appears in the **Conversation** tab as one
   comment from `github-actions`, updated on every push: a verdict, an
   overview, an **acceptance criteria** table, and a section per finding with a
   **Where:** link to the exact line and a suggested fix. There are no inline
   comments. The reviewer reads your PR title, description and branch name,
   this file and CLAUDE.md, and the `docs/backlog` story for every SCRUM key you
   name. **Put the key in your branch name or title** (e.g.
   `SCRUM-31-reserve-equipment`), or it can't check the acceptance criteria.
   It reads all of that from `main`, so edits to those documents in your own PR
   don't change how your PR is reviewed. The **GLM Code Review**
   check turns **red** when it finds a critical issue, and it is a required
   check, so the merge button stays disabled until you fix it and push. High
   findings don't block, but fix them or reply on the PR with why they don't
   apply. If GLM stops before answering, the reviewer retries once with less
   thinking. If that also fails, the check turns red and says why: re-run the
   failed **GLM Code Review** job from the PR's Checks tab.
   It checks coverage against every existing test in `tests/` and `e2e/`:
   unit tests for new logic, integration tests against a real database for
   locks and transactions, and a Playwright spec with a success path and a
   failure path for each new page or journey. In UI code it checks for loading,
   empty and error states, labelled form controls and pending feedback. The
   acceptance table shows which tests cover each criterion. Only a
   `Closes SCRUM-n` or `Part of SCRUM-n` line in the description adds a story;
   other mentions of a key are ignored.
   The reviewer also reads `.github/ai-review/memory.md`, lessons from past
   reviews. If it keeps misreading something deliberate, add a dated lesson
   there through a PR. When it re-runs on your PR, it sees its previous review
   and the comments on the PR, so if a finding doesn't apply, reply on the PR
   and say why. It checks your reason against the code before dropping the
   finding.
   Changes to `.github/`, `package.json`, the test configs or `vercel.json`
   need Jin Hong's approval (CODEOWNERS), because they control the checks. If Copilot
   still reviews your PRs, turn off automatic Copilot code review in your
   personal GitHub Copilot settings. Your diff is sent to BigModel (Zhipu), a
   third-party provider, so never put secrets in a diff. The reviewer's rules
   live in `.github/ai-review/instructions.md`.

---

## Rules that are code-review rejections

- **No inline permission checks.** `if (session.user.role === "COORDINATOR")`
  in a feature is rejected. All authorisation goes through `can()` /
  `requirePermission()` in `lib/auth/can.ts` (ADR 0004). Add an `Action` and a
  table row instead.
- **No hard-coded colours.** No hex, `rgb()`, or literal colour in a component.
  Every colour is a token in `app/globals.css`, surfaced through the Tailwind
  theme. A rebrand must only touch tokens (brief §11).
- **Actions return `ActionResult`, they don't throw** across the boundary for
  expected failures (validation, permission). Throw only for real bugs.
- **Schemas are shared.** The form and the action import the same Zod schema.
  Don't validate twice with two different rules.
- **No new dependencies** outside the approved stack (brief §2) without a team
  decision and an ADR. No state-management library, no tRPC, no shared
  `<DataTable>` (one table is not yet a pattern), no service/repository layer.
- **No comments that restate the code.** Comment the *why*, not the *what*.

---

## Conventions cheat-sheet

- **Datetimes:** store UTC, display via `formatDate` / `formatDateTime` in
  `lib/datetime.ts` (Asia/Singapore). Never format a date inline.
- **No hard deletes:** state changes are status changes (see the enums).
- **Indexes:** if you add a foreign key you filter on, add an `@@index`.
- **Server-side auth is the real gate.** Hiding a nav link is not access
  control — guard the page and the action too.

## The three environment traps (already handled — don't undo them)

1. **JWT sessions** are required by the Credentials provider (ADR 0002). Don't
   switch to database sessions.
2. **Both database URLs go through the Supabase session pooler** (port 5432,
   user `postgres.<project-ref>@aws-0-<region>.pooler.supabase.com`). The
   "direct" host `db.<ref>.supabase.co` is IPv6-only (unusable on IPv4
   networks) and the 6543 transaction pooler breaks the pg adapter's
   prepared statements. Both URLs are documented in `.env.example`.
3. **`passwordHash`** is our addition to the Auth.js `User`; it's hashed with
   bcrypt in the seed.

## Running things

See `README.md`. In short: `npm run db:deploy && npm run db:seed` to bring
the shared Supabase database up to date (`db:reset` is the local Docker
fallback only — it would wipe the shared database), `npm run dev` to develop,
and `npm run typecheck && npm run lint && npm test` before you push.
