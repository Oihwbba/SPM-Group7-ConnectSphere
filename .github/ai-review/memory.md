# GLM reviewer memory

Lessons from past reviews, approved by the team. The reviewer reads this file
from `main` on every pull request, after `CONTRIBUTING.md` and `CLAUDE.md`.

The reviewer proposes its own lessons: when a pull request merges,
`.github/scripts/ai-memory.mjs` asks GLM what that pull request taught it and
opens a pull request here if the answer is anything (SCRUM-112). Nothing lands
without a human reading it — a lesson shapes every later review, and changes
under `.github/` need Jin Hong's approval (CODEOWNERS). Editing this file by
hand is still fine; the job rewrites the whole file, so it will carry your
lesson forward or delete it once it stops being true.

Rules for a lesson:

- State a fact about this project and why it's so, not "don't report X". A
  lesson explains what is deliberate; it must never hide a real defect.
- Date it and cite the pull request it came from.
- Keep the file short: the reviewer reads at most 8,000 characters. Delete a
  lesson when it stops being true.

## Process and merging

- (2026-09-15, #27) Jin Hong owns the repository. Changes to `.github/`,
  `package.json`, the test configs or `vercel.json` need his approval
  (CODEOWNERS); when he merges as admin that satisfies it, so the description
  need not record it. Other teammates may merge too.
- (2026-09-15, #32) Dependabot pull requests are turned off. Dependency and
  security upgrades arrive as SCRUM-89 pull requests by Jin Hong, tested as one
  change.

- (2026-09-22, #71/#72; retires the #52–#54 re-landing workaround) Production
  deploys only through `.github/workflows/deploy.yml`: a push to `main` deploys
  a prebuilt bundle with the owner's `VERCEL_TOKEN`, with `.git` removed so no
  commit author is attached, and `vercel.json` disables Vercel's own Git
  deployments (ADR 0009). Teammate-authored merges deploy unmodified — proven
  by #74, #76, #78, #79, #87 and #88 — so their work is no longer re-landed
  under Jin Hong's name. The workflow records a GitHub deployment on the
  commit, so *deployed to Production* shows on merge commits, never on a pull
  request branch.

## Dependencies

- (2026-09-15, #32) `deepmerge-ts` is overridden to 8.0.2 on purpose. Prisma
  6.19.3, the newest 6.x, still asks for 7.x, which has a high-severity
  advisory; Prisma validates, generates and seeds with 8. Remove the override
  when moving to Prisma 7.
- (2026-09-15, #32) Vitest stays on 4.x on purpose: 5.0 changes defaults (such
  as clearing mocks before each test) and broke the build. `vite` is pinned to
  6.4.3 because `@vitejs/plugin-react` 4.3.4 supports vite 6 at most.

## Database and migrations

- (2026-09-16, #33) The shared Supabase database is also production. Migration
  `20260912090000_event_request_details` was applied there without being
  committed and was recovered in #33. It and
  `20260912120000_add_programme_and_special_requests` use
  `ADD COLUMN IF NOT EXISTS` on purpose, so both are safe on every database.
  The rule still holds for everything else: never edit an applied migration;
  fix forward with a new one.
- (2026-09-16, #33) Supabase's stored checksums differ from the repo for three
  older migration files. `prisma migrate deploy` ignores checksums, so this is
  known and harmless. Nobody may run `prisma migrate dev` against Supabase.
- (2026-09-16, #33) `Event.equipmentTypes` and `Event.registrationRequired`
  exist to keep production data. No feature reads or writes them yet.

## Events and status

- (2026-09-20, #51) `submitEventRequest` assigns a coordinator inside the same
  transaction (SCRUM-20), so a request that was just submitted is
  `UNDER_REVIEW`, not `SUBMITTED`, whenever any coordinator exists. A test or a
  screen expecting `SUBMITTED` straight after a submit journey is wrong. The
  seed has two coordinators and the least-loaded one wins, so which coordinator
  receives it varies per run: a test must read the assignment instead of
  hard-coding `coordinator@test.local`.
- (2026-09-20, #54) The events list's Submitted tab counts and shows both
  `SUBMITTED` and `UNDER_REVIEW` for that reason. Narrowing it to `SUBMITTED`
  hides a request the organiser has just sent.
- (2026-09-20, #51/#54) The events queries live in
  `app/(app)/events/role-views.tsx`, not `page.tsx`: a `page.tsx` may only
  export the names Next.js recognises, so helpers that need unit tests belong
  in `role-views.tsx`.
- (2026-09-20, #54) `Event.timezone` is nullable with an `Asia/Singapore`
  default and is already applied to the production database. The create form no
  longer captures `requiredFacilities`, so new events store `[]` while existing
  and seeded values are still displayed; whether capture returns is a product
  decision open for SCRUM-39/40.
- (2026-09-25, #87) The `?? null` fallbacks on optional draft fields in
  `app/(app)/events/actions.ts` are deliberate: on update, `null` clears a
  field the organiser emptied, while `undefined` would keep the old value.

## Equipment

- (2026-09-25, #87) The post-lock `if (!availability)` guard in
  `createReservation` is deliberate: the row lock and the availability count
  are separate queries, and the guard refuses rather than crashes if their
  filters ever drift apart.

## Tests

- (2026-09-15, #27) Integration tests live in `tests/integration/` and use
  `describe.skipIf(!usesLocalDatabase)` on purpose: they write data, so they
  run only against CI's Postgres or a local Docker database, never the shared
  Supabase database. Skipping locally isn't missing coverage; CI runs them on
  every pull request.
- (2026-09-15, #26) `it.todo` entries are placeholders, not coverage. The
  existing-test list marks them "(todo: not written yet)".
  `tests/unit/venues.test.ts` is all placeholders, and so are the SCRUM-53 and
  SCRUM-74 cases in `tests/integration/concurrency.test.ts`.
- (2026-09-15, #26) Test case specifications live in `docs/testing/<KEY>.md`,
  and each case names the automated test that covers it.
- (2026-09-25, #88) Coverage measures `lib/**/*.ts` and `app/**/actions.ts`
  only, in a `node` environment with no jsdom, so `.tsx` components never
  appear in it; Playwright journeys exercise them. Measuring components needs
  new tooling (SCRUM-87), a team decision. A "100% coverage" claim refers to the
  measured files only.
- (2026-09-25, #87) CI runs Node 24 and a developer may run Node 22, whose ICU
  labels a zero-offset zone differently, so a branch can run locally but never
  on CI. Tests asserting `Intl` output stub `Intl` rather than trust the ICU.

## Known open gaps

Gaps found by reviews (the #11 replay, 2026-09-14, and later merges), still
true until a pull request fixes them. Raise one only when a pull request
touches that code or claims that story, and say it was already known.

- (closed 2026-09-20) The SCRUM-24 simultaneous-decision integration test, the
  coordinator approve and reject Playwright journeys, and
  `app/(app)/equipment/loading.tsx` all exist now. Do not report them missing.
- (closed 2026-09-27) Reservation form errors, quantity included, now show next
  to their fields (SCRUM-31 AC 6). Do not report them as toast-only.
- (2026-09-23, #76) The organiser events table shows Name, Status, Starts and
  Updated, but SCRUM-84 AC3 also asks for an Expected Attendance column, which
  is still missing. Treat it as known when a pull request touches the table or
  claims SCRUM-84.
