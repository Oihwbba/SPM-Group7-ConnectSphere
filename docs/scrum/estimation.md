# Estimation and velocity

Figures read from Jira on 2026-10-19. Each story's own change log in
[`docs/backlog/`](../backlog/README.md) records why its estimate changed.

## The scale

Stories are estimated in **story points on 1, 2, 3, 5 and 8**: relative size,
covering the work, the rules to get right and the tests that prove them, not
hours. Two estimates of 6 and 4 were corrected for being "not on the scale"
(SCRUM-120, SCRUM-71). A story merged into another keeps its key at
**0 points**, so its history stays linked (SCRUM-33, SCRUM-109, SCRUM-133,
SCRUM-167). Tasks (technical work, `Chore:`) are not estimated and don't count
towards velocity.

A story too big for one sprint is split before planning: SCRUM-127 was split
into SCRUM-170 and SCRUM-171 on 7 Oct for that reason.

### Reference stories

Proposed anchors, chosen from Done stories at each value. *To be confirmed by
the team*, and used as the comparison at planning: "is this bigger or smaller
than SCRUM-29?"

| Points | Reference story | What made it that size |
|---|---|---|
| 1 | [SCRUM-14](../backlog/SCRUM-14.md) Submit an event request for review | One status change through the existing gate |
| 2 | [SCRUM-13](../backlog/SCRUM-13.md) Create an event request | One form and one action, with validation |
| 3 | [SCRUM-29](../backlog/SCRUM-29.md) Check equipment availability | A rule over overlapping periods, tested against a real database |
| 5 | [SCRUM-67](../backlog/SCRUM-67.md) Be prevented from performing an action my role does not permit | A rule every action must follow, tested for every role |
| 8 | [SCRUM-166](../backlog/SCRUM-166.md) Operational safety check | A new role's workflow, its own records, and a gate on confirmation (two stories merged) |

### How the estimates are spread

Across the 75 stories in Sprints 1 to 3:

| Points | 0 | 1 | 2 | 3 | 5 | 8 |
|---|---|---|---|---|---|---|
| Stories | 2 | 8 | 21 | 27 | 16 | 1 |

The average estimate rose from 2.3 points (Sprint 1) and 2.4 (Sprint 2) to
3.7 (Sprint 3): the Week 7 stories are larger, so Sprint 3's 34 stories carry
more than twice Sprint 2's points.

## Velocity

Points of stories Done when the sprint closed.

| Sprint | Planned | Added during | Done | Carried over |
|---|---|---|---|---|
| [Sprint 1](sprint-1.md) | 37 | 0 | **37** | 0 |
| [Sprint 2](sprint-2.md) | 45 | 11 | **56** | 0 |
| [Sprint 3](sprint-3.md) | 97 committed (126 in the sprint) | 0 | 45 by 19 Oct; *final at close* | *at close* |

Average velocity over Sprints 1 and 2: **46.5 points**.

**Sprint 3's commitment against it.** The goal committed to 97 points of
Highest-priority stories, about twice the average velocity, with 28 more
points labelled stretch. On 19 Oct, two days before the end, 45 points were
Done and 81 In Review or In Progress (the breakdown is in
[sprint-3.md](sprint-3.md#outcome-so-far-19-oct)).

*To be completed by the team at the retrospective:* why that commitment was
made, what the team learned from it, and the velocity the next plan uses.
Planning on the average of the last sprints actually completed, and taking the
remaining Highest stories first, keeps the next plan within what the team has
shown it can finish.

## Re-estimates

Every re-estimate recorded in a story's change log, newest last.

| Date | Story | From → to | Why (from the change log) |
|---|---|---|---|
| 1 Oct | [SCRUM-108](../backlog/SCRUM-108.md) | 3 → 5 | SCRUM-109 merged into it |
| 1 Oct | [SCRUM-45](../backlog/SCRUM-45.md) | 6 → 5 | Staff notifications moved to SCRUM-124 |
| 1 Oct | [SCRUM-71](../backlog/SCRUM-71.md) | 4 → 5 | Back in scope; 4 is not on the scale |
| 1 Oct | [SCRUM-120](../backlog/SCRUM-120.md) | 6 → 8 | Calendar behaviour added; 6 is not on the scale |
| 1 Oct | [SCRUM-38](../backlog/SCRUM-38.md) | re-estimate at planning | Opening from an event, and requesting from a result, add work |
| 7 Oct | [SCRUM-85](../backlog/SCRUM-85.md) | 3 → 5 | SCRUM-133 merged into it |
| 7 Oct | [SCRUM-124](../backlog/SCRUM-124.md) | 3 → 5 | Week 7 triggers: holds, unavailability, the Lead's queue, safety checks |
| 7 Oct | [SCRUM-131](../backlog/SCRUM-131.md) | 1 → 2 | Held, Expired and safety check statuses added |
| 7 Oct | [SCRUM-135](../backlog/SCRUM-135.md) | 2 → 3 | The Lead assigns; resubmissions return to the queue |
| 7 Oct | [SCRUM-141](../backlog/SCRUM-141.md) | 3 → 5 | The Lead's filters and each Coordinator's active-event count |
| 7 Oct | [SCRUM-166](../backlog/SCRUM-166.md) | 5 → 8 | SCRUM-167 merged into it; neither could be demonstrated alone |
| 8 Oct | [SCRUM-75](../backlog/SCRUM-75.md) | 3 → 2 | Setting and extending the window removed (not asked for) |
| 8 Oct | [SCRUM-132](../backlog/SCRUM-132.md) | 3 → 2 | The 2,000-event load test dropped; operations timed on the seed data |
| 8 Oct | [SCRUM-170](../backlog/SCRUM-170.md) | stays 3 | Removing the pre-fill offsets the new No equipment needed decision |
| 8 Oct | [SCRUM-171](../backlog/SCRUM-171.md) | 2 → 3 | Changing the answer after submission added (AC5) |
| 9 Oct | [SCRUM-82](../backlog/SCRUM-82.md) | 5 → 3 | Closure record (AC11) removed at Product Owner review |
| 13 Oct | [SCRUM-163](../backlog/SCRUM-163.md) | remaining work: 3 | Venue Staff approve a hold before the Coordinator confirms it |
| 17 Oct | SCRUM-75, SCRUM-171 | no change | A criterion moved to SCRUM-128; the rule built here is reused |

Estimates are revised at refinement when scope changes, before the story is
started; a Done story is never reopened or re-estimated, and new work on it
becomes a new story (for example SCRUM-126, SCRUM-129 and SCRUM-130).
