User Story 84: Organiser views their own event requests

*As an Event Organiser*, I want to see a list of all my own event requests regardless of status, so that I can find drafts to resume and track anything I've already submitted.

*Acceptance Criteria:*

* Organiser sees a list of every event they created, spanning all 9 statuses (draft through completed/cancelled/rejected)
* Each entry shows the event name and its current status
* The list contains only events where the viewing user is the submitting Organiser (enforced by ""View only the events I own""'s ownership rule — this story is the view; that story is the filter it must obey)
* Draft entries are visually distinguished from submitted-or-later ones per ""Distinguish drafts from submitted requests""
* Selecting an entry opens that event's full detail

*Note:* closes a dependency three existing stories already assumed without anyone building it — ""Save an event request as a draft"" (""Organiser can find and resume any of their saved drafts""), ""Distinguish drafts from submitted requests"" (drafts must look distinct ""wherever they appear alongside submitted requests""), and ""View only the events I own"" (""An Organiser's event list contains only events where they are the submitting Organiser""). All three describe rules for this list; this story is the list itself. Added 2026-09-06 following the full backlog synthesis.

*INVEST:* Independent (a read-only view over data all three dependent stories already assume exists); Negotiable (sort order, filtering by status, pagination are all open); Valuable (without it, ""find and resume a draft"" — a core Release-1 workflow — has nowhere to happen); Estimable and Small (one filtered list view); Testable (create events in several statuses as different Organisers; assert each Organiser sees only their own, correctly labelled).

Functionality Area: Draft Event Requests, Event Status Management