# GLM reviewer memory

Lessons from past reviews, approved by the team. The reviewer reads this file
from the PR's base branch on every pull request, after `CONTRIBUTING.md` and `CLAUDE.md`.

After each merge, `.github/scripts/ai-memory.mjs` asks GLM what the pull
request taught and opens a pull request here if anything (SCRUM-112); a
teammate reads it first. Hand edits are fine, and CI fails if the file
outgrows what the reviewer reads (SCRUM-152).

Rules for a lesson:

- State a fact about this project and why it's so, not "don't report X". A
  lesson explains what is deliberate; it must never hide a real defect.
- Date it and cite the pull request it came from.
- Keep the file short: the reviewer reads at most 12,000 characters
  (SCRUM-180). Delete a lesson when it stops being true.

## Stories and test-case documents

- (2026-10-04, #101; 2026-10-11, #154, #164) Story files under `docs/backlog`
  lag Jira: PO decisions and reworded criteria reach the repo in separate sync
  pull requests, so a story file can be older than the decision a pull request
  implements. #154's review judged a clash message against a SCRUM-163 AC2 that
  Jira had reworded the day before, and the PO waived the finding. Check a
  story file's change log before reporting a code/story mismatch. A partial
  re-sync updates only the items Jira changed and leaves the backlog README's
  "last synced" date at the last full sync. A wrong story file is fixed in
  Jira, never by hand.
- (2026-10-12, #170) Tests for stories that were Done before SCRUM-176 keep
  titles without the `SCRUM-n [ACx] TC-n-xx` format on purpose: their
  test-case documents cite those titles as they are, and renaming waits until
  the open pull requests that touch the same test files have merged.

## Deploys and the database

- (2026-09-22, #71; 2026-10-13, #175) Production deploys only from
  `.github/workflows/deploy.yml` on a push to `main` (ADR 0009); Vercel's own
  Git deployments are off, and there are no preview deployments. The deploy
  runs `prisma migrate deploy` before it builds, so a merged migration reaches
  production with no hand-run step while the previous build keeps serving: a
  migration must stay additive to the code still deployed, and a failed one
  stops the deploy.
- (2026-09-16, #33) The shared Supabase database is also production.
  `20260912090000_event_request_details` (applied there before it was
  committed, recovered in #33) and
  `20260912120000_add_programme_and_special_requests` use
  `ADD COLUMN IF NOT EXISTS` on purpose, so both are safe everywhere.
  Supabase's stored checksums differ from the repo for three older migration
  files; `prisma migrate deploy` ignores checksums, so that is known and
  harmless. Otherwise never edit an applied migration: fix forward.
- (2026-09-28, #90; 2026-10-04, #114, #120) `Event.equipmentTypes`,
  `Event.registrationRequired` and `Event.registrationCapacity` stay to keep
  production data; the form sets none of them. `confirmEvent` reads
  `registrationRequired`, and `startRequestFromRejected` copies the first two
  onto the new draft. Since #90 `expectedAttendance` is the registration
  capacity (SCRUM-73/74): nothing reads `registrationCapacity`, and dropping it
  needs a migration decision.

## Dependencies

- (2026-09-15, #32) `deepmerge-ts` is overridden to 8.0.2 on purpose. Prisma
  6.19.3, the newest 6.x, still asks for 7.x, which has a high-severity
  advisory; Prisma validates, generates and seeds with 8. Remove the override
  when moving to Prisma 7.
- (2026-09-15, #32) Vitest stays on 4.x on purpose: 5.0 changes defaults (such
  as clearing mocks before each test) and broke the build. `vite` is pinned to
  6.4.3 because `@vitejs/plugin-react` 4.3.4 supports vite 6 at most.

## Events and status

- (2026-09-20, #51, #54) `submitEventRequest` assigns a coordinator in the
  same transaction (SCRUM-20, until SCRUM-165 moves assignment to the Lead), so
  a just-submitted request is `UNDER_REVIEW`, not `SUBMITTED`, whenever a
  coordinator exists. The events list's Submitted tab therefore shows both
  statuses; narrowing it to `SUBMITTED` hides a request the organiser has just
  sent. The less loaded of the two seeded coordinators is picked, so a test
  reads the assignment rather than hard-coding `coordinator@test.local`.
- (2026-10-02, #112) Every event is stored `Asia/Singapore` only
  (`CHECK event_timezone_singapore`, SCRUM-129); that migration relabelled
  existing production rows on purpose, keeping their UTC instants. The create
  form no longer captures `requiredFacilities`: new events store `[]`, and
  existing values still display.
- (2026-09-25, #87) The `?? null` fallbacks on optional draft fields in
  `app/(app)/events/actions.ts` are deliberate: on update, `null` clears a
  field the organiser emptied, while `undefined` would keep the old value.
- (2026-09-28, #90) `app/(app)/events/[id]/` has no `loading.tsx` on purpose:
  a loading boundary would stream a 200 shell, and `notFound()` would stop
  returning the real 404 the e2e test pins.

## Equipment

- (2026-09-28, #94) Reads that take the signed-in user's id live in plain
  modules (`lib/equipment/request-queries.ts`), never in a `"use server"`
  file: a server action is callable by anyone with any arguments, so exporting
  one there would let any caller pass another user's id.
- (2026-10-13, #156) Equipment request lines are never hard-deleted: removal
  sets `removedAt` (the team's choice: no hard deletes), every reader filters
  `LIVE_LINE`, and re-adding a removed type revives the same row because the
  one-line-per-type unique index covers removed rows too.

## Tests

- (2026-09-15, #27; 2026-09-30, SCRUM-125) Integration tests in
  `tests/integration/` use `describe.skipIf(!usesLocalDatabase)` on purpose:
  they write data, so they run only against CI's Postgres or local Docker,
  never Supabase. Skipping locally isn't missing coverage, except that
  `npm run test:coverage` then fails its 100% threshold, as expected.
- (2026-09-25, #88; 2026-10-13, reviewer audit) Coverage measures every `.ts`
  file under `lib/` and `app/` except the Auth.js route re-export. `.tsx` files
  are left out because Vitest runs in a `node` environment with no DOM
  (SCRUM-87), but components are still tested: some `tests/unit/*.test.tsx`
  render them with `renderToStaticMarkup`, and Playwright drives the pages. CI
  fails when a measured file drops below 100%, so a "100% coverage" claim
  covers the measured files only.

## Known open gaps

Gaps found by reviews and merged unfixed, still true until a pull request
fixes them. Raise one only when a pull request touches that code or claims
that story, and say it was already known.

- (2026-09-29, #99) A recorded unavailability period can never be removed or
  shortened from the app, so a wrong record blocks its venue until someone
  edits the database by hand; and the record form blocks past start times that
  the server schema accepts.
- (2026-10-04, #120) Events approved before #120 sit in APPROVED with no way
  out: approval now writes PLANNING directly, `transitionEventStatus` only
  decides Submitted/Under Review, and `confirmEvent` refuses anything not
  Planning. Legacy rows (the seed's `evt_approved` among them) can never be
  confirmed or resubmitted, yet `BOOKABLE_EVENT_STATUSES` still includes
  APPROVED, so a hold on one has no Confirm/Release surface and can only lapse.
- (2026-10-08, #149) `Event.noEquipmentNeededById`'s `ON DELETE SET NULL` can
  never fire: CHECK `event_no_equipment_decision_complete` (both set or
  neither) aborts the delete instead, unlike `decidedById`. Latent, as nothing
  deletes users yet.
- (2026-10-13, #153) SCRUM-48 merged with two criteria deliberately partial:
  `notificationHref` gives the Safety Officer (and the Lead) no link until
  SCRUM-166 lands, and the several-roles case waits for SCRUM-121. The list,
  the count and marking read filter by the session's user id, not role, on
  purpose.
- (2026-10-13, #154) SCRUM-163 merged with AC9 partial. Cancelling an event
  does not release its holds (SCRUM-82 adds that), and recording
  unavailability over a live hold is refused rather than flagged (SCRUM-161).
  The calendar's "Held until" label and the post-expiry surfaces have no e2e
  test (a PO follow-up).
- (2026-10-13, #155) SCRUM-45's submission, confirmation, clarification and
  registration-full notices have no e2e assertion. And the SCRUM-24, SCRUM-81
  and both SCRUM-74 blocks of `tests/integration/concurrency.test.ts` don't
  delete the notifications their actions write; deleting the event only nulls
  the optional `Notification.eventId`, so unread strays pile up on the seeded
  organiser and coordinator accounts that e2e specs read.
- (2026-10-13, #162) SCRUM-41 merged with AC8 partial: rejecting an event
  rejects its Submitted change request with the same reason, but cancelling
  the event leaves it Submitted (SCRUM-82 AC3). And
  `components/events/change-request-panel.tsx` sets `submitting` around
  `await raiseChangeRequest(...)` with no `try/finally`, while the action
  rethrows unexpected errors, so a network or server failure leaves the form
  on "Submitting…" with both buttons disabled. `ClarificationPanel` has the
  same shape. The review found that, then dropped it on a re-run of the same
  commit.
