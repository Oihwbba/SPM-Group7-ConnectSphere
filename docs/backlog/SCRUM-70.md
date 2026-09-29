<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-09-30. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-70 - Organisers and coordinators see an event's registrations; attendees' records stay private

| | |
|---|---|
| **Type** | Story |
| **Epic** | SCRUM-9 - Access Control |
| **Priority** | Medium |
| **Story points** | 3 |
| **Status in Jira** | To Do |
| **Sprint** | Backlog |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-70 |

---

Merged story (29 Sep 2026): absorbs SCRUM-78 (View registrations for an event I manage). Any reference to SCRUM-78 elsewhere now means this story.

As an Attendee, I want my own registration records protected from other Attendees, so that nobody else can reach what is mine.

Acceptance Criteria:

* Another Attendee's registration, requested directly by its identifier, is refused
* The refusal is indistinguishable from the registration not existing
* An Attendee cannot see the full attendee list of an event

Note: this is the Attendee half of the visibility rule and pairs with the Attendee Registration epic (SCRUM-11). Build it in the same sprint as those stories.

Update 2026-09-06: the two event-browsing criteria previously here duplicated "View an event I could attend" (SCRUM-72) - removed, so that story is the sole source of truth for event-browsing visibility.

Update 2026-09-07: the criterion "An Attendee sees only their own registration records" was also removed - it duplicated "View my registration status" (SCRUM-76), whose own acceptance criteria already require the list to contain only that Attendee's registrations. SCRUM-76 now owns list filtering; this story owns the direct-access boundary. Found in the 2026-09-07 audit, which caught that the earlier de-duplication had checked this story against SCRUM-72 but not against SCRUM-76.

INVEST: Independent (needs sign-in and registration to exist); Negotiable (whether an Attendee can ever see another's registration, e.g. as a plus-one, needs customer confirmation); Valuable (Attendees are external users with the least business relationship to ConnectSphere - the tightest boundary in the system); Estimable and Small (one ownership check on direct access); Testable (as Attendee A, request Attendee B's registration by identifier, assert refusal).

Functionality Area: User Authorisation and Authentication

---

Merged from SCRUM-78 — View registrations for an event I manage

As an Event Coordinator or Event Organiser, I want to see registrations for an event I manage, so that I can plan capacity, seating and catering against real numbers.

Acceptance Criteria:

* A Coordinator sees the registration list only for events assigned to them.
* An Event Organiser sees the registration list only for events they submitted.
* The list shows registered count, remaining capacity, and each registration's status.
* Withdrawn registrations are distinguishable from active ones and are not counted in the registered total.
* Release 1 shows the Attendee's name and registration status to the event's Organiser and assigned Coordinator because they are the authorised event managers responsible for planning the event.
* No other role can retrieve an event's registration list.
* Registration-record access follows the central authorization model in SCRUM-66/67.

Functionality Area: Attendee Registration
