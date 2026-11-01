# GLM reviewer memory

Lessons from past reviews, approved by the team. The reviewer reads this file
from the PR's base branch on every pull request, after `CONTRIBUTING.md` and `CLAUDE.md`.

After each merge, `.github/scripts/ai-memory.mjs` asks GLM what the pull
request taught and opens a pull request here if anything (SCRUM-112);
a human reads it first. Hand edits are fine, and CI fails if the file
outgrows what the reviewer reads (SCRUM-152).

Rules for a lesson:

- State a fact about this project and why it's so, not "don't report X". A
  lesson explains what is deliberate; it must never hide a real defect.
- Date it and cite the pull request it came from.
- Keep the file short: the reviewer reads at most 12,000 characters
  (SCRUM-180). Delete a lesson when it stops being true.

## Process and merging

- (2026-09-22, #71/#72; retires the #52–#54 re-landing workaround) Production
  deploys only through `.github/workflows/deploy.yml`: a push to `main` deploys
  a prebuilt bundle with the owner's `VERCEL_TOKEN`, with `.git` removed so no
  commit author is attached, and `vercel.json` disables Vercel's own Git
  deployments (ADR 0009). Teammate-authored merges deploy unmodified and are
  not re-landed. *Deployed to Production* shows on merge commits, never on a
  pull request branch.

- (2026-10-04, #101; #141, #145, #164; tightened 2026-10-15, #172; #269) Story
files under `docs/backlog` lag Jira: PO decisions, sprint planning and
reworded ACs land as sync PRs, and reviews (#101, #162) flagged code
against stale wording a sync later settled — check a story's change log
before reporting a mismatch. Syncs regenerate from Jira untouched: a story
in two sprints counts towards both, a dropped issue loses its file
(SCRUM-127), and a partial re-sync (#164, like #159/#163) leaves
the README's "last synced" date and a story's index status at the last full
sync — older over newer is deliberate. The fix belongs in Jira, never a
hand edit.

## Dependencies

- (2026-09-15, #32) `deepmerge-ts` is overridden to 8.0.2 on purpose. Prisma
  6.19.3, the newest 6.x, still asks for 7.x, which has a high-severity
  advisory; Prisma validates, generates and seeds with 8. Remove the override
  when moving to Prisma 7.

## Database and migrations

- (2026-09-16, #33) The shared Supabase database is also production.
  `20260912090000_event_request_details` (applied there uncommitted, recovered
  in #33) and `20260912120000_add_programme_and_special_requests` use
  `ADD COLUMN IF NOT EXISTS` on purpose, so both are safe everywhere. Otherwise
  never edit an applied migration; fix forward.
- (2026-09-16, #33) Supabase's stored checksums differ from the repo for three
  older migration files. `prisma migrate deploy` ignores checksums, so this is
  known and harmless. Nobody may run `prisma migrate dev` against Supabase.
- (2026-10-13, #175) Deploys apply migrations themselves: `deploy.yml` runs
  `prisma migrate deploy` after `vercel pull` and before the build, so a
  migration merged to `main` reaches production with no hand-run
  `npm run db:deploy` (production broke after #148 when nobody ran it). The
  old version keeps serving until the new build replaces it, so a migration
  must stay additive to the code still deployed; a failed one stops the
  deploy and production keeps the previous bundle.
- (2026-09-16, #33; 2026-09-28, #90; 2026-10-04, #114, #120; 2026-10-19, #221)
  `Event.equipmentTypes` stays write-free legacy; `registrationRequired`
  is live again — SCRUM-171's event form captures it and #221's change requests
  carry and apply it. #120's `confirmEvent` reads it, and
  `startRequestFromRejected` copies both onto the new Draft.
  `Event.registrationCapacity` joined them in #90, which made
  `expectedAttendance` the registration capacity (SCRUM-73/74): nothing reads
  the column and dropping it needs a migration decision, so #114 left it
  again.

## Events and status

- (2026-09-20, #54; 2026-10-02, #112) Every event is stored `Asia/Singapore`
only since #112 (SCRUM-129 retired SCRUM-13's per-event timezones):
`Event.timezone` is `NOT NULL` with `CHECK event_timezone_singapore`, and
that migration relabelled existing production rows deliberately — the stored
UTC instants were kept, the old zone labels were not. The create form no
longer captures `requiredFacilities`: new events store `[]`, existing values
still display; capture stayed off when SCRUM-38/40 landed (#216,
2026-10-18) — search reads the Organiser's SCRUM-170 answers instead.
- (2026-09-25, #87) The `?? null` fallbacks on optional draft fields in
`app/(app)/events/actions.ts` are deliberate: on update, `null` clears a
field the organiser emptied, while `undefined` would keep the old value.
- (2026-11-01, #332) SCRUM-249's overdue refusals leave two things
deliberate: Approve is hidden for an overdue request, but Confirm stays
visible on Arrangements for a ready overdue Planning event and fails only
on click (SCRUM-81 AC3 ties the button to the readiness checklist, which
ignores Overdue); and moving the start later (SCRUM-25) makes the event
no longer overdue (ADR 0012's addendum).

## Equipment

- (2026-09-28, #94) Reads that take the signed-in user's id live in plain
modules (`lib/equipment/request-queries.ts`), never in a `"use server"`
file: a server action is callable by anyone with any arguments, so exporting
one there would let any caller pass another user's id.
- (2026-10-13, #156) Equipment request lines are never hard-deleted: removal
sets `removedAt` (the team's choice — no hard deletes), every reader filters
`LIVE_LINE`, and re-adding a removed type revives the same row because the
one-line-per-type unique index covers removed rows too.
- (2026-10-19, #217) SCRUM-134's reservation rule is deliberately conservative:
`reserveEquipmentRequest` sums the outstanding need of every earlier open
request whose event overlaps the reservation, ignoring whether those events
overlap each other, so it can over-block — the team's choice, erring toward
the earlier request, not a defect.

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
- (2026-10-09, #146; 2026-10-28, #302; 2026-11-01, #311; 2026-11-02, #318)
  `docs/testing/*.md` cite test titles in 'Automated by' lines; since #318
  `npm run check:citations` (required in CI, and in `npm run verify`)
  fails a citation whose file is missing or whose title no test in it has,
  so a stale citation can no longer merge. Matching is lenient on purpose
  — "…", `${x}`, `%s`, `$x` and a title's own template parts stand for any
  text — so `${who}` titles cited by their runtime expansion and
  "…"-shortened prefixes pass. Outside its scope, still deliberate: 15 e2e
  titles carry a TC but no `[ACx]` (their docs tie them to no criterion),
  a Manual (Jira) row names a criterion only Jira can prove (SCRUM-216),
  and a citation outside an 'Automated by' paragraph is not checked at
  all.
- (2026-10-19, #222; #251) Vitest runs the integration files in parallel,
so every suite owns its data: no reading rows a sibling suite may delete
(#251) and no mid-run role-account churn (#222) — SCRUM-165/166 use the
seeded `lead2@test.local` and `safety2@test.local`, never throwaways.

## Known open gaps

Gaps found by reviews (the #11 replay, 2026-09-14, and later merges), still
true until a pull request fixes them. Raise one only when a pull request
touches that code or claims that story, and say it was already known.

- (2026-10-04, #120; 2026-10-19, #226) Events approved before #120 sit in
APPROVED with no way out: approval now writes PLANNING directly,
`transitionEventStatus` only decides Submitted/Under Review, and
`confirmEvent` refuses anything not Planning, so legacy rows (the seed's
`evt_approved` among them, and the reason APPROVED stays reservable) can never
be confirmed or resubmitted, and #226's `REASSIGNABLE` excludes APPROVED, so
they cannot be reassigned either. Treat it as known when a pull request
touches the status lifecycle, reassignment or the seed.

- (2026-10-13, #154; the holds-release low closed with #180's Cancel, per
#181) SCRUM-163 merged with AC9 partial and one review low open. Recording
unavailability over a live hold is refused rather than flagging it
  (SCRUM-161), the same refusal as over an approved booking. A hold on an
APPROVED-status event has no Confirm/Release surface anywhere: the readiness
checklist renders for Planning events only, legacy APPROVED rows cannot
reach Planning (#120), and `BOOKABLE_EVENT_STATUSES` still includes APPROVED
  — so such a hold can only lapse. The calendar's "Held until" label and the
post-expiry surfaces have no e2e (PO follow-up). Known when a pull request
touches holds, booking statuses or unavailability, or claims
SCRUM-82/SCRUM-161.

- (2026-10-15, #172; callers 2026-10-18 #181, 2026-10-19 #214; SCRUM-34's
venue-edit flags since #203, accessibility added 2026-10-19, #230)
SCRUM-26's `flagArrangements` is now called by those sources, but the
AC1 warning screen is still SCRUM-25's and the other AC3 sources
(SCRUM-160/161/166) raise none. Known when a pull request touches
reconsideration or claims those stories.

- (2026-10-18, #181; SCRUM-128's notice half closed by #227 and its
Registration-needed half by #221, 2026-10-19) An event completing with a
change request still Submitted leaves it Submitted (SCRUM-82 AC11 will
reject it). Known when a pull request touches change requests or claims
SCRUM-82.

- (2026-10-28, #300; retires #216) SCRUM-190 is delivered: every schema
that sets a period refuses one running into a second Singapore day. The
residue is rows stored across two days before #300:
`decideChangeRequest` (SCRUM-128) still applies a pending change request
carrying one without re-validating it, and the two-days warnings (Edit
details, the request form's re-enter message) have no rendered test
(#300's one low, open). Known when a pull request touches change-request
decisions or claims SCRUM-190/SCRUM-128.

- (2026-10-29, #309) SCRUM-238's seed edits three long-lived rows although
its AC4 and the README say nothing existing changes (#309's one low,
merged open): the shared Exhibition Hall's `knownRestrictions`, three
operational notes on `evt_planning`, and `attendee2`'s registration on
`evt_completed` — a spec assuming the old values now depends on the
seed. Known when a pull request touches the seed or claims SCRUM-238.

- (2026-11-01, #328) SCRUM-255 merged with its one review low open: the
cost 10 of `DUMMY_PASSWORD_HASH` in `auth.ts` duplicates the seed's by
hand, and no test reads the seed's cost — raising it would quietly
reopen the timing gap. Known when a pull request touches sign-in, the
seed's hashing, or claims SCRUM-255.

- (2026-11-02, #323) SCRUM-246's form shows a venue with no recorded
hours as Closed every day (`describeWeek`'s fallback) although booking
refuses nothing for it — the pre-SCRUM-34 rows the rest of
`lib/venue-hours.ts` guards. #323 dropped TC-246-03 and the guard on
purpose: the fix is SCRUM-253's, #326 closed unmerged. Known when a
pull request touches `describeWeek` or claims SCRUM-246/SCRUM-253.
