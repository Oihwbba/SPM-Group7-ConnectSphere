# SCRUM-209 — Arrange venues, equipment and the safety check from the event page: test cases

Story and acceptance criteria: [docs/backlog/SCRUM-209.md](../backlog/SCRUM-209.md).
Format and conventions: [README.md](README.md).

**Shared pre-conditions for every case:** the database is migrated and seeded
(`npm run db:deploy && npm run db:seed`), the app is running, and every seeded
account signs in with `Password123!`. Unless a case says otherwise, the event
is in Planning, organised by `organiser@test.local` (Olivia Organiser) and
assigned to `coordinator@test.local` (Cody Coordinator), with no venue, no
equipment request and no safety check yet.

**How the tab is built.** The event page's Arrangements tab opens with the
checklist's summary: how many of the three items are complete ("2/3 items
completed", and "3/3 items completed · Ready to confirm" once all are), with
Reject event (red) and Confirm event (green) at its top right. Below it are
three sections, in the order they are made, side by side on a wide screen:
**Venues**, **Equipment** and **Safety check**. Each section's title has its
checklist item's state beside it, as the readiness checklist reads it
(SCRUM-110), ticked when complete and crossed when not for the Coordinator,
with any reason below; its actions sit, small, at its bottom right. The
buttons are the separate pages' own actions, unchanged (SCRUM-50, 162, 27,
142, 170, 166); people who can't use them see no button.
The Next step banner's "Request a venue", "Settle equipment" and "Request the
safety check" open the tab at that section.

| ID | Type | Criterion | Automated |
|---|---|---|---|
| [TC-209-01](#tc-209-01) | Positive | AC 1 | Unit, e2e |
| [TC-209-02](#tc-209-02) | Positive | AC 1 | e2e |
| [TC-209-03](#tc-209-03) | Positive | AC 2 | Unit, e2e |
| [TC-209-04](#tc-209-04) | Positive | AC 2 | e2e |
| [TC-209-05](#tc-209-05) | Positive | AC 2 | e2e |
| [TC-209-06](#tc-209-06) | Negative | AC 3 | e2e |
| [TC-209-07](#tc-209-07) | Positive | AC 3 | e2e |
| [TC-209-08](#tc-209-08) | Negative | AC 4 | Unit, e2e |
| [TC-209-09](#tc-209-09) | Negative | AC 4 | Unit, e2e |
| [TC-209-10](#tc-209-10) | Positive | AC 1, AC 2, AC 3 | Unit, e2e |
| [TC-209-11](#tc-209-11) | Positive | AC 2 | e2e |

## TC-209-01

**Find a venue opens venue search for this event.**

1. As the Coordinator, open the event's Arrangements tab.
2. The Venues section says "No venues requested yet." and has **Find a venue**.
3. Select it.

**Expected:** venue search opens for this event ("For <event name>", with the
event's period), as SCRUM-38 AC1 does. **Back to event** returns to the
event's Arrangements tab. Find a venue is offered only to the assigned
Coordinator, while the event is Approved or Planning.

*Automated:* `tests/unit/readiness-actions.test.ts` "SCRUM-209 [AC1, AC4] TC-209-01";
`e2e/arrange-from-event-page.spec.ts` "SCRUM-209 [AC1] TC-209-01, TC-209-02, TC-209-10".

## TC-209-02

**Requesting a venue from the search returns to the event.**

1. From TC-209-01, search, pick the Theatre layout and select **Request this
   venue** on Grand Auditorium.
2. On Request a venue, submit the request.

**Expected:** the browser returns to the event's Arrangements tab with
"Venue requested: Grand Auditorium. It is pending Venue Staff approval.", and
the Venues section lists Grand Auditorium as Pending. One Pending booking is
written. Find a replacement venue (on a flagged booking) also returns there.

*Automated:* `e2e/arrange-from-event-page.spec.ts` "SCRUM-209 [AC1] TC-209-01, TC-209-02, TC-209-10".

## TC-209-03

**Request equipment in place, for this event only.**

1. The event has an approved venue. In the Equipment section, select
   **Request equipment**.
2. The form says "For <event name>." and has no event dropdown. Add one
   Projector and submit.

**Expected:** the page stays open; the section shows the request, Pending
Review, with its line. Request equipment is no longer offered. Only the
assigned Coordinator is offered it, while the event is Approved or Planning
(SCRUM-27).

*Automated:* `tests/unit/readiness-actions.test.ts` every "SCRUM-209 [AC2] TC-209-03"
test and "SCRUM-209 [AC2, AC4] TC-209-03"; `tests/unit/equipment-request-queries.test.ts`
"SCRUM-209 [AC2] TC-209-03"; `e2e/arrange-from-event-page.spec.ts` "SCRUM-209 [AC2] TC-209-03, TC-209-04, TC-209-10".

## TC-209-04

**Change lines and Withdraw, with SCRUM-142's rules.**

1. From TC-209-03, Technical Support approves the request.
2. Select **Change lines**, remove the Projector, add 3 Wireless Microphones
   and save.
3. Select **Withdraw**, then **Keep it**.

**Expected:** after the change the request is back to Pending Review, on the
same page, and lists the Wireless Microphone. Withdraw asks "Withdraw this equipment request?" first; keeping it
changes nothing. The request's history (Technical Support's updates) shows
under it for the Coordinator.

*Automated:* `e2e/arrange-from-event-page.spec.ts` "SCRUM-209 [AC2] TC-209-03, TC-209-04, TC-209-10".

## TC-209-05

**No equipment needed, without leaving the page.**

1. The event has an approved venue. In the Equipment section, select **No
   equipment needed**.

**Expected:** "Recorded: no equipment needed."; the section reads No equipment
needed, with "To change this, request equipment: the request replaces it."
SCRUM-170 has no undo; a later equipment request replaces the record.

*Automated:* `e2e/arrange-from-event-page.spec.ts` "SCRUM-209 [AC2, AC3] TC-209-05, TC-209-06, TC-209-07".

## TC-209-06

**Request safety check is not offered before the checklist allows it.**

1. The event has an approved venue, and equipment not yet decided.

**Expected:** the Safety check section reads Not requested and "Request once a
venue is approved and equipment is settled.", with no button (not a greyed-out
one).

*Automated:* `e2e/arrange-from-event-page.spec.ts` "SCRUM-209 [AC2, AC3] TC-209-05, TC-209-06, TC-209-07".

## TC-209-07

**Request safety check appears once allowed, and works.**

1. From TC-209-05, the venue is approved and equipment settled.
2. Select **Request safety check**.

**Expected:** the button was offered (SCRUM-166 AC1); after it, the section
reads Awaiting review and "Waiting for a Safety Officer to review it.", the
button is gone, and one check Awaiting review is written. Changes requested
and Rejected show with the officer's note for the Coordinator.

*Automated:* `e2e/arrange-from-event-page.spec.ts` "SCRUM-209 [AC2, AC3] TC-209-05, TC-209-06, TC-209-07".

## TC-209-08

**Negative — the Organiser sees the sections read-only.**

1. As the Organiser, open the event's Arrangements tab.
2. Open `/bookings/new?event=<id>&venue=ven_auditorium&return=event`.

**Expected:** the three sections show, with no button and no Find a venue
link; the equipment request shows its lines and status, without Technical
Support's notes or history. The request form refuses the Organiser. Nothing
is written.

*Automated:* `tests/unit/readiness-actions.test.ts` "SCRUM-209 [AC4] TC-209-08";
`e2e/arrange-from-event-page.spec.ts` "SCRUM-209 [AC4] TC-209-08, TC-209-09".

## TC-209-09

**Negative — a Coordinator not assigned to the event is refused, and nothing is written.**

1. As `coordinator2@test.local`, open `/events/<id>?tab=arrangements`.
2. Open `/bookings/new?event=<id>&venue=ven_auditorium&return=event`.

**Expected:** the event page is not found (SCRUM-208 AC5); the request form
doesn't take the event, and has no Back to event. No booking, equipment
request, safety check or No equipment needed is written. The actions' own
refusals are unchanged and keep their tests: not the assigned Coordinator
(TC-50-16, TC-27-17, TC-142-11), a second active equipment request (TC-27-09,
TC-142-14, TC-170-10), a venue already requested (TC-38-01), and a safety check
before the checklist allows it (TC-166-02).

*Automated:* `tests/unit/readiness-actions.test.ts` "SCRUM-209 [AC4] TC-209-09";
`e2e/arrange-from-event-page.spec.ts` "SCRUM-209 [AC4] TC-209-08, TC-209-09".

## TC-209-10

**The Next step opens Arrangements at the right section.**

1. As the Coordinator, open an event with no venue; then one with a venue
   approved and equipment not decided; then one with both settled and no check.

**Expected:** the banner's button reads "Request a venue", "Settle equipment"
and "Request the safety check" respectively, and opens the Arrangements tab at
Venues, Equipment and Safety check.

*Automated:* `tests/unit/event-next-step.test.ts` "SCRUM-209 [AC1, AC2, AC3] TC-209-10";
`e2e/arrange-from-event-page.spec.ts` "SCRUM-209 [AC1] TC-209-01, TC-209-02, TC-209-10",
"SCRUM-209 [AC2] TC-209-03, TC-209-04, TC-209-10".

## TC-209-11

**Every live equipment request is shown, each with its own actions (GLM review of #282).**

1. The event has two live requests from before SCRUM-186: one Approved
   (Projector), one Pending Review (Wireless Microphone).
2. As the Coordinator, open Arrangements; on the Wireless Microphone request,
   choose **Withdraw**, then **Withdraw request**.

**Expected:** 1: both requests are shown, each with its lines, status and
history, and its own **Change lines** and **Withdraw** (SCRUM-142 rules). 2: the
withdrawn request becomes Cancelled and leaves the section; the Projector
request stays, still Approved. With no live request, the newest decided one is
shown instead.

*Automated:* `e2e/arrange-from-event-page.spec.ts` "SCRUM-209 [AC2] TC-209-11, SCRUM-186 [AC5]".
