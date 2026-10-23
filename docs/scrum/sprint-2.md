# Sprint 2

**Goal (Jira):** "Every main flow works start to finish: a venue can be booked
and decided on, equipment can be requested and reviewed, an attendee can
register and is blocked when it's full, and an event can reach Confirmed."

| | |
|---|---|
| Started | 23 Sep 2026, 21:07 SGT |
| Planned end | 7 Oct 2026, 13:14 SGT |
| Closed | 7 Oct 2026, 18:20 SGT |
| Stories | 25 (25 Done by close) |
| Points committed at start | 45 (19 stories) |
| Points added during the sprint | 11 (6 stories) |
| Points done by close | **56**: this sprint's velocity |
| Highest-priority points | 31 of 56 |
| Pull requests merged into `main` | 48 (#79 to #140) |

Sources as for [Sprint 1](sprint-1.md): Jira's board, each item's change
history read on 23 Oct 2026, and `gh pr list`. Points are today's estimates. Jira also shows estimate changes
during this sprint on SCRUM-27, 30, 33, 108, 109, 110 and 155. Only SCRUM-108's has
a change-log note: 3 to 5 on 1 Oct, after SCRUM-109 was merged into it.
SCRUM-33 and SCRUM-109 were merged into other stories (SCRUM-27, SCRUM-108)
and are 0 points.

## Stories

| Story | Summary | Points | Priority | In the sprint | Outcome |
|---|---|---|---|---|---|
| [SCRUM-27](../backlog/SCRUM-27.md) | Create an equipment request | 2 | Highest | At start | Done 5 Oct |
| [SCRUM-28](../backlog/SCRUM-28.md) | Review and update an equipment request | 3 | Highest | At start | Done 5 Oct |
| [SCRUM-29](../backlog/SCRUM-29.md) | Check equipment availability | 3 | Highest | At start | Done 5 Oct (reopened 24 Sep and closed again) |
| [SCRUM-30](../backlog/SCRUM-30.md) | View equipment conflicts | 3 | Medium | At start | Done 5 Oct (reopened 24 Sep and closed again) |
| [SCRUM-33](../backlog/SCRUM-33.md) | [MERGED INTO SCRUM-27] View Event Reservations | 0 | Medium | At start | Done 30 Sep |
| [SCRUM-36](../backlog/SCRUM-36.md) | View venue availability | 2 | Highest | At start | Done 4 Oct |
| [SCRUM-37](../backlog/SCRUM-37.md) | Record venue unavailability and reflect it everywhere | 3 | Highest | At start | Done 4 Oct |
| [SCRUM-50](../backlog/SCRUM-50.md) | Submit a venue booking request | 2 | Highest | At start | Done 5 Oct (reopened 4 Oct and closed again) |
| [SCRUM-52](../backlog/SCRUM-52.md) | Review pending booking requests | 2 | Highest | At start | Done 4 Oct |
| [SCRUM-53](../backlog/SCRUM-53.md) | Approve or reject a booking request | 2 | Highest | At start | Done 4 Oct |
| [SCRUM-69](../backlog/SCRUM-69.md) | View only the events assigned to me | 2 | High | At start | Done 6 Oct |
| [SCRUM-72](../backlog/SCRUM-72.md) | View an event I could attend | 2 | Highest | At start | Done 4 Oct |
| [SCRUM-73](../backlog/SCRUM-73.md) | Register for an event | 2 | Highest | At start | Done 4 Oct |
| [SCRUM-74](../backlog/SCRUM-74.md) | Be prevented from registering for a full event | 3 | High | At start | Done 4 Oct |
| [SCRUM-76](../backlog/SCRUM-76.md) | View my registration status | 1 | High | At start | Done 4 Oct |
| [SCRUM-81](../backlog/SCRUM-81.md) | Move an approved event through planning to confirmed | 5 | Highest | At start | Done 4 Oct |
| [SCRUM-108](../backlog/SCRUM-108.md) | Answer a clarification, or amend and resubmit a rejected request | 5 | High | At start | Done 5 Oct |
| [SCRUM-109](../backlog/SCRUM-109.md) | [MERGED INTO SCRUM-108] Respond to an event clarification request | 0 | High | At start | Done 30 Sep |
| [SCRUM-110](../backlog/SCRUM-110.md) | See an event's readiness checklist | 3 | Highest | At start | Done 5 Oct (reopened 5 Oct and closed again) |
| [SCRUM-117](../backlog/SCRUM-117.md) | Reject an event that can't be fulfilled | 2 | Medium | Added 30 Sep | Done 5 Oct (reopened 5 Oct and closed again) |
| [SCRUM-126](../backlog/SCRUM-126.md) | Coordinator decides whether a rejected request is amended or submitted as new | 2 | Medium | Added 1 Oct | Done 5 Oct (reopened 5 Oct and closed again) |
| [SCRUM-129](../backlog/SCRUM-129.md) | Show and store all event times in Singapore time | 1 | Medium | Added 2 Oct | Done 4 Oct |
| [SCRUM-130](../backlog/SCRUM-130.md) | Discard a draft request | 1 | Medium | Added 2 Oct | Done 7 Oct |
| [SCRUM-155](../backlog/SCRUM-155.md) | Reserve an approved equipment request in one step, pre-filled from the Coordinator's request (follow-up to SCRUM-31) | 3 | Medium | Added 5 Oct | Done 6 Oct |
| [SCRUM-156](../backlog/SCRUM-156.md) | Make the one-type equipment form availability-only (follow-up to SCRUM-31 and SCRUM-155) | 2 | Medium | Added 5 Oct | Done 6 Oct |

## Tasks

| Task | Summary | Points | In the sprint | Outcome |
|---|---|---|---|---|
| [SCRUM-114](../backlog/SCRUM-114.md) | Chore: Sprint 1 post-DoD test hardening and code hygiene cleanup | 0 | Added 24 Sep | Done 29 Sep (reopened 29 Sep and closed again) |
| [SCRUM-116](../backlog/SCRUM-116.md) | Sync Jira User Stories into Github Repo on User Story Changes | - | Added 30 Sep | Done 7 Oct |
| [SCRUM-125](../backlog/SCRUM-125.md) | Measure coverage on every server-side file and fail CI when it drops | - | Added 30 Sep | Done 1 Oct |
| [SCRUM-157](../backlog/SCRUM-157.md) | Chore: Refresh the project docs so people and AI tools read one consistent, current guide | 0 | Added 7 Oct | Done 7 Oct |

## Scope changes during the sprint

Added during the sprint (11 points):

| Story | Points | Added | Why |
|---|---|---|---|
| SCRUM-117 | 2 | 30 Sep | Created 30 Sep: reject a Planning event that can't be fulfilled. |
| SCRUM-126 | 2 | 1 Oct | Split out of SCRUM-108 at the 1 Oct refinement: the Coordinator's choice of outcome. |
| SCRUM-129 | 1 | 2 Oct | Created 1 Oct: store and show every time in Singapore time. |
| SCRUM-130 | 1 | 2 Oct | Created 1 Oct: discard a draft. |
| SCRUM-155 | 3 | 5 Oct | Created 4 Oct: reserve an approved request in one step. |
| SCRUM-156 | 2 | 5 Oct | Created 4 Oct, the follow-up to SCRUM-155. |

Tasks created during the sprint: SCRUM-114 (Sprint 1's missing tests),
SCRUM-116 (sync Jira stories into the repo), SCRUM-125 (fail CI when coverage
drops) and SCRUM-157 (refresh the project docs, added on the last day).

Merged during the sprint: SCRUM-33 into SCRUM-27 and SCRUM-109 into SCRUM-108,
both on 30 Sep.

Nothing was carried over to Sprint 3.

## Sprint review

_To be completed by the team._ Who was Product Owner, what was demonstrated, and which stories the
Product Owner accepted or sent back.

## Retrospective

### What went well

_To be completed by the team._

### What to improve

_To be completed by the team._

### Actions, and what came of them

_To be completed by the team._
