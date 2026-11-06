# Who explains each part of the system

**This page is the single source of truth for who explains what.** In the Q&A
each of us explains and justifies part of the code, the architecture and what
AI contributed (see [ai-usage.md](ai-usage.md)). This page names the one person
who answers the detailed questions on each epic, story, area of the code and
ADR. Everyone answers for the whole system at a high level. (SCRUM-197)

Other documents summarise ownership: the slide deck's "Team Contribution and
Ownership" slide, the Scrum and Sprint Documentation, and
[ai-usage.md](ai-usage.md). Those record who **built** what; this page records
who **explains** it, and the two can differ. Where any of them disagrees with
this page about who explains something, this page is right. Change it only
through a pull request.

**How the names were chosen:**
- **Epics:** the owner of the epic's Sprint 4 epic check (SCRUM-213 to
  SCRUM-218) explains it. SCRUM-6 is the exception: its 29 stories are split
  between four of us, as agreed in the
  [SCRUM-213 comment of 2 Nov](https://smu-spm-group7.atlassian.net/browse/SCRUM-213?focusedCommentId=10160).
- **Stories:** in SCRUM-6, the split above names each story's explainer.
  In the other epics, the person named for the area of the code that delivers
  the story (below) answers the detailed questions, and the epic's explainer
  answers for how the epic fits together. Who built each story is in
  [the test-case index](testing/README.md) and in Jira.
- **Code and ADRs:** the person who explains the stories that area delivers,
  checked against git. For code, the commits that touched each path (`git log
  757c69d3 --no-merges --format=%ae -- <path>`); for ADRs, who added each one
  (`git log 757c69d3 --diff-filter=A --format=%ae -- <adr>`). These counts
  undercount anyone whose work was squash-merged or re-landed by someone else
  ([ai-usage.md](ai-usage.md#the-figures-from-git)).

## Epics

| Epic | Sprint 4 epic check | Stories, by who built them | Explains |
|---|---|---|---|
| SCRUM-6 Event Request Lifecycle | Felicia Or (SCRUM-213) | Felicia Or 11 (13, 15, 16, 25, 84, 129, 130, 131, 170, 171, 190); Jun Bin 11 (23, 24, 26, 81, 82, 108, 110, 117, 126, 135, 166); Hann Qian 7 (14, 17, 18, 19, 20, 21, 165) | Split by story, below |
| SCRUM-7 Venue Management | Jun Bin (SCRUM-214) | Felicia Or 5 (34, 38, 40, 161, 188); Caylern Goh 5 (36, 37, 50, 52, 53); Jin Hong 2 (134, 163); Jun Bin 2 (159, 160); Hann Qian 1 (162) | Jun Bin |
| SCRUM-8 Event Change & Notifications | Hann Qian (SCRUM-215) | Jin Hong 4 (41, 45, 48, 124); Hann Qian 1 (85); Jun Bin 1 (128) | Hann Qian |
| SCRUM-9 Access Control | Caylern Goh (SCRUM-216) | Caylern Goh 4 (65, 66, 67, 68); Hann Qian 4 (69, 70, 141, 164); Jin Hong 1 (121) | Caylern Goh |
| SCRUM-10 Equipment Management | Jin Hong (SCRUM-217) | Jin Hong 9 (27, 28, 29, 30, 32, 142, 155, 156, 186); Jun Bin 1 (31) | Jin Hong |
| SCRUM-11 Attendee Registration | Felicia Or (SCRUM-218) | Hann Qian 5 (72, 73, 74, 76, 77); Felicia Or 1 (75) | Felicia Or |

Stories without a test-case document (merged, beyond Release 1 or not
specified) are left out.

### SCRUM-6, split by story

From the [SCRUM-213 comment of 2 Nov](https://smu-spm-group7.atlassian.net/browse/SCRUM-213?focusedCommentId=10160).
Felicia Or, who owns the epic check, answers for the epic as a whole.

| Explains | Stories |
|---|---|
| Jun Bin | SCRUM-23, 24, 26, 81, 110, 135, 166 |
| Felicia Or | SCRUM-13, 15, 16, 25, 82, 130, 170, 171 |
| Jin Hong | SCRUM-14, 17, 20, 21, 84, 129, 165 |
| Caylern Goh | SCRUM-18, 19, 108, 117, 126, 131, 190 |

## Areas of the code

| Area | Paths | Explains | Evidence |
|---|---|---|---|
| Sign-in, sessions and permissions | `app/(auth)/`, `app/api/auth/`, `auth.ts`, `auth.config.ts`, `proxy.ts`, `types/next-auth.d.ts`, `lib/auth/` | Caylern Goh | SCRUM-65 to SCRUM-68; ADRs 0002 and 0004, which he added. Commits to `lib/auth`: Jin Hong 13, Felicia Or 7, Jun Bin 7, Hann Qian 6, Caylern Goh 2, but #52 re-landed Caylern's #41 under Jin Hong's name |
| The menu and the shared page frame | `lib/nav.ts`, `components/app/`, `app/(app)/layout.tsx`, `app/(app)/page.tsx` | Caylern Goh | SCRUM-207, 210, 211 and 212. Commits to `components/app`: Jin Hong 9, Caylern Goh 8 |
| The event page | `app/(app)/events/[id]/`, `lib/event-next-step.ts` | Caylern Goh | SCRUM-208, 209. Commits to `[id]`: Caylern Goh 3, Hann Qian 2, Jun Bin 1 |
| The event request form, drafts and edits | `app/(app)/events/create-event-dialog.tsx`, `edit-actions.ts`, `lib/schemas/`, `lib/datetime.ts` | Felicia Or for SCRUM-13, 15, 16 and 25; Jin Hong for SCRUM-129; Caylern Goh for SCRUM-190 | By the SCRUM-6 split |
| Submitting, assigning, clarification requests, approving, and the Lead's queue | `app/(app)/queue/`, `app/(app)/all-events/`, `lib/coordinator-assignment.ts` | Jin Hong for SCRUM-14, 17, 20, 21 and 165; Caylern Goh for SCRUM-18 and 19, and for SCRUM-141 (every event read-only, in SCRUM-9) | By the SCRUM-6 split. Built mostly by Hann Qian |
| The event lifecycle: readiness, confirming, closing, cancelling, and the clarification and rejection rules | `app/(app)/events/actions.ts`, `clarification-actions.ts`, `readiness-actions.ts`, `cancel-actions.ts`, `lib/event-lifecycle.ts`, `lib/event-readiness.ts`, `lib/event-closing.ts`, `lib/change-application.ts` | Jun Bin for SCRUM-23, 24, 81, 110 and 135; Felicia Or for closing an event (SCRUM-82); Caylern Goh for answering a clarification and the rejection outcome (SCRUM-108, 117, 126) | By the SCRUM-6 split. ADRs 0006, 0011 to 0015, 0019. Commits to `app/(app)/events`: Jun Bin 37, Jin Hong 31 |
| Venue catalogue, search, and unavailability over existing bookings | `app/(app)/venues/`, `lib/venue-search.ts`, `lib/venue-suitability.ts`, `lib/venue-options.ts`, `lib/venue-changes.ts`, `lib/venue-unavailability.ts` | Felicia Or | SCRUM-34, 38, 40, 161, 188 |
| Venue availability calendar, recording unavailability, opening hours and clashes | `lib/venue-availability.ts`, `lib/venue-hours.ts`, `lib/venue-time-clashes.ts` | Jun Bin | Explains SCRUM-7. SCRUM-159, 160; ADRs 0021 and 0023; the closed-hours fix, SCRUM-241. Built with Caylern Goh (SCRUM-36, 37). Commits to `lib/venue-availability.ts`: Jin Hong 6, Jun Bin 5, Caylern Goh 1 |
| Venue booking requests and decisions, and the overlap rule | `app/(app)/bookings/`, `lib/booking-holds.ts`, `lib/period.ts` | Caylern Goh | SCRUM-50, 52, 53; ADR 0010. Also Hann Qian (SCRUM-162) and Jin Hong (SCRUM-134, 163) |
| Equipment: requests, availability and reserving | `app/(app)/equipment/`, `app/(app)/equipment-requests/`, `lib/equipment/` | Jin Hong; Jun Bin for reserving under a lock (SCRUM-31, ADR 0007); Felicia Or for "No equipment needed" (SCRUM-170, `app/(app)/events/equipment-decision-actions.ts`, by the SCRUM-6 split) | SCRUM-27 to 30, 32, 142, 155, 156, 186. Commits to `lib/equipment`: Jin Hong 13 |
| Change requests and notifications | `app/(app)/events/change-request-actions.ts`, `change-decision-actions.ts`, `app/(app)/notifications/`, `lib/notifications.ts`, `lib/staff-notifications.ts`, `lib/event-notifications.ts` | Hann Qian | Explains SCRUM-8. Built by Jin Hong (SCRUM-41, 45, 48, 124), Jun Bin (deciding a change request, SCRUM-128 and ADR 0020) and Hann Qian (attendee notices, SCRUM-85) |
| Needs Reconsideration flags | `app/(app)/events/reconsideration-actions.ts`, `lib/reconsideration.ts` | Jun Bin | SCRUM-26; ADR 0017. Commits to the actions: Jun Bin 6 |
| The safety check | `app/(app)/events/safety-check-actions.ts`, `app/(app)/safety-checks/`, `lib/safety-checks.ts` | Jun Bin | SCRUM-166; ADR 0018 |
| Attendee registration | `app/(app)/registrations/`, `app/(app)/events/registration-*.ts`, `lib/registration-*.ts` | Hann Qian; Felicia Or for SCRUM-75 | SCRUM-72 to 77. Felicia Or explains the SCRUM-11 epic as a whole (its epic check, SCRUM-218), and SCRUM-170 and 171, the Organiser's requirements and Registration needed, by the SCRUM-6 split |
| The data model, migrations and seed | `prisma/` | Jin Hong | Commits to `prisma/schema.prisma`: Jin Hong 14, Felicia Or 5; SCRUM-238 (the seed) |
| The test set-up and the coverage gate | `tests/`, `vitest.config.mts`, `playwright.config.ts`, `e2e/` | Each story's owner, for their story's tests; Jin Hong for the set-up and the 100% coverage gate | Commits to `tests/`: Jin Hong 127, Jun Bin 79, Felicia Or 29, Hann Qian 23, Caylern Goh 21 |
| CI, the GLM reviewer and deploys | `.github/` | Jin Hong | ADRs 0005, 0008, 0009, 0016; SCRUM-88, 112, 225. Commits to `.github`: Jin Hong 40, Caylern Goh 3 |
| Feature components and shared helpers | `components/events/`, `components/equipment/`, `components/auth/`, `components/ui/`, `lib/db.ts`, `lib/db-errors.ts`, `lib/action-result.ts`, `lib/audit-value.ts`, `lib/status-labels.ts`, `lib/requirement-choices.ts`, `lib/confirmed-details.ts`, `lib/utils.ts` | Whoever explains the feature that uses each one | `components/ui/` is the shadcn/ui library. `lib/status-labels.ts` is SCRUM-131, built by Felicia Or and explained by Caylern Goh (SCRUM-6 split). `lib/db.ts`'s connection cap is SCRUM-240 and ADR 0022 (Jun Bin) |

## Architecture decisions

The person who added each ADR explains it: Jun Bin 14 of the 23, Caylern Goh
5, Jin Hong 4. Felicia Or changed four ADRs and Hann Qian two, but added none.
Each epic's explainer also answers for the ADRs behind that epic at a high
level.

| ADR | Explains | Added | Notes |
|---|---|---|---|
| [0001](adr/0001-route-folders-by-role.md) Route folders | Caylern Goh | 8 Sep | Superseded by its own addendum (folders by domain, not by role) |
| [0002](adr/0002-jwt-session-strategy.md) JWT sessions | Caylern Goh | 8 Sep | |
| [0003](adr/0003-denormalised-booking-times.md) Booking times copied onto the booking | Caylern Goh | 8 Sep | |
| [0004](adr/0004-centralised-authorisation.md) One place for authorisation | Caylern Goh | 8 Sep | Jin Hong changed it three times |
| [0005](adr/0005-ephemeral-ci-database.md) A fresh database for each CI run | Jin Hong | 11 Sep | |
| [0006](adr/0006-single-event-status-transition-gate.md) One gate for every status change | Jun Bin | 14 Sep | |
| [0007](adr/0007-lock-equipment-pools-when-reserving.md) Locking equipment when reserving | Jun Bin | 14 Sep | Last changed by Jun Bin (SCRUM-202) |
| [0008](adr/0008-advisory-ai-code-review.md) The AI code review | Jin Hong | 14 Sep | |
| [0009](adr/0009-deploy-from-github-actions.md) Deploying from GitHub Actions | Jin Hong | 22 Sep | |
| [0010](adr/0010-database-prevents-venue-double-booking.md) The database prevents double-booking | Caylern Goh | 29 Sep | Jin Hong changed it four times |
| [0011](adr/0011-event-readiness-checklist.md) The readiness checklist | Jun Bin | 4 Oct | |
| [0012](adr/0012-confirming-an-event.md) Confirming an event | Jun Bin | 4 Oct | Felicia Or changed it twice |
| [0013](adr/0013-rejection-outcome.md) The outcome of a rejection | Jun Bin | 3 Oct | |
| [0014](adr/0014-clarification-fields-and-resubmission.md) Clarification and resubmission | Jun Bin | 4 Oct | |
| [0015](adr/0015-rejecting-a-planning-event.md) Rejecting an event in Planning | Jun Bin | 4 Oct | |
| [0016](adr/0016-one-nextjs-app-on-vercel-and-supabase.md) One Next.js app on Vercel and Supabase | Jin Hong | 11 Oct | |
| [0017](adr/0017-needs-reconsideration-flags.md) Needs Reconsideration flags | Jun Bin | 12 Oct | Felicia Or changed it twice |
| [0018](adr/0018-operational-safety-check.md) The safety check | Jun Bin | 13 Oct | |
| [0019](adr/0019-closing-an-event.md) Closing an event | Jun Bin | 13 Oct | |
| [0020](adr/0020-deciding-a-change-request.md) Deciding a change request | Jun Bin | 13 Oct | |
| [0021](adr/0021-flagging-setup-and-turnaround-clashes.md) Setup and turnaround clashes | Jun Bin | 14 Oct | |
| [0022](adr/0022-cap-the-database-pool-on-supabase.md) Capping the database pool on Supabase | Jun Bin | 1 Nov | SCRUM-240 |
| [0023](adr/0023-closed-hours-on-the-availability-calendar.md) Closed hours on the availability calendar | Jun Bin | 1 Nov | SCRUM-241 |
