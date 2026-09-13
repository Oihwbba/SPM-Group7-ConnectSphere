<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-09-13. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-44 - System flags dependent bookings when a major field changes

| | |
|---|---|
| **Epic** | SCRUM-8 - Event Change & Notifications |
| **Priority** | High |
| **Story points** | 5 |
| **Status in Jira** | To Do |
| **Sprint** | Backlog |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-44 |

---

As a Coordinator/Venue Staff/Technical Support Staff member, I want the system to flag dependent bookings, reservations, or registrations when a major event field changes, so that nothing falls out of sync silently.

Acceptance Criteria:

* Given an approved change to date, time, attendance, venue, or equipment, when the change is saved, then any linked venue booking, equipment reservation, or registration record is marked "Needs Reconsideration."
* Given a change to a non-major field (e.g. description), when saved, then no items are flagged.
* Given a flagged item, when a Coordinator/Venue Staff/Technical Support Staff views it, then the "Needs Reconsideration" marker is visible until it is resolved.
* **The system never cancels a flagged arrangement automatically.** The flag is a prompt for a human decision, not an action.
* **Given a flagged item, when the Coordinator records the outcome of the offline review, then the flag is cleared** — either by confirming the arrangement still stands, or by cancelling it. Both outcomes clear the flag; only one of them cancels anything.
* Given a flagged item whose outcome has not yet been recorded, then it stays flagged and visible — a flag is never cleared by time passing or by an unrelated edit.

**Customer clarification (2026-09-13) — closes the long-standing dead end:** _"Changes require arrangements to be reviewed again; staff decide offline and coordinator update the system on the decision whether to cancel."_

This answers Q11 in the customer Q&A log and the gap flagged in the backlog synthesis: **nothing previously cleared a "Needs Reconsideration" flag**, so a flagged booking would have stayed flagged forever. The answer is explicit — no auto-cancel, staff decide offline, and the Coordinator records the decision. The last three criteria above are new and implement exactly that.

**⚠ Re-estimate before continuing.** Sized at 5 points as flag-only. It now also needs a resolve path (confirm or cancel) with the flag-clearing behaviour. Bring it to planning poker — though note the resolve path may be cheaper than it looks, since cancelling a booking and cancelling a reservation are already modelled by SCRUM-32 and SCRUM-82.

Functionality Area: Event Change & Notifications
