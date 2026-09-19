1) User Story 13: Create an Event Request
As an Event Organiser, I want to enter my event's details into a request form, so that ConnectSphere has everything it needs to start planning my event.

Acceptance Criteria:

Form captures event name, purpose, description, proposed date and time, and expected attendance.

Form captures venue requirements, accessibility needs, equipment requirements, room layout, and registration needs 

Accessibility needs refer to wheelchair access, special physical seating, or mobility/facility arrangements.

Venue and equipment requirements depend on ConnectSphere’s venues/equipment catalogue.

Form also captures the event programme and special requests.

Mandatory fields include event name, description, purpose, proposed dates/times, expected attendance, venue requirements, accessibility needs, equipment requirements, room layout, and registration needs, following W4-33. These fields must be filled before the request can be submitted (see "Submit an event request for review").

The team can decide which additional fields, including programme and special requests, are mandatory or optional based on the application design and efficient operation (W4-33 and W4-48).

Given an expected attendance of zero or a negative number, when the Organiser saves, then the request is not saved and the field is reported as invalid — attendance must be a positive whole number.

Given a proposed end date and time earlier than or the same as the start, when the Organiser saves, then the request is not saved and the period is reported as invalid.

Given a proposed date in the past, when the Organiser saves, then the request is not saved and the date is reported as invalid.

Organiser can review entered details before submitting.

Note: this story alone has no durable value on its own — a filled-in form is only worth something once it can be submitted or saved. Plan and ship it in the same sprint as "Submit an event request for review" and/or "Save an event request as a draft", not in isolation.

Note (2026-09-07): the three validity criteria were added following the Week 2 assignment feedback, which asked for the valid range of entered values to be stated — specifically whether zero or negative values are allowed, and what happens when a period's end precedes its start.

Note — mandatory/optional fields: W4-33 explicitly describes the listed fields as compulsory, while W4-48 states that there is no definitive mandatory/optional list. The acceptance criteria above follow W4-33’s compulsory-field wording; the team should reconcile this with W4-48 when finalising the field requirements. Programme and special requests are included without assuming that they are mandatory or optional.

INVEST: Independent (can be built without the review/approval flow existing yet); Negotiable (which additional fields are mandatory or optional is open to team discussion, with the baseline list reviewed against W4-33 and W4-48; whether a past date should be blocked outright or warned is worth confirming); Valuable (a necessary precondition for both submitting and saving a draft); Estimable and Small (one form, one entity); Testable (each AC is a checkable condition, including the three invalid-input cases).

Functionality Area: Event Request Creation