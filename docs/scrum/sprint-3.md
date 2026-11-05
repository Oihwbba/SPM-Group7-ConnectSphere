# Sprint 3

**Goal (Jira):** "Release 1 with the Week 7 changes: the Lead assigns every
request, Coordinators book one or more venues with setup and turnaround
times, holds and unavailability, and an event is confirmed only after an
approved safety check. Commitment: the Highest-priority stories; stories
labelled stretch come next."

| | |
|---|---|
| Started | 7 Oct 2026, 19:01 SGT |
| Planned end | 21 Oct 2026, 13:14 SGT |
| Closed | 21 Oct 2026, 14:24 SGT |
| Stories | 34 (34 Done by close) |
| Points committed at start | 124 (32 stories), at that day's estimates; 120 at today's |
| of which Highest priority (the goal's commitment) | 97 at start (95 at today's estimates) |
| of which labelled `stretch` | 27 at start (25 at today's estimates) |
| Points added during the sprint | 6 (SCRUM-170 and SCRUM-171, on the first evening) |
| Points done by close | **126** at today's estimates: this sprint's velocity |
| Stories labelled `week7-change` | 42 points |
| Task points | 8 (SCRUM-145, 147, 169, 172) |
| Pull requests merged into `main` | 113 (#141 to #263) |

Sources as for [Sprint 1](sprint-1.md): Jira's board, each item's change
history read on 23 Oct 2026, and `gh pr list`. Estimates changed after the start on four stories, each with a
change-log note (see [estimation.md](estimation.md)):

- SCRUM-75: 3 to 2 (8 Oct)
- SCRUM-132: 3 to 2 (8 Oct)
- SCRUM-171: 2 to 3 (8 Oct)
- SCRUM-82: 5 to 3 (9 Oct)

That is why the start-of-sprint and today's figures differ. Priorities and the
`stretch` label were set on the first evening, between 22:59 and 23:04, a
few hours after the sprint started; the split above uses them as set then.

## Commitment against velocity

The sprint started with **124 points** committed, against a velocity of
**37** (Sprint 1) and **56** (Sprint 2). That is 2.2 times Sprint 2 and 2.7
times the average of the two. The goal named the Highest-priority stories,
97 points, as the commitment, with the 27 points labelled `stretch` to
follow. All 34 stories were Done by close, 126 points at today's estimates.

Context the board records: 42 of those points were labelled `week7-change`,
the customer's Week 7 changes (the Lead, several venues per event, holds,
setup and turnaround times, and the safety check), which arrived with this
sprint and were part of Release 1.

**Why the team committed this much.** At sprint planning the team chose to
take all of the remaining Release 1 stories (option A), so that Sprint 4 would
be kept for fixes, re-checks and the submission. At the consultation with
Rajesh and KK in the middle of Sprint 2, the team had learnt that many teams
finish core functionality by Sprint 3 and keep the final sprint for testing,
documentation, bug fixes and release preparation. The Highest-priority stories
were the commitment and the `stretch` stories came next, so the team knew what
to drop first. Jira started the sprint at 159 points; on the first evening
refinement removed eight stories marked [OUT OF SCOPE] for Release 1 (33
points, from the Week 4 list of features not required) and SCRUM-13, leaving
124. That should have been caught at planning.

**What it changed for Sprint 4.** The velocity of 126 reflects a deliberate
concentration of feature work, not a lasting increase in capacity, so it is
not a benchmark. The cost showed as a ten-day flat burndown while stories that
depended on each other, across different developers, waited for one another.
Sprint 4 committed 15 points ([Sprint 4](sprint-4.md)) and logged its
hardening work as unpointed tasks.

## Stories

| Story | Summary | Points | Priority | In the sprint | Outcome |
|---|---|---|---|---|---|
| [SCRUM-21](../backlog/SCRUM-21.md) | Reassign an event to another Coordinator and show who is currently assigned | 3 | Highest | At start | Done 21 Oct (reopened 20 Oct and closed again) |
| [SCRUM-25](../backlog/SCRUM-25.md) | Update routine event information during planning | 3 | Highest | At start | Done 19 Oct |
| [SCRUM-26](../backlog/SCRUM-26.md) | Flag and resolve arrangements affected by a change | 5 | Highest | At start | Done 20 Oct |
| [SCRUM-32](../backlog/SCRUM-32.md) | Report reserved equipment that can no longer be provided | 2 | Medium | At start | Done 19 Oct |
| [SCRUM-34](../backlog/SCRUM-34.md) | Browse and maintain the venue catalogue | 5 | Highest | At start | Done 19 Oct |
| [SCRUM-38](../backlog/SCRUM-38.md) | Search and filter venues by criteria and requirements | 3 | Highest | At start | Done 19 Oct |
| [SCRUM-40](../backlog/SCRUM-40.md) | Flag venue suitability, with the reason | 3 | Highest | At start | Done 18 Oct |
| [SCRUM-41](../backlog/SCRUM-41.md) | Raise and track a change request | 3 | Highest | At start | Done 19 Oct |
| [SCRUM-45](../backlog/SCRUM-45.md) | Organiser and Coordinator workflow notifications | 5 | Highest | At start | Done 19 Oct |
| [SCRUM-48](../backlog/SCRUM-48.md) | User views their notification list | 3 | Highest | At start | Done 20 Oct |
| [SCRUM-70](../backlog/SCRUM-70.md) | Organisers and coordinators see an event's registrations; attendees' records stay private | 3 | Highest | At start | Done 18 Oct |
| [SCRUM-75](../backlog/SCRUM-75.md) | Control and enforce the registration period | 2 | Medium | At start | Done 19 Oct (reopened 19 Oct and closed again) |
| [SCRUM-77](../backlog/SCRUM-77.md) | Withdraw my registration | 2 | Highest | At start | Done 18 Oct |
| [SCRUM-82](../backlog/SCRUM-82.md) | Close an event: cancel it, or mark it completed once it has passed | 3 | Highest | At start | Done 21 Oct (reopened 20 Oct and closed again) |
| [SCRUM-85](../backlog/SCRUM-85.md) | Attendees are kept informed when an event they registered for changes or is cancelled | 5 | High | At start | Done 19 Oct |
| [SCRUM-121](../backlog/SCRUM-121.md) | Accounts can hold multiple roles | 3 | Medium | At start | Done 19 Oct |
| [SCRUM-124](../backlog/SCRUM-124.md) | Staff and arrangement notifications | 5 | Highest | At start | Done 19 Oct |
| [SCRUM-128](../backlog/SCRUM-128.md) | Decide a change request and apply it in one step | 5 | Highest | At start | Done 21 Oct (reopened 20 Oct and closed again) |
| [SCRUM-131](../backlog/SCRUM-131.md) | Use the agreed status names on every screen | 2 | Medium | At start | Done 20 Oct |
| [SCRUM-132](../backlog/SCRUM-132.md) | Core pages work on a phone and respond within 2 seconds | 2 | Medium | At start | Done 19 Oct |
| [SCRUM-134](../backlog/SCRUM-134.md) | Decide competing venue and equipment requests in the order they were made | 3 | Medium | At start | Done 19 Oct |
| [SCRUM-135](../backlog/SCRUM-135.md) | Refuse any event status change the lifecycle does not allow | 3 | Medium | At start | Done 20 Oct |
| [SCRUM-141](../backlog/SCRUM-141.md) | See every event read-only for planning | 5 | Highest | At start | Done 19 Oct |
| [SCRUM-142](../backlog/SCRUM-142.md) | Change equipment lines or withdraw a venue request before confirmation | 3 | High | At start | Done 21 Oct (reopened 20 Oct and closed again) |
| [SCRUM-159](../backlog/SCRUM-159.md) | Include setup and turnaround time when checking venue availability | 5 | Highest | At start | Done 20 Oct |
| [SCRUM-160](../backlog/SCRUM-160.md) | Identify bookings that clash once setup and turnaround apply | 3 | Highest | At start | Done 20 Oct |
| [SCRUM-161](../backlog/SCRUM-161.md) | Mark a venue unavailable over existing bookings and find a replacement venue | 5 | Highest | At start | Done 21 Oct (reopened 19 Oct, 20 Oct and closed again) |
| [SCRUM-162](../backlog/SCRUM-162.md) | Book several venues for one event | 5 | Highest | At start | Done 18 Oct |
| [SCRUM-163](../backlog/SCRUM-163.md) | Hold a venue tentatively until a deadline | 5 | Highest | At start | Done 20 Oct |
| [SCRUM-164](../backlog/SCRUM-164.md) | Add the Event Coordinator Lead and Safety Officer roles | 3 | Highest | At start | Done 19 Oct |
| [SCRUM-165](../backlog/SCRUM-165.md) | Lead assigns new requests from an unassigned queue | 5 | Highest | At start | Done 19 Oct |
| [SCRUM-166](../backlog/SCRUM-166.md) | Operational safety check: Safety Officer reviews arrangements before the event can be confirmed | 8 | Highest | At start | Done 21 Oct (reopened 20 Oct and closed again) |
| [SCRUM-170](../backlog/SCRUM-170.md) | Show the Organiser's requirements to the people planning the event | 3 | High | Added 7 Oct | Done 19 Oct |
| [SCRUM-171](../backlog/SCRUM-171.md) | Record whether an event needs registration | 3 | High | Added 7 Oct | Done 19 Oct (reopened 19 Oct and closed again) |

"Reopened and closed again" means the item went back from Done in Jira and was
moved to Done again; each reopen's reason is in the item's Jira comments.
The six stories reopened on **20 Oct** were reopened for gaps the 20 Oct audit
found against their criteria. Each was fixed in its own pull request, moved to
In Review for the Product Owner, and moved to Done again by the PO at 00:30 on
21 Oct:

| Story | Gap found by the 20 Oct audit | Fixed in |
|---|---|---|
| SCRUM-21 | Notices written ahead for the Coordinator still went to the previous one after a reassignment (AC 6) | #258 |
| SCRUM-82 | Cancelling left an open clarification answerable, and marked expired holds Cancelled (AC 3) | #254 |
| SCRUM-128 | A change moving only the end could not be approved once the start had passed it (AC 2) | #256 |
| SCRUM-142 | Rejecting a changed request left its unchanged lines' reservations holding stock (AC 2, AC 10) | #255 |
| SCRUM-161 | The calendar drew unavailability over a standing booking wrongly (AC 1, AC 3) | #259 |
| SCRUM-166 | Rejecting a Planning event left its safety check in the Safety Officers' queue (AC 13) | #257 |

## Tasks

| Task | Summary | Points | In the sprint | Outcome |
|---|---|---|---|---|
| [SCRUM-145](../backlog/SCRUM-145.md) | Chore: Resync test documentation with the current acceptance criteria | 2 | At start | Done 11 Oct |
| [SCRUM-146](../backlog/SCRUM-146.md) | Chore: Remove stale story references | - | At start | Done 14 Oct |
| [SCRUM-147](../backlog/SCRUM-147.md) | Chore: Update data-model documentation | 2 | At start | Done 14 Oct (reopened 11 Oct and closed again) |
| [SCRUM-168](../backlog/SCRUM-168.md) | Remove the placeholder search bar from the top bar | 0 | At start | Done 8 Oct |
| [SCRUM-169](../backlog/SCRUM-169.md) | Chore: Backlog Sync: update docs/backlog from Jira after the 7 Oct changes | 1 | Added 7 Oct | Done 9 Oct |
| [SCRUM-172](../backlog/SCRUM-172.md) | Week 7 database migration: schema and booking rules in one migration | 3 | Added 7 Oct | Done 14 Oct (reopened 9 Oct, 9 Oct, 11 Oct and closed again) |
| [SCRUM-173](../backlog/SCRUM-173.md) | Chore: Bring the docs up to date with the code and the Week 7 changes | - | Added 11 Oct | Done 13 Oct |
| [SCRUM-174](../backlog/SCRUM-174.md) | Chore: Record the tech stack decision as ADR 0016 | - | Added 11 Oct | Done 13 Oct |
| [SCRUM-175](../backlog/SCRUM-175.md) | Chore: Keep the key design diagrams and a Server Actions reference in docs/design | - | Added 11 Oct | Done 13 Oct |
| [SCRUM-176](../backlog/SCRUM-176.md) | Chore: Write test-case documents for the 23 Done stories that have none | - | Added 12 Oct | Done 13 Oct |
| [SCRUM-177](../backlog/SCRUM-177.md) | Backlog Sync: full re-sync of docs/backlog from Jira on 12 Oct | - | Added 12 Oct | Done 14 Oct |
| [SCRUM-178](../backlog/SCRUM-178.md) | Chore: Send related files to the GLM reviewer in part instead of dropping them | - | Added 12 Oct | Done 13 Oct |
| [SCRUM-179](../backlog/SCRUM-179.md) | Chore: Apply pending migrations to the shared database before each production deploy | - | Added 12 Oct | Done 13 Oct |
| [SCRUM-180](../backlog/SCRUM-180.md) | Chore: Raise the GLM reviewer's memory limit from 8,000 to 12,000 characters | - | Added 13 Oct | Done 14 Oct |
| [SCRUM-181](../backlog/SCRUM-181.md) | Chore: Fix the GLM reviewer gaps found by auditing a week of reviews | - | Added 13 Oct | Done 14 Oct |
| [SCRUM-182](../backlog/SCRUM-182.md) | Chore: Close the e2e sign-in pages that slow CI past its time limit | - | Added 14 Oct | Done 16 Oct |
| [SCRUM-185](../backlog/SCRUM-185.md) | Chore: Fix SCRUM-25 "Needs Reconsideration" only appears after reopening the modal | 0 | Added 16 Oct | Done 16 Oct |
| [SCRUM-191](../backlog/SCRUM-191.md) | Bug: Integration suites race each other through shared data, and the docs still describe the Safety Officer as unbuilt | - | Added 17 Oct | Done 19 Oct |
| [SCRUM-193](../backlog/SCRUM-193.md) | Bug: SCRUM-142's TC-142-18 and SCRUM-172's migration suites time out alongside other files, and a timed-out TC-142-18 leaves a test venue behind | - | Added 19 Oct | Done 19 Oct |
| [SCRUM-201](../backlog/SCRUM-201.md) | Bug: SCRUM-124's TC-124-02 borrows another suite's equipment and fails at random | - | Added 19 Oct | Done 19 Oct |
| [SCRUM-203](../backlog/SCRUM-203.md) | Chore: Bring test-case citations, stale notes and the backlog snapshot up to date with main | - | Added 20 Oct | Done 21 Oct |
| [SCRUM-204](../backlog/SCRUM-204.md) | Bug: A venue or equipment request can be created for an event that was just confirmed, closed or reassigned | - | Added 20 Oct | Done 21 Oct |
| [SCRUM-205](../backlog/SCRUM-205.md) | Bug: Accessibility and error-page gaps found in the 20 Oct audit | - | Added 20 Oct | Done 21 Oct |
| [SCRUM-206](../backlog/SCRUM-206.md) | Chore: Automate the test cases still run by hand on Done stories | - | Added 20 Oct | Done 21 Oct |

## Scope changes during the sprint

- **Stories added** on the first evening, after the sprint started at 19:01:
  - SCRUM-171 (Record whether an event needs registration, 3 points) at 22:39.
  - SCRUM-170 (Show the Organiser's requirements to the people planning the
    event, 3 points) at 23:37.
- **Refined on the first evening, then put back:** SCRUM-145 and SCRUM-147
  were in the sprint at the start, taken out at 22:17 and put back, estimated,
  at 23:04, during the same evening's refinement in which priorities and the
  `stretch` label were set. SCRUM-145's change log gives the reason:
  "narrowed to test documentation. Syncing docs/backlog … moved to SCRUM-169
  … Added to Sprint 3 and estimated, so the resync is counted as a task".
- **Taken out the same evening, back on 12 Oct:** SCRUM-146, also taken out
  at 22:17.
- **In briefly, then out:** SCRUM-13, a Sprint 1 story, was reopened on 7 Oct.
  It was put into this sprint, closed again and taken back out the same
  evening.
- **Tasks added during the sprint:** 20.
  - The backlog syncs: SCRUM-169, 177 and 203.
  - The Week 7 migration: SCRUM-172.
  - The documentation and GLM-reviewer chores: SCRUM-173 to 182.
  - Fixes for problems found in testing: SCRUM-185, 191, 193, 201, 204 and
    205.
  - SCRUM-206, on the last evening.
- **Nothing was carried over** to Sprint 4.

## Sprint review

Held on Wed 21 Oct 2026 from 12pm, with all five members, and recorded
(recording 1, together with the retrospective). Sprint 4 Planning followed as
a separate recording.

- **Product Owner:** Caylern, who reviewed pull requests and took no stories.
  Hann Qian was Scrum Master.
- **What was demonstrated, and what was accepted or sent back.** Each
  developer demonstrated their own stories live in the production app with the
  seed accounts; steps the seed data can't show were demonstrated by running
  their end-to-end tests.
  - **Hann Qian:** SCRUM-164 and 165 (the Lead and Safety Officer roles; the
    Unassigned Queue), SCRUM-21 and 141 (reassigning; every event read-only),
    SCRUM-162 (several venues per event), and SCRUM-70, 77 and 85
    (registrations, withdrawal, the attendee notice).
  - **Felicia:** SCRUM-34 (venue catalogue), SCRUM-38 and 40 (search and
    suitability), SCRUM-161 (unavailability over existing bookings), SCRUM-25
    and 170 (event details, the Organiser's requirements), SCRUM-75 and 171
    (registration window, Registration needed), and SCRUM-131 and 132 (status
    names, phone view and speed).
  - **Jin Hong:** SCRUM-163 (holds), SCRUM-134 (first come, first served, by
    its end-to-end test), SCRUM-142 (changing or withdrawing requests),
    SCRUM-32 and 41 (equipment reports, change requests), and SCRUM-45, 48, 124
    and 121 (notifications; one account with several roles).
  - **Jun Bin:** SCRUM-159 and 160 (setup and turnaround; the clash case by its
    end-to-end test), SCRUM-128 and 26 (deciding change requests, resolving
    flags), SCRUM-166 (safety check; the full flow by its end-to-end test), and
    SCRUM-135 and 82 (status transitions; cancellation and completion).

  The Product Owner, Caylern, **accepted all 34 stories (126 points); none was
  sent back.** Before accepting, he asked how an attendance change after an
  approved safety check is handled (the check becomes Outdated, so the event
  can't be confirmed until it is checked again) and what happens to an
  unconfirmed hold (it lapses at its expiry, after a 24-hour reminder).

  Two issues were raised and recorded as new backlog items, with the stories
  staying Done: the venue suitability reason is very long on the phone view
  (SCRUM-40), and the Unassigned Queue shows Overdue but not how long a request
  has waited (SCRUM-165).

  Recorded on 4 Nov by the Sprint 3 Product Owner from the meeting minutes
  (Sprint 3 Review, Retrospective and Sprint 4 Planning, in the team's Drive)
  and Jira, where each story was moved to Done on 21 Oct. Recording 1 (the
  review and retrospective) wasn't uploaded to the team folder, so it was not
  re-watched; recordings are kept only for the final sprint. Recording 2,
  [Sprint 4 Planning](https://youtu.be/GEJpDrJ3SSY), is linked from
  [Sprint 4](sprint-4.md#recordings).

What Jira and git already show:

- On the evening of 20 Oct, six of this sprint's stories went back from Done
  for the gaps the 20 Oct audit found (see "Stories" above). So did the
  Sprint 1 story SCRUM-15, for a Product Owner decision on its AC 9: as built,
  a draft holds no catalogue reference that could go stale, so the
  criterion's "marked for correction" half had nothing to mark.
- All seven were moved to Done again at 00:30 on 21 Oct, together with
  SCRUM-203 to 206. SCRUM-15's history shows that move made by Caylern, the
  Product Owner for Sprint 3.

## Retrospective

Held after the review on Wed 21 Oct, in recording 1, and run by Hann Qian
(Scrum Master). The team voted on what to fix first: workload 5, testing each
other's work 4, flaky CI 3, late merges 3. Taken from the team's Scrum and
Sprint Documentation (submission folder 4).

### Sprint 2's actions, and what came of them

| Sprint 2 action | What happened |
|---|---|
| One story per branch, merged only when complete | Partly. The Week 7 stories depended on each other, so some needed repeated pull requests to `main`. |
| Record every review; send questions to the customer early | Done. This review was recorded, and the customer questions went to the 12 Oct clarification session. |
| Write up the Organiser form changes in Jira (Felicia) | Done: SCRUM-170 (7 Oct), delivered in this sprint. |
| Export the backlog, then merge SCRUM-167 into 166 and 133 into 85 (Felicia) | Done on 7 Oct. |
| Show the full time frame on the Attendee event card (Hann Qian) | Done in PR #139, before Sprint 2 closed. |
| Document the Sprint 2 end-to-end test cases (each story owner) | Done (SCRUM-145, 176). |

### What went well

- The GLM review, which caught the lock-order problem in the venue edit
  (continue).
- Clear acceptance criteria, which made acceptance quick (continue).
- Every Week 7 change was delivered and accepted, with the Highest-priority
  and `stretch` order known in advance.

### What to improve

- Stop merging late at night just before stand-up.
- Stop one person taking most of the items: Jin Hong held 31 of the 58 items
  and more than half of the team's pull requests, partly from taking the
  chores because he knew the code.
- End-to-end tests failing on their first attempt in CI (four fixed this
  sprint, SCRUM-189 still open); most are long journeys hitting the 30-second
  limit, not real failures.
- The jump from 56 to 126 points suggests smaller sizing or more hours,
  probably both; the commitment was 2.2 times Sprint 2's velocity.

### Actions, and what came of them

What came of each was checked at the [Sprint 4 retrospective](sprint-4.md#retrospective).

| Owner | Action | Due | What came of it |
|---|---|---|---|
| Everyone | Start: someone who didn't build a story tries it before it is Done (about ten minutes per story) | Sprint 4 | Partly: the Product Owner tried each feature before accepting it |
| Everyone | Start: telling the Product Owner early when a story will be late | Sprint 4 | Partly: the two largest UI pieces were held back three to four days |
| Hann Qian | Make sure nobody takes more than about a quarter of the sprint's items | Sprint 4 planning, Wed 21 Oct | Not met: Felicia held 28 of 69 items and Jin Hong 18 |
| Felicia | Make sure every story is tried by one other person before it moves to Done | Sprint 4 | Partly, as the first action |
| Jun Bin | Fix the slow end-to-end tests (SCRUM-189) first in Sprint 4 | Sprint 4 | Done: all 415 end-to-end tests passed on `main` |
| Caylern | Log the two new backlog items from the review in Jira | Wed 21 Oct | Not recorded in the Sprint 4 retrospective |
| Jun Bin | Enter the planning poker estimates and the goal, and start Sprint 4 in Jira | Wed 21 Oct | Done: Sprint 4 started at 15:00 on 21 Oct |
| Everyone | Split their stories into tasks on the Sprint 4 board | Thu 22 Oct | Not recorded in the Sprint 4 retrospective |
| Jun Bin | Set the date of the recorded stand-up | Thu 22 Oct | Done: held live and recorded on 28 Oct |
| Hann Qian | Upload both recordings as unlisted videos and add the links | Thu 22 Oct | Partly: Sprint 4 Planning is uploaded; recording 1 is not |
| Jin Hong | Run the seed again to undo the demo changes, and record this retrospective in the sprint records (SCRUM-194) | Thu 22 Oct | The record is this section (SCRUM-194, Done in Sprint 4); the re-seed isn't recorded |

Follow-ups the backlog already records:

- The rubric audit on 19 Oct raised SCRUM-194, the Sprint 4 task this
  record belongs to.

## Burndown

Remaining work stayed flat for ten days: the Week 7 stories depended on the
shared schema and booking-rules migration SCRUM-172 (Done 14 Oct). 57 merges
reached `main` from 7 to 17 Oct, but the first story (SCRUM-70) was accepted
only on 18 Oct. Then 13 points were accepted on 18 Oct and 60 on 19 Oct, many
when the PO reviewed the interlocking Week 7 roles and queues as a batch; the
20 Oct audit reopened six stories (a 27-point rise) before they were fixed and
accepted again on 21 Oct. Lower-priority and out-of-scope stories had been
removed after the requirement changes so the team could focus on essential
functionality, and Sprint 4 therefore focused on stability, usability, testing
and documentation instead of new features.
