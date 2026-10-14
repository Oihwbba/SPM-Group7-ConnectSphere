<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-14. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-163 - Hold a venue tentatively until a deadline

| | |
|---|---|
| **Type** | Story |
| **Epic** | SCRUM-7 - Venue Management |
| **Priority** | Highest |
| **Story points** | 5 |
| **Status in Jira** | In Review |
| **Sprint** | SCRUM Sprint 3 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-163 |

---

**User story:** As Venue Staff, I want to hold a venue for a Coordinator until a deadline, so that it stays free for them while they finalise arrangements without being reserved indefinitely.

**Acceptance criteria**

1. Given I'm reviewing a Pending request (SCRUM-52), when I choose Hold with an expiry date and time and a note of what the Coordinator must finalise, then the booking becomes Held. The expiry must be later than now and earlier than the booking's start; otherwise the hold is refused.
2. A Held booking reserves its occupied period like an Approved one (SCRUM-159): overlapping requests can't be approved or held, venue search excludes the venue for that period (SCRUM-38 AC3), and the venue availability calendar (SCRUM-36) shows it as "Held until \[expiry\]".
3. Given the hold hasn't expired and Venue Staff have approved it (AC7), when the Coordinator confirms it, then the booking becomes Approved. Given the hold hasn't expired, when the Coordinator releases it, then it becomes Cancelled and the period is free again.
4. Given the expiry time is reached without a confirmation, then from that moment the hold no longer reserves the venue, the booking shows Expired and can't be confirmed, and the Coordinator makes a new request if the venue is still needed. This doesn't depend on anyone using the app at the expiry time.
5. The Coordinator is notified when the hold is placed (with the deadline), 24 hours before it expires (or straight away if less than 24 hours remain), and when it expires (SCRUM-124, SCRUM-48).
6. A Held or Expired booking never counts as an Approved booking. The readiness checklist shows "Held until \[expiry\] – confirm to secure" or "Hold expired"; a Held booking keeps the Venue item incomplete, and an Expired one counts like a Rejected one (SCRUM-162).
7. Held bookings stay in the Venue Staff queue (SCRUM-52) with their expiry until they are confirmed, released, rejected or expire. Before the expiry, Venue Staff can approve a Held booking, after which it stays Held and shows "Approved by Venue Staff – awaiting confirmation", or reject it with a reason. Approving, confirming, releasing or rejecting a hold a second time changes nothing.
8. Given the Coordinator confirms at the same moment the hold expires, then the booking ends up either Approved (if the confirmation was saved before the expiry time) or Expired, never both.
9. Cancelling or rejecting the event releases its holds (SCRUM-82, SCRUM-117). Unavailability recorded over a hold flags it (SCRUM-161).

**Supersedes:** SCRUM-36 AC4 and SCRUM-50 AC10 (only an Approved booking blocks a venue), SCRUM-52 AC1 (the queue shows Pending requests only), SCRUM-53 AC1 and AC7 (Approve or Reject only), SCRUM-110 AC2 (no Held or Expired state), and SCRUM-117 AC3 (holds released on rejection).

**Customer basis:** Week 7 change 4: "Venue Staff have explained that they sometimes temporarily hold a venue while an Event Coordinator is finalising event arrangements. These tentative holds should not reserve a venue indefinitely. Each hold must therefore have an expiry date/time. If the required action is not completed before the deadline, the hold should expire and the venue should become available for other requests. The Event Coordinator should be informed before or when the hold expires, and an expired hold should not be treated as a confirmed booking." W9 G4 (Week 7 change 4): "For hold, the co-ordinator will inform the venue staff for approval and then the co-ordinator will confirm the event once the venue staff approved it."

**Why this is a new story:** the Sprint 2 booking stories (Done) know only Pending, Approved, Rejected and Cancelled, and only Approved blocks a venue. "Tentative Venue Holding" was on the Week 4 not-required list; Week 7 makes it required.

**Change log**

* 2026-10-07 (Week 7 change 4): created.
* 2026-10-07 (backlog refinement): AC7 keeps Held bookings in the Venue Staff queue with their expiry; the Supersedes line replaced the Pending-only queue but no criterion said what the queue shows.
* 2026-10-11 (conflict review, SCRUM-38 vs SCRUM-163): AC2 no longer says search shows a held venue. Venue search excludes it for the held period (SCRUM-38 AC3), and only the venue availability calendar (SCRUM-36) shows "Held until \[expiry\]". Basis: Week 7 change 4 makes the venue available to others only once the hold expires, and the calendar is where a venue's requestable periods are shown.
* 2026-10-13 (W9 clarification, Week 7 change 4): the Coordinator confirms a hold only after Venue Staff approve it. AC3 adds that condition; AC7 lets Venue Staff approve a Held booking, which then shows "Approved by Venue Staff – awaiting confirmation". Remaining work re-estimated at 3 points.

Functionality Area: Tentative Venue Holding, Venue Booking Approval
