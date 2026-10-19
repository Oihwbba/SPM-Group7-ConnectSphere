# Sprint 2 — 23 September to 7 October 2026

Figures read from Jira on 2026-10-19 (board 1, sprint id 34). The sprint was
closed in Jira on 7 Oct 2026. "Added during the sprint" means the story was
created after the sprint started (23 Sep); Jira's change history would show
the exact day each was moved in.

## Goal

> Every main flow works start to finish: a venue can be booked and decided on,
> equipment can be requested and reviewed, an attendee can register and is
> blocked when it's full, and an event can reach Confirmed.

## Commitment and outcome

| | Stories | Points |
|---|---|---|
| In the sprint at planning | 19 | 45 |
| Added during the sprint | 6 | 11 |
| Done | 25 | **56** |
| Carried over | 0 | 0 |

Two of the 25 are 0-point stories merged into others during refinement:
SCRUM-33 into SCRUM-27, and SCRUM-109 into SCRUM-108 (re-estimated from 3 to
5 for it).

## Stories

| Story | Summary | Pts | Assignee | Outcome |
|---|---|---|---|---|
| [SCRUM-27](../backlog/SCRUM-27.md) | Create an equipment request | 2 | Jin Hong | Done |
| [SCRUM-28](../backlog/SCRUM-28.md) | Review and update an equipment request | 3 | Jin Hong | Done |
| [SCRUM-29](../backlog/SCRUM-29.md) | Check equipment availability | 3 | Jin Hong | Done |
| [SCRUM-30](../backlog/SCRUM-30.md) | View equipment conflicts | 3 | Jin Hong | Done |
| [SCRUM-33](../backlog/SCRUM-33.md) | [Merged into SCRUM-27] View event reservations | 0 | Jin Hong | Done |
| [SCRUM-36](../backlog/SCRUM-36.md) | View venue availability | 2 | Caylern Goh | Done |
| [SCRUM-37](../backlog/SCRUM-37.md) | Record venue unavailability and reflect it everywhere | 3 | Caylern Goh | Done |
| [SCRUM-50](../backlog/SCRUM-50.md) | Submit a venue booking request | 2 | Caylern Goh | Done |
| [SCRUM-52](../backlog/SCRUM-52.md) | Review pending booking requests | 2 | Caylern Goh | Done |
| [SCRUM-53](../backlog/SCRUM-53.md) | Approve or reject a booking request | 2 | Caylern Goh | Done |
| [SCRUM-69](../backlog/SCRUM-69.md) | View only the events assigned to me | 2 | Liew Hann Qian | Done |
| [SCRUM-72](../backlog/SCRUM-72.md) | View an event I could attend | 2 | Liew Hann Qian | Done |
| [SCRUM-73](../backlog/SCRUM-73.md) | Register for an event | 2 | Liew Hann Qian | Done |
| [SCRUM-74](../backlog/SCRUM-74.md) | Be prevented from registering for a full event | 3 | Liew Hann Qian | Done |
| [SCRUM-76](../backlog/SCRUM-76.md) | View my registration status | 1 | Liew Hann Qian | Done |
| [SCRUM-81](../backlog/SCRUM-81.md) | Move an approved event through planning to confirmed | 5 | Yiam Jun Bin | Done |
| [SCRUM-108](../backlog/SCRUM-108.md) | Answer a clarification, or amend and resubmit a rejected request | 5 | Yiam Jun Bin | Done |
| [SCRUM-109](../backlog/SCRUM-109.md) | [Merged into SCRUM-108] Respond to an event clarification request | 0 | Yiam Jun Bin | Done |
| [SCRUM-110](../backlog/SCRUM-110.md) | See an event's readiness checklist | 3 | Yiam Jun Bin | Done |
| [SCRUM-117](../backlog/SCRUM-117.md) | Reject an event that can't be fulfilled *(added 30 Sep)* | 2 | Yiam Jun Bin | Done |
| [SCRUM-126](../backlog/SCRUM-126.md) | Coordinator decides whether a rejected request is amended or submitted as new *(added 1 Oct)* | 2 | Yiam Jun Bin | Done |
| [SCRUM-129](../backlog/SCRUM-129.md) | Show and store all event times in Singapore time *(added 1 Oct)* | 1 | Felicia Or | Done |
| [SCRUM-130](../backlog/SCRUM-130.md) | Discard a draft request *(added 1 Oct)* | 1 | Felicia Or | Done |
| [SCRUM-155](../backlog/SCRUM-155.md) | Reserve an approved equipment request in one step *(added 4 Oct)* | 3 | Jin Hong | Done |
| [SCRUM-156](../backlog/SCRUM-156.md) | Make the one-type equipment form availability-only *(added 4 Oct)* | 2 | Jin Hong | Done |

Points by assignee: Yiam Jun Bin 17, Jin Hong 16, Caylern Goh 11,
Liew Hann Qian 10, Felicia Or 2.

## Changes during the sprint

- **Six stories added (11 points).** Their change logs say why:
  SCRUM-126 was moved in on 1 Oct because SCRUM-108 and SCRUM-117 depend on
  it; SCRUM-129 and SCRUM-130 cover gaps in Sprint 1's Done stories (SCRUM-13
  allowed any timezone, SCRUM-15 had no way to remove a draft), which are not
  reopened; SCRUM-155 and SCRUM-156 are follow-ups to SCRUM-31.
  *To be completed by the team:* why SCRUM-117 was added on 30 Sep, who agreed
  each addition, and what made room for it.
- **Backlog refinement on 1 Oct** rewrote several later stories and re-estimated
  them (see [estimation.md](estimation.md#re-estimates)).
- **The Week 7 customer changes arrived on 2 Oct**, five days before the
  sprint ended. The team kept Sprint 2 as committed and planned the changes
  into Sprint 3 ([SCRUM-158](../backlog/SCRUM-158.md), decided 7 Oct).

## Technical work added during the sprint

| Task | Summary | Created |
|---|---|---|
| [SCRUM-114](../backlog/SCRUM-114.md) | Sprint 1 post-Definition-of-Done test hardening and code hygiene cleanup | 24 Sep |
| [SCRUM-116](../backlog/SCRUM-116.md) | Sync Jira stories into `docs/backlog/` when they change | 30 Sep |
| [SCRUM-125](../backlog/SCRUM-125.md) | Measure coverage on every server-side file and fail CI when it drops | 30 Sep |
| [SCRUM-157](../backlog/SCRUM-157.md) | Refresh the project docs so people and AI tools read one consistent guide | 7 Oct |

## Sprint review

Evidence captured on the day: [`docs/evidence/sprint-2/`](../evidence/sprint-2/README.md)
(the venue conflict refusal, the concurrent-approval CI run, the availability
calendar on desktop and phone).

*To be completed by the team:* who attended, what was demonstrated, and the
Product Owner's acceptance of each story.

## Retrospective

*To be completed by the team.*

| What went well | What to improve | Action (owner, Jira key) | What came of it |
|---|---|---|---|
| | | | |
