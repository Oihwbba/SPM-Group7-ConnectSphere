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

- (2026-09-22, #71/#72; retires the #52–#54 re-landing workaround) Production
  deploys only through `.github/workflows/deploy.yml`: a push to `main` deploys
  a prebuilt bundle with the owner's `VERCEL_TOKEN`, with `.git` removed so no
  commit author is attached, and `vercel.json` disables Vercel's own Git
  deployments (ADR 0009). Teammate-authored merges deploy unmodified and are
  not re-landed. *Deployed to Production* shows on merge commits, never on a
  pull request branch.

- (2026-10-04, #101; 2026-10-07, #141; 2026-10-09, #145) Story files under
`docs/backlog` lag Jira: PO decisions and sprint planning land as separate
sync pull requests (#103, #115, #141, #145); an earlier review of #101
flagged code that met the new AC 4 against the stale copy. Check a story
file's change log before reporting a code/story mismatch. Syncs regenerate
from Jira untouched (#141): a story in two sprints counts towards both
(SCRUM-13 did until the split moved it back and #145 carried that over),
and a dropped issue loses its file (SCRUM-127). The fix belongs in Jira,
never in a hand edit of the files.

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
- (2026-09-16, #33; 2026-09-28, #90; 2026-10-04, #114, #120) `Event.equipmentTypes`
  and `Event.registrationRequired` exist to keep production data; nothing
  writes either, and #120's `confirmEvent` is the only reader of
  `registrationRequired`. `Event.registrationCapacity` joined them in #90,
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
- (2026-09-25, #88; 2026-09-30, SCRUM-125) Coverage measures every `.ts` file
under `lib/` and `app/` (not the Auth.js route re-export), in a `node`
environment with no jsdom, so `.tsx` components never appear in it;
Playwright journeys exercise them. Measuring components needs new tooling
(SCRUM-87), a team decision. CI fails when a measured file drops below 100%,
so a "100% coverage" claim refers to the measured files only.
- (2026-10-09, #146) `docs/testing/*.md` cite test titles verbatim in
'Automated by' lines (not shown to this review), so a rename must update
the citing spec too; titles still in the old inline form match their specs.

## Known open gaps

Gaps found by reviews (the #11 replay, 2026-09-14, and later merges), still
true until a pull request fixes them. Raise one only when a pull request
touches that code or claims that story, and say it was already known.

- (2026-09-29, #99) Two gaps its review left open: a recorded unavailability
period can never be removed or shortened from the app, so a wrong record
blocks its venue until someone edits the database by hand; and the record form
blocks past start times that the server schema accepts.

- (2026-10-04, #120) Events approved before #120 sit in APPROVED with no way
out: approval now writes PLANNING directly, `transitionEventStatus` only
decides Submitted/Under Review, and `confirmEvent` refuses anything not
Planning, so legacy rows (the seed's `evt_approved` among them, and the reason
APPROVED stays reservable) can never be confirmed or resubmitted. Treat it as
known when a pull request touches the status lifecycle or the seed.

- (2026-10-08, #143) A gap its review left open, asked for twice and merged
unfixed: nothing pins the top bar. No test asserts the header has no search
box (SCRUM-168 AC1) or that at phone width the brand stays left and the
profile menu right (AC3). Treat it as known when a pull request touches
`app/(app)/layout.tsx`.

- (2026-10-08, #149) A gap its review left open, merged unfixed:
`Event.noEquipmentNeededById`'s `ON DELETE SET NULL` can never fire — CHECK
`event_no_equipment_decision_complete` (both set or neither) aborts the
delete instead, unlike `decidedById`. Latent, as nothing deletes users yet.
Known when a pull request touches the decision columns or user deletion.
