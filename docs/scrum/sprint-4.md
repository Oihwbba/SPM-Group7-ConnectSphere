# Sprint 4

**Goal (Jira):** "Release 1 submission-ready, easy to use for every role, the
last defects fixed, CI reliable, and the evidence graders read complete."

| | |
|---|---|
| Started | 21 Oct 2026, 15:00 SGT |
| Planned end | 4 Nov 2026, 13:14 SGT |
| Closed | 4 Nov 2026, 17:04 SGT |
| Product Owner | Hann Qian |
| Scrum Master | Jun Bin |
| Stories | 9 (9 Done by close) |
| Points committed at start | 15 (9 stories) |
| of which labelled `stretch` | 2 (SCRUM-211, 212) |
| Points added during the sprint | 0 (3 bug points were added on 27 Oct and set back to 0 at close) |
| Points done by close | **15**: this sprint's velocity |
| Tasks | 60 Done: 16 bugs, 6 epic checks and 38 other chores, none of them pointed |
| Items in the sprint at close | 69 (22 at start, 47 added; SCRUM-219 and 220 removed) |
| Pull requests merged into `main` | 79 (#264 to #365); 78 before the review, then #365, the closing backlog re-sync |

Sources: the sprint's dates and goal from Jira's board (SCRUM Sprint 4); items,
points, owners and statuses from Jira, read on 6 Nov 2026; the scope changes
from Jira's Sprint 4 burndown report; pull requests from `gh pr list --state
merged --base main`, by merge time. The planning, review and retrospective
come from the team's Scrum and Sprint Documentation (submission folder 4) and
the recordings linked [below](#recordings).

## Commitment against velocity

The sprint committed **15 points**, after velocities of 37, 56 and 126. That
was set on purpose against Sprint 3's over-commitment (124 points, 2.2 times
Sprint 2): Sprint 3 had carried most of Release 1, so Sprint 4's goal was
hardening, and the capacity left over went to the bugs, CI fixes, epic checks
and evidence, all logged as unpointed tasks. Anything above 8 points would have
been split before it was committed; nothing was.

All 15 points were Done an hour before the planned end. Story points don't
show this sprint's effort: the 60 tasks behind them carry no points.

## Sprint planning

Held on Wed 21 Oct 2026, straight after the Sprint 3 review and retrospective,
with all five members, and recorded.

- **Roles:** Hann Qian Product Owner and Jun Bin Scrum Master, so the two roles
  stay with different people. Caylern, Felicia, Jin Hong and Jun Bin build.
- **Scope:** nine stories, from the Sprint 3 review's feedback (the UI
  reorganisation, SCRUM-207 to 212, with 211 and 212 labelled `stretch`) and
  changes the PO approved on 21 Oct (SCRUM-186, 188, 190). With them came the
  open bugs (SCRUM-187, 202), the flaky CI (SCRUM-183, 189), the evidence
  (SCRUM-194, 197, 198), an epic check for each epic (SCRUM-213 to 218) and the
  submission (SCRUM-219, 220).
- **Out of scope:** the eight stories labelled `beyond-release-1`, which are on
  the Week 4 list of features not required for Release 1. SCRUM-184, 195, 196,
  199 and 200 stayed in the backlog as optional; SCRUM-196, the CI citation
  check, was delivered later in the sprint.
- **Epics:** each is checked by its owner and closed by the Product Owner once
  only `beyond-release-1` stories remain.
- **Stand-ups:** asynchronous on Telegram, except one held live on video and
  recorded (28 Oct).

### Planning poker

Estimated in Planning Poker on the 1, 2, 3, 5, 8 scale. The Product Owner
explains each story but doesn't vote.

| Story | Summary | Points | Owner |
|---|---|---|---|
| [SCRUM-207](../backlog/SCRUM-207.md) | Shared page conventions on every page | 2 | Caylern |
| [SCRUM-208](../backlog/SCRUM-208.md) | One page per event, not a pop-up | 2 | Caylern |
| [SCRUM-209](../backlog/SCRUM-209.md) | Arrange venues, equipment and the safety check from the event page | 2 | Caylern |
| [SCRUM-210](../backlog/SCRUM-210.md) | Menus grouped by task | 1 | Caylern |
| [SCRUM-211](../backlog/SCRUM-211.md) | One layout for every work queue (`stretch`) | 1 | Caylern |
| [SCRUM-212](../backlog/SCRUM-212.md) | Attendee pages show registration state at a glance (`stretch`) | 1 | Caylern |
| [SCRUM-188](../backlog/SCRUM-188.md) | Request a venue for exactly the event's period | 2 | Felicia |
| [SCRUM-190](../backlog/SCRUM-190.md) | An event takes place within one day | 2 | Felicia |
| [SCRUM-186](../backlog/SCRUM-186.md) | One active equipment request per event; more equipment is added by changing its lines | 2 | Jin Hong |

Planning agreed nobody should hold more than about a quarter of the sprint's
items (a Sprint 3 retrospective action). At planning Caylern held 8 of the 24
items.

## Stories

| Story | Summary | Points | Owner | In the sprint | Outcome |
|---|---|---|---|---|---|
| [SCRUM-186](../backlog/SCRUM-186.md) | One active equipment request per event; more equipment is added by changing its lines | 2 | Jin Hong | At start | Done 2 Nov |
| [SCRUM-188](../backlog/SCRUM-188.md) | Request a venue for exactly the event's period | 2 | Felicia Or | At start | Done 28 Oct (#301) |
| [SCRUM-190](../backlog/SCRUM-190.md) | An event takes place within one day | 2 | Felicia Or | At start | Done 28 Oct (#300) |
| [SCRUM-207](../backlog/SCRUM-207.md) | Shared page conventions on every page | 2 | Caylern Goh | At start | Done 4 Nov |
| [SCRUM-208](../backlog/SCRUM-208.md) | One page per event, not a pop-up | 2 | Caylern Goh | At start | Done 2 Nov |
| [SCRUM-209](../backlog/SCRUM-209.md) | Arrange venues, equipment and the safety check from the event page | 2 | Caylern Goh | At start | Done 2 Nov |
| [SCRUM-210](../backlog/SCRUM-210.md) | Menus grouped by task | 1 | Caylern Goh | At start | Done 4 Nov |
| [SCRUM-211](../backlog/SCRUM-211.md) | One layout for every work queue | 1 | Caylern Goh | At start (`stretch`) | Done 4 Nov |
| [SCRUM-212](../backlog/SCRUM-212.md) | Attendee pages show registration state at a glance | 1 | Caylern Goh | At start (`stretch`) | Done 30 Oct |

No story was added, re-estimated or reopened during the sprint. SCRUM-207
gained AC6 to AC9, approved by the PO between 25 and 27 Oct. SCRUM-186, 208 and
209 were accepted together on 2 Nov, after the PO checked the UI reorganisation
across every role on the SCRUM-238 seed data.

## Tasks

| Task | Summary | Owner | In the sprint | Outcome |
|---|---|---|---|---|
| [SCRUM-183](../backlog/SCRUM-183.md) | Chore: SCRUM-18 clarification.spec.ts | Jun Bin | At start | Done |
| [SCRUM-187](../backlog/SCRUM-187.md) | Bug: The clarification answer form stays on "Sending…" when sending fails | Jun Bin | At start | Done |
| [SCRUM-189](../backlog/SCRUM-189.md) | Chore: Stop long e2e journeys failing at the 30-second test limit on CI | Jun Bin | At start | Done |
| [SCRUM-194](../backlog/SCRUM-194.md) | Chore: Record each sprint, how we estimate, and the Definition of Done in docs/scrum | Jin Hong | At start | Done |
| [SCRUM-196](../backlog/SCRUM-196.md) | Chore: Check in CI that every test case cites tests and files that exist | Jin Hong | Added 28 Oct | Done |
| [SCRUM-197](../backlog/SCRUM-197.md) | Chore: Document how the team uses AI and who owns each part of the system | Jin Hong | At start | Done |
| [SCRUM-198](../backlog/SCRUM-198.md) | Chore: Add a demo script for the core workflows, including conflicts, changes and failures | Jun Bin | At start | Done |
| [SCRUM-202](../backlog/SCRUM-202.md) | Bug: A venue edit can deadlock with a simultaneous booking decision or event edit | Jun Bin | At start | Done |
| [SCRUM-213](../backlog/SCRUM-213.md) | Chore: Epic check for SCRUM-6 Event Request Lifecycle | Felicia Or | At start | Done |
| [SCRUM-214](../backlog/SCRUM-214.md) | Chore: Epic check for SCRUM-7 Venue Management | Jun Bin | At start | Done |
| [SCRUM-215](../backlog/SCRUM-215.md) | Chore: Epic check for SCRUM-8 Event Change & Notifications | Hann Qian | At start | Done |
| [SCRUM-216](../backlog/SCRUM-216.md) | Chore: Epic check for SCRUM-9 Access Control | Caylern Goh | At start | Done |
| [SCRUM-217](../backlog/SCRUM-217.md) | Chore: Epic check for SCRUM-10 Equipment Management | Jin Hong | At start | Done |
| [SCRUM-218](../backlog/SCRUM-218.md) | Chore: Epic check for SCRUM-11 Attendee Registration | Felicia Or | At start | Done |
| [SCRUM-221](../backlog/SCRUM-221.md) | Chore: Re-sync docs/backlog from Jira at the start of Sprint 4 | Jin Hong | Added 21 Oct | Done |
| [SCRUM-222](../backlog/SCRUM-222.md) | Chore: Bring the Server Actions reference, testing index and SCRUM-50 supersession note up to date | Felicia Or | Added 23 Oct | Done |
| [SCRUM-224](../backlog/SCRUM-224.md) | Chore: Run GLM on the five Sprint 3 PRs merged without review (#229, #239, #240, #218, #195) and fix its findings | Jun Bin | Added 24 Oct | Done |
| [SCRUM-225](../backlog/SCRUM-225.md) | Chore: Skip the GLM review with a green check when GLM's quota or rate limit stops it | Jin Hong | Added 26 Oct | Done |
| [SCRUM-226](../backlog/SCRUM-226.md) | Bug: Two Technical Support staff can reserve the same line of an approved request twice | Jin Hong | Added 27 Oct | Done |
| [SCRUM-227](../backlog/SCRUM-227.md) | Bug: Two simultaneous updates to one equipment request can both be saved when one is a suggestion | Jin Hong | Added 27 Oct | Done |
| [SCRUM-228](../backlog/SCRUM-228.md) | Chore: Make SCRUM-170's race test wait for its locks instead of sleeping | Jin Hong | Added 27 Oct | Done |
| [SCRUM-229](../backlog/SCRUM-229.md) | Bug: Equipment availability shows a result for an invalid quantity, and Coordinator equipment lists include unassigned events | Jin Hong | Added 27 Oct | Done |
| [SCRUM-230](../backlog/SCRUM-230.md) | Chore: Raise the CI job limit from 20 to 30 minutes | Hann Qian | Added 27 Oct | Done |
| [SCRUM-231](../backlog/SCRUM-231.md) | Chore: Raise the CI build-and-test job's time limit from 20 to 35 minutes | Jin Hong | Added 27 Oct | Done |
| [SCRUM-232](../backlog/SCRUM-232.md) | Chore: Name every e2e test after the story, criteria and test case it proves | Jin Hong | Added 27 Oct | Done |
| [SCRUM-233](../backlog/SCRUM-233.md) | Chore: Bring the seed in line with the event lifecycle: no event left in Approved, every event within one day | Felicia Or | Added 27 Oct | Done |
| [SCRUM-234](../backlog/SCRUM-234.md) | Chore: Add the missing e2e journeys for SCRUM-142 AC5 and SCRUM-26's flagged reservation | Jin Hong | Added 27 Oct | Done |
| [SCRUM-235](../backlog/SCRUM-235.md) | Chore: Re-sync docs/backlog from Jira (28 Oct) | Hann Qian | Added 28 Oct | Done |
| [SCRUM-236](../backlog/SCRUM-236.md) | Chore: Name every unit and integration test after the story, criteria and test case it proves, and fix the test-case docs' format | Jin Hong | Added 28 Oct | Done |
| [SCRUM-237](../backlog/SCRUM-237.md) | Chore: Say on the website and in the README that it is the team's development environment, not a service for customers | Jin Hong | Added 28 Oct | Done |
| [SCRUM-238](../backlog/SCRUM-238.md) | Chore: Seed data that lets every role see and try every function | Jin Hong | Added 28 Oct | Done |
| [SCRUM-239](../backlog/SCRUM-239.md) | Chore: Fix what the SCRUM-11 epic check found in the docs and Jira notes | Felicia Or | Added 29 Oct | Done |
| [SCRUM-240](../backlog/SCRUM-240.md) | Bug: The live app hits Supabase's connection limit because the database pool has no maximum | Jun Bin | Added 29 Oct | Done |
| [SCRUM-241](../backlog/SCRUM-241.md) | Bug: The venue availability calendar shows closed hours as available | Jun Bin | Added 29 Oct | Done |
| [SCRUM-243](../backlog/SCRUM-243.md) | Chore: Fix what the SCRUM-6 epic check found in the docs and Jira notes | Felicia Or | Added 29 Oct | Done |
| [SCRUM-244](../backlog/SCRUM-244.md) | Chore: Re-sync docs/backlog for the SCRUM-7 to SCRUM-10 stories whose Customer basis was edited on 29 Oct | Felicia Or | Added 29 Oct | Done |
| [SCRUM-245](../backlog/SCRUM-245.md) | Chore: Stop three integration tests failing when another test file runs at the same time | Felicia Or | Added 29 Oct | Done |
| [SCRUM-246](../backlog/SCRUM-246.md) | Bug: The event request form shows equipment stock as "available" and doesn't show venues' opening hours | Felicia Or | Added 30 Oct | Done |
| [SCRUM-247](../backlog/SCRUM-247.md) | Bug: A Coordinator's edit during re-planning can set expected attendance below the people already registered, overbooking the event | Felicia Or | Added 30 Oct | Done |
| [SCRUM-249](../backlog/SCRUM-249.md) | Bug: An overdue event can still be approved or confirmed, so an event that never happened can end up Completed | Felicia Or | Added 30 Oct | Done |
| [SCRUM-255](../backlog/SCRUM-255.md) | Bug: Sign-in answers faster for an unknown email, which can reveal which accounts exist | Caylern Goh | Added 30 Oct | Done |
| [SCRUM-258](../backlog/SCRUM-258.md) | Bug: A Confirmed event's flagged arrangements read as secured | Felicia Or | Added 1 Nov | Done |
| [SCRUM-259](../backlog/SCRUM-259.md) | Chore: Patch the dependencies GitHub reports as vulnerable | Felicia Or | Added 1 Nov | Done |
| [SCRUM-260](../backlog/SCRUM-260.md) | Chore: Sync docs/backlog for the stories open pull requests need | Hann Qian | Added 1 Nov | Done |
| [SCRUM-261](../backlog/SCRUM-261.md) | Bug: Reserving equipment is refused when the earlier requests it waits for never run at the same time | Jun Bin | Added 1 Nov | Closed as not a bug |
| [SCRUM-262](../backlog/SCRUM-262.md) | Bug: An event that already took place can still be cancelled or sent back to Planning, and All Events shows it as Confirmed | Jin Hong | Added 1 Nov | Done |
| [SCRUM-263](../backlog/SCRUM-263.md) | Bug: The event request form says to fix the highlighted fields but highlights none | Felicia Or | Added 2 Nov | Done |
| [SCRUM-264](../backlog/SCRUM-264.md) | Bug: Seven text boxes over 2,000 characters are refused with no error at the field | Felicia Or | Added 2 Nov | Done |
| [SCRUM-265](../backlog/SCRUM-265.md) | Chore: Record the Sprint 4 response times for SCRUM-132 AC2 | Felicia Or | Added 2 Nov | Done |
| [SCRUM-266](../backlog/SCRUM-266.md) | Chore: Make every step of the demo script match the seed | Felicia Or | Added 3 Nov | Done |
| [SCRUM-267](../backlog/SCRUM-267.md) | Chore: Re-sync docs/backlog for SCRUM-156 after its seed names were updated | Felicia Or | Added 3 Nov | Done |
| [SCRUM-268](../backlog/SCRUM-268.md) | Chore: Fix the docs that no longer match the code: product context, ADR index and Server Actions reference | Felicia Or | Added 3 Nov | Done |
| [SCRUM-269](../backlog/SCRUM-269.md) | Chore: Cite the e2e tests that seven test cases leave out of their Automated by lines | Felicia Or | Added 3 Nov | Done |
| [SCRUM-270](../backlog/SCRUM-270.md) | Chore: Automate TC-132-09's confirmation audit | Felicia Or | Added 3 Nov | Done |
| [SCRUM-271](../backlog/SCRUM-271.md) | Chore: Automate the manual test cases a test can check | Felicia Or | Added 3 Nov | Done |
| [SCRUM-272](../backlog/SCRUM-272.md) | Chore: Sync docs/backlog for SCRUM-269 and SCRUM-270 | Felicia Or | Added 3 Nov | Done |
| [SCRUM-273](../backlog/SCRUM-273.md) | Chore: Check every test title against its story, criteria and case in the test suite | Felicia Or | Added 3 Nov | Done |
| [SCRUM-274](../backlog/SCRUM-274.md) | Chore: Sync docs/backlog for SCRUM-271 and SCRUM-273 | Felicia Or | Added 3 Nov | Done |
| [SCRUM-275](../backlog/SCRUM-275.md) | Chore: Fix the docs that no longer match the code: design reference, evidence, README, ADR 0006 and reviewer memory | Felicia Or | Added 3 Nov | Done |
| [SCRUM-276](../backlog/SCRUM-276.md) | Chore: Record Sprint 3's review, what was demonstrated and accepted, in docs/scrum/sprint-3.md | Caylern Goh | Added 4 Nov | Done |

## Scope changes during the sprint

- **Stories:** none added, none removed, none re-estimated.
- **Points:** on 27 Oct the bugs SCRUM-226, 227 and 229, found by the
  equipment epic check, were given 1 point each; they were set back to 0 at
  close, as the team decided that unplanned bugs and chores found during a
  sprint are not velocity.
- **Tasks added:** 47, among them 14 of the 16 bugs (SCRUM-187 and 202 were in
  at the start), the backlog re-syncs, the test-naming and citation
  work, the seed data for every role (SCRUM-238), and the documentation fixes
  the epic checks found (SCRUM-239, 243).
- **Removed:** SCRUM-219 and 220, the slide deck and the submission zip, which
  were finished outside Jira before the deadline. SCRUM-223 was added and
  removed on 23 Oct, merged into SCRUM-197.
- **Order of work:** only 2 merges on 21 to 24 Oct, and GitHub Actions was
  then locked by a billing issue from 25 to 26 Oct. On 27 Oct 17 pull
  requests merged, the reliability fixes first (SCRUM-202's deadlock, the
  SCRUM-226 and 227 equipment races, the SCRUM-189 and 231 CI time limits), so
  the UI work landed on a stable base.
- **Nothing was carried over.** This was the last sprint.

## Sprint review

Held on Wed 4 Nov 2026 from 1:10pm, about 2 hours 10 minutes, with all five
members, and recorded in two parts (review, then retrospective). Items had
been moved to Done in Jira beforehand and were confirmed on the recording;
anything that didn't hold up on screen would have been reopened.

Each item was judged against its acceptance criteria and the Definition of
Done: merged to `main`, CI green, and the test cases its criteria cite exist.
Each developer demonstrated their own work live with the seed accounts. Race
conditions and the production connection problem can't be shown by clicking,
so those were shown by the tests that prove the fix, or explained.

| Presenter | Items | What was shown | Gaps found |
|---|---|---|---|
| Caylern | SCRUM-207, 208, 209, 210 | Shared conventions on every page and a hamburger menu on the phone; each event on its own page with tabs, and the clarification thread as a chat; finding a venue, requesting equipment and starting the safety check from that page; the menu grouped by task. | The first event tried had no clarification in the seed, so it was shown again on one that had. |
| Caylern | SCRUM-211, 212 | The same columns on the Lead's, Coordinator's and Venue Staff's queues; registration state on every attendee event, and My Registrations. | SCRUM-211 shown by comparing two accounts. |
| Caylern | SCRUM-255 (bug) | Sign-in takes the same time for an unknown email and a wrong password. | None. |
| Felicia | SCRUM-190, 188 | One date with a start and end time, and an end before the start refused; the venue request filled in with exactly the event's period, no longer rounded to the half hour. | None. |
| Felicia | SCRUM-246, 247, 249, 258, 263, 264 (bugs) | Equipment "in stock" and venue opening hours on the form; attendance can't drop below registrations; no approve or confirm on an overdue event; a banner and badge for flagged arrangements on a Confirmed event; the limit shown at the field for over-long text. | None. |
| Jin Hong | SCRUM-186 | More equipment is added by changing the lines of the event's one active request. | None. |
| Jin Hong | SCRUM-229, 226, 227, 262 (bugs) | A quantity of 1.5 refused; two staff can't reserve one line twice, and two simultaneous updates can't both save; a past event can't be cancelled or sent back to Planning. | The two races shown by their passing tests. |
| Jun Bin | SCRUM-241, 187, 202, 240 (bugs) | Each venue's own opening hours and closed days on the calendar; the clarification form no longer stuck on "Sending…"; a venue edit that meets a booking decision retries once; the database pool capped at 3 connections per instance (ADR 0022). | SCRUM-187 and 240 explained, 202 shown by its test. |
| Jun Bin | SCRUM-261 (bug) | Why a reservation waits for earlier requests even when they never overlap: the cautious rule the team chose earlier. | Closed as not a bug; no code change. |

**The Product Owner, Hann Qian, accepted all 9 stories (15 points) and the 15
bug fixes on camera; none was sent back.** Before accepting she asked whether a
work queue's filter, search and sort survive a refresh (they are kept in the
page address on all four queues) and whether the phone menu uses the desktop's
groups (it does). The race and connection fixes were accepted on their
passing tests.

### Epic checks

Each epic's owner checked it against the same five criteria: every story Done
and accepted, every criterion with test cases that point to real tests, the
features working end to end, the problems found fixed, and anything left
recorded as a decision. The PO closed each epic after its report.

| Epic | Checked by | Outcome |
|---|---|---|
| SCRUM-6 Event Request Lifecycle ([SCRUM-213](../backlog/SCRUM-213.md)) | Felicia Or | All 29 stories Done; 312 test cases, none manual; 65 e2e tests across 19 specs. SCRUM-243, 246, 249 and 263 fixed; SCRUM-71 and 123 left as future work. Closed. |
| SCRUM-7 Venue Management ([SCRUM-214](../backlog/SCRUM-214.md)) | Jun Bin | All 18 stories Done; Week 4 features 8 to 14 pass end to end; 29 pages checked at desktop and phone width. SCRUM-241 fixed; SCRUM-261 kept as decided. Closed. |
| SCRUM-8 Event Change & Notifications ([SCRUM-215](../backlog/SCRUM-215.md)) | Hann Qian | All 71 criteria with test cases, checked by the citation check in CI; every feature tried by hand. No bugs found. Closed. |
| SCRUM-9 Access Control ([SCRUM-216](../backlog/SCRUM-216.md)) | Caylern Goh | An automated audit of every role across 24 pages matched the permission table; all 67 Server Actions check permission on the server. SCRUM-255 fixed. Closed. |
| SCRUM-10 Equipment Management ([SCRUM-217](../backlog/SCRUM-217.md)) | Jin Hong | All 10 stories; tests cover all 64 criteria. SCRUM-226, 227 and 229 fixed. Closed. |
| SCRUM-11 Attendee Registration ([SCRUM-218](../backlog/SCRUM-218.md)) | Felicia Or | All 7 stories Done; 62 test cases; 26 e2e tests across 6 specs. SCRUM-247 and 239 fixed; SCRUM-79, 80 and 115 left as future work. Closed. |

### Decisions

1. All 9 stories and the 15 bug fixes accepted; goal met; Sprint 4 closed.
2. SCRUM-261 stays closed as not a bug. A change to the rule would be a new
   story.
3. All six epics (SCRUM-6 to 11) closed on their epic checks.
4. SCRUM-71, 79, 80, 115 and 123 are future work, beyond Release 1; they stay
   in the Jira backlog.
5. The slide deck and the submission zip are finished outside the sprint, due
   Fri 6 Nov, 23:59.
6. The Definition of Done was recapped by the PO on the recording (see
   [definition-of-done.md](definition-of-done.md)). The PO's DoD check for each
   story is to be recorded in the Functional Test Cases and DoD sheet, and the
   three criteria Jun Bin's check showed as partly met resolved, before
   submission.

CI on `main` passed that morning with 3,376 unit and integration tests and all
415 end-to-end tests.

## Retrospective

Held after the review, in Start, Stop, Continue, going round in the order
people presented. Run by Jun Bin, the Scrum Master, with notes on screen.

### Sprint 3's actions, and what came of them

| Sprint 3 action | What happened |
|---|---|
| Someone who didn't build a story tries it before it is Done | Partly. The Product Owner tried each feature before accepting it. |
| Tell the Product Owner early when a story will be late | Partly. The two largest UI pieces were held back three to four days. |
| Stop merging late at night just before stand-up | Not yet. Raised again. |
| Nobody takes more than about a quarter of the items | Not met. Felicia held 28 of the 69 items and Jin Hong 18, mostly chores found by the epic checks. |
| Fix the slow end-to-end tests (SCRUM-189) first | Done. All 415 end-to-end tests passed on `main`. |

### Start, Stop, Continue

| Name | Start | Stop | Continue |
|---|---|---|---|
| Caylern | Telling the team earlier when a big piece is running late, and sharing parts as they are ready | Holding back big pieces until they are finished | Owning all of the UI so one person keeps it consistent; review notes that help teammates |
| Felicia | Sharing big tasks such as the documentation clean-up | Nothing to add | Picking up chores outside her own tasks and helping others |
| Jin Hong | Posting in the stand-up chat before starting a task, not after finishing it | Merging many pull requests late at night at once | Fixing small bugs found outside his own epic instead of passing them on |
| Hann Qian | Reviewing and accepting on the same day | Leaving review and acceptance for three to four days | Trying features before accepting them, and giving timely updates to anyone waiting on a decision |
| Jun Bin | Checking halfway through the sprint who is overloaded | Letting the last retrospective's actions slip without reminding the team | Getting work done early in the sprint and chasing impediments early |

### What went well

- The cleanest burndown of the project: all 15 points accepted, no story
  reopened, nothing carried over.
- Reliability first: the deadlock, the races and the CI time limits were fixed
  before the UI work landed.
- The epic checks found real defects (SCRUM-226, 227, 229) and documentation
  gaps (SCRUM-239, 243) before submission.
- Every task, including all 16 bugs, was logged in Jira before work started
  and linked to its pull request.

### What to improve

- Workload was still uneven: Felicia held 28 of 69 items and Jin Hong 18.
- Late-night merging, and holding back big pieces of work until finished.
- Acceptance was still batched (2 and 4 Nov), because the UI reorganisation had
  to be checked across every role.
- Story points don't show task effort: 60 unpointed tasks sit behind the 15
  points.

### Actions

As the last sprint, its actions apply to the submission.

| Owner | Action | Due |
|---|---|---|
| Jun Bin | Save both recordings and share the retrospective notes | Wed 4 Nov |
| Hann Qian | Upload the recordings as unlisted videos and add the links to the Scrum documentation | Before submission |
| Hann Qian | Record the PO's DoD check for every story in the Functional Test Cases and DoD sheet, and resolve the three partly-met criteria | Before submission |
| Hann Qian | Finalise the slide deck and the submission zip | Fri 6 Nov, 23:59 |
| Everyone | Share work early and avoid last-minute merges on the submission | Fri 6 Nov |

## Burndown

The burndown fell in several steps before the final days, with flat periods
and the small rise on 27 Oct when three bugs were briefly pointed. Every item
was Done by the deadline. The sprint moved from building features to quality:
fixing bugs, strengthening the automated tests, refining usability and
bringing the documentation in line with the system.

## Recordings

| Recording | Date | Link |
|---|---|---|
| Sprint 4 Planning (with Planning Poker) | Wed 21 Oct 2026 | [youtu.be/GEJpDrJ3SSY](https://youtu.be/GEJpDrJ3SSY) |
| Sprint 4 Daily Stand-up | Wed 28 Oct 2026 | [youtu.be/zXbBxfwnBKc](https://youtu.be/zXbBxfwnBKc) |
| Sprint 4 Review | Wed 4 Nov 2026 | [youtu.be/xZU0PmtJXiw](https://youtu.be/xZU0PmtJXiw) |
| Sprint 4 Retrospective | Wed 4 Nov 2026 | [youtu.be/Vn96Mathjmg](https://youtu.be/Vn96Mathjmg) |
