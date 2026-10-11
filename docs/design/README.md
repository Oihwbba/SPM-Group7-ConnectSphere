# Design diagrams

Pictures of ConnectSphere: the C4 model, the delivery pipeline, the data model,
the Server Actions, the state machines, the sequences and the business
processes. The Server Actions are also listed as a table in
[`api.md`](api.md).

The diagrams are images exported from the design pack made on 2026-10-11. Its
source files (Structurizr DSL, BPMN and Mermaid) aren't in the repo. To fix a
label, edit its text in the SVG. To change a diagram's shape, export it again.

**Last checked against the code:** 2026-10-11, `main` at commit `885c837`, the
open pull requests named below, and the Jira stories each diagram cites
(SCRUM-175).

## Status

Each diagram shows one of these:

| Status | Meaning |
|---|---|
| **Built** | Everything shown is on `main`. |
| **In review** | The design in an open pull request. |
| **Target** | Release 1 after the Week 7 changes. Not built yet. |
| **Mixed** | Part built. The notes say which parts aren't. |

A diagram marked Built must change when the code it shows changes.

## C4 model and delivery

| ID | Diagram | Status | Notes |
|---|---|---|---|
| C4-1 | [System context](diagrams/c4-1-context.svg) | Target | Seven roles, including the Week 7 Lead and Safety Officer. Organiser accounts come from the seed in Release 1. |
| C4-2 | [Containers](diagrams/c4-2-containers.svg) | Built | The containers are as built. Each person's description lists their Release 1 duties, not only what is built today. |
| C4-3 | [Components of the web application](diagrams/c4-3-components.svg) | Mixed | Solid boxes are on `main`, orange dashed ones are in open pull requests, and grey dashed ones are planned Sprint 3 stories. "Venue catalogue and search" is marked planned, but a read-only catalogue page is already on `main` (`app/(app)/venues/page.tsx`). Maintaining and searching venues is SCRUM-34, 38 and 40. |
| C4-4 | [Deployment](diagrams/c4-4-deployment.svg) | Built | Except the migrate step, which is #158 (SCRUM-89), not merged. |
| DV-1 | [Delivery pipeline](diagrams/delivery-pipeline.svg) | Built | Except the migrate step, which is #158 (SCRUM-89), not merged. |

## Data model and code structure

| ID | Diagram | Status | Notes |
|---|---|---|---|
| DM-1 | [Domain data model: keys, statuses and relationships](diagrams/erd-1-keys.svg) | Built | 19 tables. It leaves out the Auth.js tables `Account`, `Session` and `VerificationToken`. |
| DM-2 | [Full schema](diagrams/erd-2-full.svg) | Built | All 22 tables and every column. |
| DM-3 | [Server Action modules and the tables they write](diagrams/class-1-actions.svg) | Built | Three things it doesn't show: the equipment-request actions also write `Notification`; `getClarificationForEvent` also accepts `clarification:respond`; and `recordUnavailability` locks the `Venue` row with `FOR NO KEY UPDATE`. [`api.md`](api.md) has the full detail. |

## State machines

| ID | Diagram | Status | Notes |
|---|---|---|---|
| ST-1 | [Event status, Release 1 target](diagrams/state-01-event-target.svg) | Target | SCRUM-135, with the Lead's queue (SCRUM-165) and the safety check (SCRUM-166). |
| ST-2 | [Event status as built](diagrams/state-02-event-current.svg) | Built | Each transition is labelled with the Server Action that makes it. |
| ST-3 | [Venue booking](diagrams/state-03-booking.svg) | Target | Holds are SCRUM-163 (#154) and flags are SCRUM-26. |
| ST-4 | [Equipment request and reservation](diagrams/state-04-equipment.svg) | Mixed | Changing lines and withdrawing a request is SCRUM-142 (#156). Flags are SCRUM-26. |
| ST-5 | [Safety check](diagrams/state-05-safety-check.svg) | Target | SCRUM-166. |
| ST-6 | [Registration, change request, clarification, flag and notification](diagrams/state-06-small-lifecycles.svg) | Mixed | Registration and clarification are built. Change requests are SCRUM-41 (#162) and SCRUM-128, flags are SCRUM-26, and show-from notifications are #153 and #154. |

## Sequences

| ID | Diagram | Status | Notes |
|---|---|---|---|
| SQ-1 | [Sign in, then authorise every Server Action](diagrams/seq-01-signin-authorised-action.svg) | Built | |
| SQ-2 | [Submit, then the Lead assigns](diagrams/seq-02-submit-and-assign.svg) | Target | SCRUM-165. Today a Coordinator is assigned automatically (ST-2). |
| SQ-3 | [Two approvals of overlapping requests](diagrams/seq-03-booking-conflict.svg) | Built | The setup and turnaround minutes in the clash example are SCRUM-159, not built yet. |
| SQ-4 | [A hold expires with no scheduler](diagrams/seq-04-hold-expiry.svg) | In review | SCRUM-163, #154. |
| SQ-5 | [Reserve equipment, all or nothing](diagrams/seq-05-reserve-equipment.svg) | Built | |
| SQ-6 | [Safety check, then confirm](diagrams/seq-06-safety-check-confirm.svg) | Mixed | Confirm and the checklist are built. The safety check is SCRUM-166. |
| SQ-7 | [An impactful change to a Confirmed event](diagrams/seq-07-change-request.svg) | Target | Raising the request is SCRUM-41 (#162). Deciding it is SCRUM-128. |
| SQ-8 | [Two Attendees race for the last place](diagrams/seq-08-last-place.svg) | Built | |
| SQ-9 | [A venue becomes unavailable over bookings](diagrams/seq-09-unavailability-replacement.svg) | Target | SCRUM-161, 26, 38 and 162. |
| SQ-10 | [Cancel an event, or complete it when read](diagrams/seq-10-cancel-complete.svg) | Target | **Open question for the PO:** step 11 notifies the Organiser and Coordinator when an event completes, as SCRUM-45 AC7 asks. SCRUM-82 no longer sends a completion notice (#163 re-syncs it), so one of the two stories has to change. |

## Business processes (BPMN)

| ID | Diagram | Status | Notes |
|---|---|---|---|
| BP-0 | [End to end](diagrams/p0_end_to_end.svg) | Target | Links to BP-1 to BP-7. Completion has the same open question as SQ-10. |
| BP-1 | [Assignment and reassignment](diagrams/p1_assignment.svg) | Target | SCRUM-165 and SCRUM-21. |
| BP-2 | [Review and decision](diagrams/p2_review.svg) | Mixed | Review, clarification and rejection are built. Sending a resubmission to the Lead's queue when its Coordinator lost the role (SCRUM-165) isn't, and neither are the Organiser's notices (SCRUM-45, #155). |
| BP-3 | [Venue booking](diagrams/p3_venue.svg) | Mixed | Requests and decisions are built. Search (SCRUM-38), suitability (SCRUM-40), several venues per event (SCRUM-162) and holds (#154) aren't. |
| BP-3b | [Tentative hold](diagrams/p3b_hold.svg) | In review | SCRUM-163, #154. |
| BP-4 | [Equipment](diagrams/p4_equipment.svg) | Mixed | Requests, review and reservation are built. No equipment needed (SCRUM-170), notifying Technical Support (SCRUM-124) and changing lines (SCRUM-142, #156) aren't. |
| BP-5 | [Safety check](diagrams/p5_safety.svg) | Target | SCRUM-166. |
| BP-6 | [Change and disruption](diagrams/p6_change.svg) | Target | SCRUM-41, 128, 26, 161 and 85. |
| BP-7 | [Registration](diagrams/p7_registration.svg) | Mixed | Registering, withdrawing and the registration window check are built; today the window comes only from the seed data. Setting the window (SCRUM-75), Registration needed (SCRUM-171) and the Attendee notices (SCRUM-85) aren't built. |

## Corrected from the design pack

Four labels were changed to match the code:

- **DV-1** no longer names the Product Owner. Nothing in the repo does.
- **C4-3** and **DM-3** said every Server Action calls `requirePermission()` first and then a Zod schema. Three read actions check `can()` directly and take only an event id, so the labels now say so.
- **SQ-6** now quotes the message `confirmEvent` actually returns: "This event isn't ready to confirm yet. Outstanding: …".

## How the diagrams were checked

- **DM-1 and DM-2** were compared with `prisma/schema.prisma` by script: every table, column and type.
- **DM-3** and [`api.md`](api.md): every Server Action was read from `app/`, with its permission, input schema, the tables it writes and the rows it locks.
- **Built and In-review diagrams:** every file, constraint, trigger, enum value, notification type and quoted message they name exists on `main`, or in the pull request named.
- **Story keys:** all 56 story keys the diagrams cite exist in the backlog.
- **Target diagrams:** the state machines and sequences were compared with the current criteria of the stories they cite. About 35 of the criterion numbers the business processes cite were checked against the same stories.
- **Safety:** the SVG files contain no scripts and no links to outside resources.
