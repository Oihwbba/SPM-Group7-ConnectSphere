# How we estimate

Every figure here comes from Jira and was read on 23 Oct 2026: the
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

The examples are Done stories at each value, picked from Jira. Whether they
are the stories the team actually compares new work against: _To be
completed by the team._

How an estimate is reached, who takes part and when stories are estimated:
_To be completed by the team._

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

Why the team committed that much, and what it changes in planning: _To be
completed by the team._ Sprint 4 started with 15 points committed, according
to the [backlog index](../backlog/README.md).

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
