# GLM reviewer memory

Lessons from past reviews, approved by the team. The reviewer reads this file
from `main` on every pull request, after `CONTRIBUTING.md` and `CLAUDE.md`.

After each merge, `.github/scripts/ai-memory.mjs` asks GLM what the pull
request taught and opens a pull request here if anything (SCRUM-112); a human
reads it first. Hand edits are fine, and CI fails if the file outgrows what the
reviewer reads (SCRUM-152).

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

- (2026-09-22, #71/#72; retires the #52–#54 re-landing workaround) Production
  deploys only through `.github/workflows/deploy.yml`: a push to `main` deploys
  a prebuilt bundle with the owner's `VERCEL_TOKEN`, with `.git` removed so no
  commit author is attached, and `vercel.json` disables Vercel's own Git
  deployments (ADR 0009). Teammate-authored merges deploy unmodified and are
  not re-landed. *Deployed to Production* shows on merge commits, never on a
  pull request branch.

- (2026-10-04, #101) Story files under `docs/backlog` lag Jira: PO decisions
  land as separate sync pull requests (#103, #115); an earlier review of #101
  flagged code that met the new AC 4 against the stale copy. Check a story
  file's change log before reporting a code/story mismatch.

## Dependencies

- (2026-09-15, #32) `deepmerge-ts` is overridden to 8.0.2 on purpose. Prisma
  6.19.3, the newest 6.x, still asks for 7.x, which has a high-severity
  advisory; Prisma validates, generates and seeds with 8. Remove the override
  when moving to Prisma 7.
- (2026-09-15, #32) Vitest stays on 4.x on purpose: 5.0 changes defaults (such
  as clearing mocks before each test) and broke the build. `vite` is pinned to
  6.4.3 because `@vitejs/plugin-react` 4.3.4 supports vite 6 at most.

## Database and migrations

- (2026-09-16, #33) The shared Supabase database is also production.
  `20260912090000_event_request_details` (applied there uncommitted, recovered
  in #33) and `20260912120000_add_programme_and_special_requests` use
  `ADD COLUMN IF NOT EXISTS` on purpose, so both are safe everywhere. Otherwise
  never edit an applied migration; fix forward.
- (2026-09-16, #33) Supabase's stored checksums differ from the repo for three
  older migration files. `prisma migrate deploy` ignores checksums, so this is
  known and harmless. Nobody may run `prisma migrate dev` against Supabase.
- (2026-09-16, #33; 2026-09-28, #90; 2026-10-04, #114) `Event.equipmentTypes`
  and `Event.registrationRequired` exist to keep production data; no feature
  reads or writes them yet. `Event.registrationCapacity` joined them in #90,
  which made `expectedAttendance` the registration capacity (SCRUM-73/74):
  nothing reads the column and dropping it needs a migration decision, so #114
  left it again.

## Events and status

- (2026-09-20, #51) `submitEventRequest` assigns a coordinator in the same
  transaction (SCRUM-20), so a just-submitted request is `UNDER_REVIEW`, not
  `SUBMITTED`, whenever a coordinator exists. The least-loaded of the two seeded
  coordinators wins, so a test reads the assignment rather than hard-coding
  `coordinator@test.local`.
- (2026-09-20, #54) The events list's Submitted tab counts and shows both
  `SUBMITTED` and `UNDER_REVIEW` for that reason. Narrowing it to `SUBMITTED`
  hides a request the organiser has just sent.
- (2026-09-20, #54; 2026-10-02, #112) Every event is stored `Asia/Singapore`
  only since #112 (SCRUM-129 retired SCRUM-13's per-event timezones):
  `Event.timezone` is `NOT NULL` with `CHECK event_timezone_singapore`, and
  that migration relabelled existing production rows deliberately — the stored
  UTC instants were kept, the old zone labels were not. The create form no
  longer captures `requiredFacilities`: new events store `[]`, existing values
  still display, and whether capture returns is open for SCRUM-39/40.
- (2026-09-25, #87) The `?? null` fallbacks on optional draft fields in
  `app/(app)/events/actions.ts` are deliberate: on update, `null` clears a
  field the organiser emptied, while `undefined` would keep the old value.
- (2026-09-28, #90) `app/(app)/events/[id]/` has no `loading.tsx` on purpose:
  a loading boundary would stream a 200 shell and `notFound()` would stop
  returning a real 404, which the e2e pins.

## Equipment

- (2026-09-25, #87) The post-lock `if (!availability)` guard in
  `createReservation` is deliberate: the row lock and the availability count
  are separate queries, and the guard refuses rather than crashes if their
  filters ever drift apart.
- (2026-09-28, #94) Reads that take the signed-in user's id live in plain
  modules (`lib/equipment/request-queries.ts`), never in a `"use server"`
  file: a server action is callable by anyone with any arguments, so exporting
  one there would let any caller pass another user's id.

## Tests

- (2026-09-15, #27; 2026-09-30, SCRUM-125) Integration tests in
  `tests/integration/` use `describe.skipIf(!usesLocalDatabase)` on purpose:
  they write data, so they run only against CI's Postgres or local Docker,
  never Supabase. Skipping locally isn't missing coverage, except that
  `npm run test:coverage` then fails its 100% threshold, as expected.
- (2026-09-15, #26) Test case specifications live in `docs/testing/<KEY>.md`,
  and each case names the automated test that covers it.
- (2026-09-25, #88; 2026-09-30, SCRUM-125) Coverage measures every `.ts` file
  under `lib/` and `app/` (not the Auth.js route re-export), in a `node`
  environment with no jsdom, so `.tsx` components never appear in it;
  Playwright journeys exercise them. Measuring components needs new tooling
  (SCRUM-87), a team decision. CI fails when a measured file drops below 100%,
  so a "100% coverage" claim refers to the measured files only.
- (2026-09-25, #87) CI runs Node 24 and a developer may run Node 22, whose ICU
  labels a zero-offset zone differently, so a branch can run locally but never
  on CI. Tests asserting `Intl` output stub `Intl` rather than trust the ICU.

## Known open gaps

Gaps found by reviews (the #11 replay, 2026-09-14, and later merges), still
true until a pull request fixes them. Raise one only when a pull request
touches that code or claims that story, and say it was already known.

- (2026-09-23, #76) The organiser events table shows Name, Status, Starts and
Updated, but SCRUM-84 AC3 also asks for an Expected Attendance column, which
is still missing. Treat it as known when a pull request touches the table or
claims SCRUM-84.
- (2026-09-29, #99) Two gaps its review left open: a recorded unavailability
period can never be removed or shortened from the app, so a wrong record
blocks its venue until someone edits the database by hand; and the record form
blocks past start times that the server schema accepts.
- (2026-10-04, #114) `registrationEnabled` defaults to false and nothing sets
it, so a freshly Confirmed event shows "Registration closed" until SCRUM-81's
confirm action turns the flag on (SCRUM-73 AC6). Treat it as known when a pull
request touches confirmation or the attendee registration state.
