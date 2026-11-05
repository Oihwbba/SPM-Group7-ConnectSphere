# How we estimate

Every figure here comes from Jira and was read on 23 Oct 2026 (Sprint 4's on
6 Nov): the
"Story point estimate" field, each story's change history, and the
**Change log** at the end of its description, mirrored in
[docs/backlog](../backlog/README.md).

## The point scale

Stories are estimated in story points on **1, 2, 3, 5 and 8**, with **0** for
a story merged into another. Two change logs show that values off this scale
are rounded onto it:

- SCRUM-71: "Re-estimated from 4 (not on the scale) to 5."
- SCRUM-120: "Re-estimated from 6 (not on the scale) to 8."

How many of Jira's 97 stories carry each value:

| Points | Stories | Example |
|---|---|---|
| 0 | 6 | [SCRUM-109](../backlog/SCRUM-109.md), merged into SCRUM-108; [SCRUM-33](../backlog/SCRUM-33.md), merged into SCRUM-27 |
| 1 | 11 | [SCRUM-23](../backlog/SCRUM-23.md): View an event's current status |
| 2 | 27 | [SCRUM-65](../backlog/SCRUM-65.md): Sign in to the system |
| 3 | 32 | [SCRUM-66](../backlog/SCRUM-66.md): See only the functions my role allows |
| 5 | 18 | [SCRUM-24](../backlog/SCRUM-24.md): Keep event status consistent with actions taken |
| 8 | 2 | [SCRUM-166](../backlog/SCRUM-166.md): Operational safety check, after SCRUM-167 was merged into it |

One story, [SCRUM-153](../backlog/SCRUM-153.md), has no estimate.

The examples are the team's reference stories: Done stories it compares new
work against at each value.

| Points | What the reference story involves |
|---|---|
| 0 | No work of its own; its points moved to the story it was merged into |
| 1 | One read-only view, one role, no state change |
| 2 | One flow with validation and an error path |
| 3 | Rules applied across several pages and roles |
| 5 | A rule every other story depends on, with concurrency |
| 8 | A new role, queue and gate on confirmation, with outdating rules |

**How an estimate is reached.** By Planning Poker
(planningpokeronline.com) at every sprint planning. Each voter picks a card
before the reveal; the highest and lowest explain their reasoning, then the
team votes again until it agrees. The developers and the Scrum Master vote
while the Product Owner explains each story. Sprint 1 was the exception: the
PO role rotates and every PO is a developer in other sprints, so the whole
team, PO included, voted at the pre-planning session on 6 Sep to build a
shared feel for the scale. Anything above 8 is split before it is committed.
Stories are re-estimated the same day the PO adds or removes a criterion.

From the team's Scrum and Sprint Documentation (submission folder 4), "How
Estimates Are Reached".

### Tasks

Of Jira's 61 tasks, 53 have no estimate and 4 are 0 points, so technical
work mostly doesn't count towards velocity. The exceptions are SCRUM-145 (2),
SCRUM-147 (2), SCRUM-169 (1) and SCRUM-172 (3), all in Sprint 3. SCRUM-169
gives the reason: "the Sprint 2 docs refresh (SCRUM-157) was logged as a
0-point chore, so the work didn't count in the sprint. Keeping the
repository's backlog in step with Jira is planned work, so it is estimated."

## Velocity

Velocity is the story points Done by the time the sprint closed, at today's
estimates. The sprint records give the stories behind each figure.

| Sprint | Committed at start | Added during | Done by close | Stories done |
|---|---|---|---|---|
| [Sprint 1](sprint-1.md) | 34 | 3 | **37** | 16 |
| [Sprint 2](sprint-2.md) | 45 | 11 | **56** | 25 |
| [Sprint 3](sprint-3.md) | 124 (120 at today's estimates) | 6 | **126** | 34 |
| [Sprint 4](sprint-4.md) | 15 | 0 | **15** | 9 |

At the Sprint 1 review the team counted 31 of the 37 points, leaving out
SCRUM-13, 15 and 31 because their tests were incomplete
([Sprint 1 review](sprint-1.md#sprint-review)). This table keeps the Jira
figure so every sprint is measured the same way.

No sprint left a story unfinished. At today's estimates, the points done in
each sprint equal the points committed plus the points added.

## Sprint 3's commitment against velocity

Sprint 3 started with **124 points** committed, against velocities of 37 and
56: 2.2 times Sprint 2, and 2.7 times their average. Its goal set the
commitment as the Highest-priority stories:

- **97 points** were Highest priority.
- **27 points** were labelled `stretch`, to follow.
- **42 points** were stories labelled `week7-change`, the customer's Week 7
  changes.

All 34 stories were Done by close.

Why the team committed that much: it chose to take all of the remaining
Release 1 stories so that Sprint 4 would be kept for fixes, re-checks and the
submission, as it had learnt many teams do. The cost was a ten-day flat
burndown while dependent stories waited for one another ([Sprint
3](sprint-3.md#commitment-against-velocity)).

What it changed in planning: Sprint 3's velocity is not a benchmark. Sprint 4
committed **15 points**, 0.1 times Sprint 3 by design, and logged its hardening
work (16 bugs, 6 epic checks and 38 other chores) as unpointed tasks. All 15
points were Done ([Sprint 4](sprint-4.md#commitment-against-velocity)).

### Unplanned bugs and points

Sprint 4 set its three mid-sprint bugs (SCRUM-226, 227, 229) from 1 point back
to 0 at close, as the team decided that unplanned bugs and chores found during
a sprint are not velocity. That differs from Sprint 3, which pointed four
planned tasks. The lesson: decide the rule at planning, not at close.

## Every re-estimate

From the stories' change logs, oldest first.

| Story | From | To | Date | Reason in the change log |
|---|---|---|---|---|
| [SCRUM-38](../backlog/SCRUM-38.md) | – | – | 1 Oct | "Re-estimate at planning: the pre-fill and the request link add work." (no new value recorded) |
| [SCRUM-45](../backlog/SCRUM-45.md) | 6 | 5 | 1 Oct | Rewritten as one table of triggers and recipients; staff notifications moved to SCRUM-124 |
| [SCRUM-71](../backlog/SCRUM-71.md) | 4 | 5 | 1 Oct | Back in scope; 4 is not on the scale |
| [SCRUM-108](../backlog/SCRUM-108.md) | 3 | 5 | 1 Oct | SCRUM-109 merged into it |
| [SCRUM-120](../backlog/SCRUM-120.md) | 6 | 8 | 1 Oct | Calendar behaviour added; 6 is not on the scale |
| [SCRUM-85](../backlog/SCRUM-85.md) | 3 | 5 | 7 Oct | SCRUM-133 merged into it |
| [SCRUM-124](../backlog/SCRUM-124.md) | 3 | 5 | 7 Oct | Week 7 changes 1, 2, 4, 5 and 6 add notification triggers |
| [SCRUM-131](../backlog/SCRUM-131.md) | 1 | 2 | 7 Oct | Week 7 changes 4 to 6 add statuses |
| [SCRUM-135](../backlog/SCRUM-135.md) | 2 | 3 | 7 Oct | Week 7 changes 5 and 6 |
| [SCRUM-141](../backlog/SCRUM-141.md) | 3 | 5 | 7 Oct | Week 7 changes 3 and 5: the Lead's view of assignments |
| [SCRUM-166](../backlog/SCRUM-166.md) | 5 | 8 | 7 Oct | SCRUM-167 merged into it |
| [SCRUM-75](../backlog/SCRUM-75.md) | 3 | 2 | 8 Oct | Setting and extending the registration window removed (PO approved) |
| [SCRUM-132](../backlog/SCRUM-132.md) | 3 | 2 | 8 Oct | The 2,000-event load test dropped (PO approved) |
| [SCRUM-171](../backlog/SCRUM-171.md) | 2 | 3 | 8 Oct | AC5 added for changing the answer after submission (PO approved) |
| [SCRUM-82](../backlog/SCRUM-82.md) | 5 | 3 | 9 Oct | Closure record (old AC11) removed at PO review |
| [SCRUM-163](../backlog/SCRUM-163.md) | – | 3 (remaining work) | 13 Oct | "Remaining work re-estimated at 3 points" after the W9 clarification; the Jira field still reads 5 |

Change logs that say a change needed no re-estimate:

- SCRUM-171 on 17 Oct
- SCRUM-75 on 17 Oct
- SCRUM-82 on 18 Oct

Jira's change histories also show estimate edits that have no change-log
note:

- SCRUM-13, 20 and 24, on 19 Sep, during Sprint 1;
- SCRUM-27, 30, 110 and 155, and the two merged stories, during Sprint 2.

Their before and after values aren't in the change logs, so they are not in
the table above.
