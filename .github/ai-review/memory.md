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

- (2026-09-15, #27) Jin Hong owns the repository and merges as admin. An admin
  merge satisfies CODEOWNERS, so a pull request that changes `.github/`,
  `package.json`, the test configs or `vercel.json` doesn't need to record that
  approval in its description.
- (2026-09-15, #32) Dependabot pull requests are turned off. Dependency and
  security upgrades arrive as SCRUM-89 pull requests by Jin Hong, tested as one
  change.

- (2026-09-20, #52/#53/#54) Vercel refuses to deploy a commit whose git author
  is not a project member, and a squash merge credits the pull request author,
  so merging a teammate's pull request blocks production. Their work is
  therefore landed through an integration pull request authored by Jin Hong,
  carrying their commits with `Co-Authored-By` trailers and the conflicts
  resolved. A pull request that credits someone else in its description is
  deliberate, not missing attribution.

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

## Known open gaps

Found by the review replay of #11 (2026-09-14) and still true until a pull
request fixes them. Raise one only when a pull request touches that code or
claims that story, and say it was already known.

- (closed 2026-09-20) The SCRUM-24 simultaneous-decision integration test, the
  coordinator approve and reject Playwright journeys, and
  `app/(app)/equipment/loading.tsx` all exist now. Do not report them missing.
- Reservation form errors show only a generic toast, not next to the field
  (SCRUM-31 AC 6).
