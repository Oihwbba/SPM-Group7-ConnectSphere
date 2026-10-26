# Sprint 1

**Goal (Jira):** "An event request can travel from creation through to a
Coordinator's approval decision, with every action gated by the user's role."

| | |
|---|---|
| Started | 9 Sep 2026, 13:14 SGT |
| Planned end | 23 Sep 2026, 13:14 SGT |
| Closed | 23 Sep 2026, 21:06 SGT |
| Stories | 16 (16 Done by close) |
| Points committed at start | 34 (15 stories) |
| Points added during the sprint | 3 (SCRUM-31, on 10 Sep) |
| Points done by close | **37**: this sprint's velocity |
| Points counted at the review | 31: SCRUM-13, 15 and 31 (6 points) left out for incomplete tests (see [Sprint review](#sprint-review)) |
| Highest-priority points | 35 of 37 |
| Pull requests merged into `main` | 52 (#1 to #78) |

Sources: the sprint's dates and goal from Jira's board (sprint 1); stories,
points and statuses from Jira, and when each entered the sprint and reached
Done from its change history, read on 23 Oct 2026. Pull requests from
`gh pr list --state merged --base main`, by merge time. Points are the
estimates in Jira today. No Sprint 1 story's change log records a re-estimate,
but Jira's history shows estimate edits on SCRUM-13, 20 and 24 on 19 Sep,
during the sprint. Their old values aren't recorded (see
[estimation.md](estimation.md)).

## Stories

| Story | Summary | Points | Priority | In the sprint | Outcome |
|---|---|---|---|---|---|
| [SCRUM-13](../backlog/SCRUM-13.md) | Create an event request | 2 | Highest | At start | Done 23 Sep (reopened 14 Sep, 19 Sep, 23 Sep and closed again); reopened 7 Oct after the sprint, Done again 7 Oct |
| [SCRUM-14](../backlog/SCRUM-14.md) | Submit an event request for review | 1 | Highest | At start | Done 21 Sep |
| [SCRUM-15](../backlog/SCRUM-15.md) | Save an event request as a draft | 1 | High | At start | Done 23 Sep (reopened 14 Sep, 19 Sep, 23 Sep and closed again); reopened 20 Oct after the sprint, Done again 21 Oct |
| [SCRUM-16](../backlog/SCRUM-16.md) | Distinguish drafts from submitted requests | 1 | Medium | At start | Done 23 Sep (reopened 14 Sep, 19 Sep, 23 Sep and closed again) |
| [SCRUM-17](../backlog/SCRUM-17.md) | Review a submitted event request | 1 | Highest | At start | Done 21 Sep |
| [SCRUM-18](../backlog/SCRUM-18.md) | Request clarification on an event under review | 2 | Highest | At start | Done 21 Sep |
| [SCRUM-19](../backlog/SCRUM-19.md) | Approve or reject an event request | 2 | Highest | At start | Done 21 Sep |
| [SCRUM-20](../backlog/SCRUM-20.md) | Auto-assign a coordinator to a submitted event | 3 | Highest | At start | Done 21 Sep |
| [SCRUM-23](../backlog/SCRUM-23.md) | View an event's current status | 1 | Highest | At start | Done 19 Sep |
| [SCRUM-24](../backlog/SCRUM-24.md) | Keep event status consistent with actions taken | 5 | Highest | At start | Done 21 Sep |
| [SCRUM-31](../backlog/SCRUM-31.md) | Reserve Equipment for Event | 3 | Highest | Added 10 Sep | Done 19 Sep |
| [SCRUM-65](../backlog/SCRUM-65.md) | Sign in to the system | 2 | Highest | At start | Done 10 Sep |
| [SCRUM-66](../backlog/SCRUM-66.md) | See only the functions my role allows | 3 | Highest | At start | Done 21 Sep (reopened 10 Sep and closed again) |
| [SCRUM-67](../backlog/SCRUM-67.md) | Be prevented from performing an action my role does not permit | 5 | Highest | At start | Done 21 Sep (reopened 20 Sep and closed again) |
| [SCRUM-68](../backlog/SCRUM-68.md) | View only the events I own | 3 | Highest | At start | Done 21 Sep (reopened 10 Sep and closed again) |
| [SCRUM-84](../backlog/SCRUM-84.md) | Organiser views their own event requests | 2 | Highest | At start | Done 23 Sep (reopened 14 Sep, 19 Sep, 23 Sep and closed again) |

"Reopened … and closed again" means the story went back from Done during the
sprint and was finished again before it closed.

## Tasks

| Task | Summary | Points | In the sprint | Outcome |
|---|---|---|---|---|
| [SCRUM-88](../backlog/SCRUM-88.md) | Add GLM-5.3 automated code review to pull requests (GitHub Actions) | - | Added 16 Sep | Done 16 Sep |
| [SCRUM-89](../backlog/SCRUM-89.md) | CI and developer infrastructure: Node 24, CI hardening, test folders, security upgrades, migration sync | - | Added 16 Sep | Done 16 Sep |

## Scope changes during the sprint

- **Added:** SCRUM-31 (Reserve Equipment for Event, 3 points) joined on
  10 Sep, the day after the sprint started.
- **Tooling recorded after the fact:** SCRUM-88 (the GLM reviewer) and SCRUM-89
  (CI and developer infrastructure) were created on 14 Sep and put into the
  sprint and closed on 16 Sep, after the work was done.
- **Nothing was removed** and nothing was carried over to Sprint 2.
- **Reopened during the sprint:** SCRUM-13, 15, 16 and 84 went back from Done
  on 14 Sep, 19 Sep and the morning of 23 Sep, and SCRUM-66, 67 and 68 on
  10 Sep and 20 Sep. All were Done again before the sprint closed.

## Sprint review

Held on Wed 23 Sep 2026 at 12.29pm, online, with all five members, together
with the retrospective and Sprint 2 planning. Source: the minutes in the
team's SPM Documentation (Google Docs, "Sprint 1 Minutes" tab) and the
meeting transcript in Drive.

- **Product Owner:** Jin Hong, who also reviewed and merged pull requests.
  Felicia was Scrum Master.
- **Accepted:** all 16 stories stayed Done and the sprint was closed that
  day. The minutes record the goal as met.
- **Counted towards velocity:** 31 of the 37 points. SCRUM-13, 15 and 31
  (6 points) stayed Done but weren't counted, because their test coverage was
  incomplete at the review. The Sprint 2 chore SCRUM-114 finished it. No story
  was sent back.

| Presenter | Stories | What was shown | Gaps found |
|---|---|---|---|
| Jun Bin | SCRUM-23 | An Organiser sees an event's current status at any time. | None |
| Jun Bin | SCRUM-31 | Technical Support reserves equipment: positive quantity within the pool, end after start, availability updates (7 → 5 after reserving 2). | Tests incomplete |
| Caylern | SCRUM-65 to 68 | Sign-in with invalid-credential handling; role-based access, including refusing direct URLs; the base UI on web and mobile. | Some classes still needed unit tests |
| Felicia | SCRUM-13 | The event request form: mandatory and optional fields, attendance above zero, date validation, character limits, times stored as UTC. | Tests incomplete |
| Felicia | SCRUM-15, 16 | Drafts save with missing fields, are marked and can be resumed; an unsaved-changes warning; Coordinators can't see drafts; filter and sort. | SCRUM-15 tests incomplete |
| Hann Qian | SCRUM-14 | Submission blocked, with errors highlighted, when mandatory fields are missing; a submitted request can't be submitted again. | Showed Under Review straight away |
| Hann Qian | SCRUM-20 | Each submitted event is assigned to exactly one Coordinator, spread fairly; it stays Submitted if there is none. | No maximum per Coordinator defined |
| Hann Qian | SCRUM-17 to 19 | The Coordinator reviews, asks for clarification, approves, or rejects with a reason. | A mobile layout issue on the clarification screen |

SCRUM-24 and 84 are Done but the minutes don't record them as demonstrated.

Issues raised and what was decided:

- **SCRUM-14:** a request stays Submitted until a Coordinator is assigned,
  then Under Review. SCRUM-14 to be amended.
- **Planning and Under Review:** the customer said verbally they are the
  same; to be confirmed in writing.
- **Coordinator workload:** no maximum; assignment is least-loaded. SCRUM-20
  was updated on 23 Sep.
- **Missing tests:** a story isn't Done until its unit and end-to-end tests
  are complete and documented. This became the Definition of Done
  ([definition-of-done.md](definition-of-done.md)).

What Jira and git already show:

- Two Sprint 1 stories were reopened later and closed again:
  - **SCRUM-13** on 7 Oct. It was put into Sprint 3 and taken out again the
    same evening.
  - **SCRUM-15** on 20–21 Oct, when its AC9 was reworded after the 20 Oct
    audit.

## Retrospective

Held at the same meeting, as Start, Stop, Continue. Source: the 23 Sep
minutes.

### What went well

- Consistent communication.
- At least three stand-ups in the sprint.

### What to improve

- Stop making last-minute changes.
- Stop merging without tests.
- Start documenting work as it is done.

### Actions, and what came of them

| Action | Owner | What came of it |
|---|---|---|
| Finish the missing unit and end-to-end tests for Sprint 1's stories | Each story owner | Done in Sprint 2 by SCRUM-114, 29 Sep |
| Make complete, documented tests part of Done | The team | The Definition of Done, kept in the Functional Test Cases and DoD sheet and in [definition-of-done.md](definition-of-done.md) |
| Hold at least three stand-ups a sprint | Jun Bin, Scrum Master for Sprint 2 | Planned for 25 Sep, 29 Sep and 2 Oct; the calendar records the 29 Sep mid-sprint sync |

Follow-ups the backlog already records:

- **SCRUM-114** (Sprint 2): "Three stories closed in Sprint 1 had not met
  the test coverage requirement in our Definition of Done at sprint close.
  Complete the remaining unit tests in Sprint 2 and link this chore to each
  affected story." Done 29 Sep.
