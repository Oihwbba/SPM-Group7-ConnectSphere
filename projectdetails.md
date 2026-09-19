Customer Briefing: Event Planning and Venue Booking System
1. Organisation
ConnectSphere Event Services is a regional organisation that provides professional event planning and venue services to organisations across Southeast Asia. The company organises a wide variety of events, such as conferences, seminars, workshops, etc.

It operates and owns several event facilities within Singapore. ConnectSphere also maintains equipment and supporting resources commonly required for events. ConnectSphere currently has approximately 500 staff for its operations, taking on the role of Event Coordinators, Venue Staff, and Technical Support Staff.

As the organization expands, the number of events, venues, resources, clients, and participants that must be coordinated has increased significantly. ConnectSphere would therefore like to modernise the way it manages its events.

The proposed system will be used by internal and external users.

2. Background
ConnectSphere currently relies on a mixture of email, spreadsheets, shared calendars, messaging applications, online forms, and manually maintained documents to organise events. Information for a single event may therefore be spread across several places and managed by different employees.

A typical event begins when an external Event Organiser approaches ConnectSphere with an event to host or support. The Event Organiser is responsible for providing the initial requirements and communicating with ConnectSphere about the event, and provides preliminary information such as the purpose and type of event, preferred date and time, expected number of attendees, general programme, room-layout preferences, accessibility requirements, equipment requirements, registration requirements, and any other special arrangements.

An Event Coordinator is then assigned to the request and acts as the main liaison for the Event Organiser, who will review the request and contact the Event Organiser for any clarifications and coordination before confirmation.

For example, the Event Organiser may request a "large room" without specifying the expected attendance or may request a hybrid event without explaining what video-conferencing facilities are required.

Once the basic requirements are sufficiently clear, the Event Coordinator works with Venue Staff to identify a suitable venue. Venue Staff maintain information about ConnectSphere's rooms and spaces and are responsible for deciding whether the requested venue can be made available for the event.

Venue suitability may depend on several factors, such as the proposed date and time, maximum capacity, supported room layouts, accessibility, available facilities, existing bookings, operating hours, setup requirements, and the turnaround time required between consecutive events. A venue may also be unavailable because of maintenance, renovation, safety restrictions, or another internal activity.

Some events also require technical equipment and support. In these cases, Technical Support Staff review the requested equipment and technical support. They maintain records of available equipment, determine whether sufficient equipment can be reserved, and may also be assigned to support an event on-site.

Equipment may already be reserved for another event, located at another venue, damaged, or undergoing maintenance. The planning process may therefore involve several rounds of communication before an event can be confirmed.

Once the essential arrangements have been made, the Event Coordinator can confirm the event with the Event Organiser. For events that require registration, Attendees may subsequently register through the system and receive the event information.

Changes frequently occur after an event has been proposed or even after it has been confirmed. For example:

The Event Organiser may request a different date or time.
Expected attendance may increase or decrease.
Additional equipment or technical support may be requested.
The programme may be extended, shortened, or split into multiple sessions.
A booked venue may become unavailable because of an operational issue.
Reserved equipment may become unavailable because of damage or maintenance.
The Event Organiser may postpone or cancel the event due to unforeseen circumstances.
Registration numbers may reach the event capacity earlier than expected.
Such changes can affect arrangements that have already been made. Increasing attendance from 80 to 150 people may make the selected venue unsuitable. Changing an event date may create a venue or equipment conflict. Extending an event may affect the turnaround time needed before another booking. ConnectSphere therefore expects the proposed system to help users identify and manage these relationships.

The current process creates several difficulties:

Event requests may be incomplete, duplicated, or difficult to track.
Event Coordinators may maintain separate spreadsheets or personal notes, creating different versions of the same event information.
Event Organisers may be unsure whether an event, venue, or equipment arrangement has been approved or confirmed.
Venue Staff may receive incomplete or outdated event requirements.
The same venue or equipment may accidentally be considered available for more than one event.
Insufficient setup or turnaround time may be left between consecutive events.
Last-minute changes may not reach all affected staff or attendees.
Cancelled events may continue to occupy venue or equipment reservations.
Technical Support Staff may receive insufficient notice about upcoming equipment or support requirements.
Attendees may receive outdated dates, times, or venue information after an event changes.
It is difficult to identify which upcoming events still have incomplete arrangements.
It is difficult to determine who changed important event information and when the change occurred.
ConnectSphere would therefore like to develop a custom-built Event Planning and Venue Booking System that provides a single platform for its processes.

3. Target Group of Users
The system will be used by ConnectSphere and external users. The roles below are the roles referred to throughout this customer briefing.

| Role | Internal/External | Main Responsibility |
|---|---|---|
| Event Organiser | External | Client representative who has an event to organise and communicates event requirements to ConnectSphere. |
| Event Coordinator | Internal | Assigned to coordinate the overall planning of an event and act as the main internal point of contact. |
| Venue Staff | Internal | Responsible for venue information, availability, booking decisions, and physical venue preparation. |
| Technical Support Staff | Internal | Responsible for equipment, technical requirements, equipment reservations, and technical support for events. |
| Attendee | External | Participant who registers for and attends an event. |

4. First Release – Core Functionality
The customer briefing describes an entire system that is beyond the scope of a single-term project. From the functionality described in the Week 1 Customer Briefing, the customer has identified the following 20 features as the core requirements for the first release (i.e. your submission in Week 12). In particular:

| Functionality Area | Description |
|---|---|
| User Authorisation and Authentication | Allows users to securely access the system. Access to information and functionality depends on whether the user is an Event Organiser, Event Coordinator, Venue Staff member, Technical Support Staff member, or Attendee. Users should only be able to view or modify information appropriate to their role and relationship to an event. |
| Event Request Creation | Event Organisers can create and submit event requests containing the information needed by ConnectSphere, including the event name, purpose, description, proposed date and time, expected attendance, venue requirements, accessibility needs, equipment requirements, and registration needs where relevant. |
| Draft Event Requests | Event Organisers can save an incomplete event request before submission, return to it later, and continue editing it. Draft requests should remain distinguishable from requests that have already been submitted for review. |
| Venue Suitability Checking | The system should assist users in determining whether a venue appears suitable for an event based on available event and venue information. For example, a venue should not normally be treated as suitable when the expected attendance exceeds its capacity or a required facility is unavailable. |
| Venue Booking Request | An Event Coordinator can submit a request to book a venue for an event. The request should contain the relevant event timing and venue requirements needed by Venue Staff to assess the booking. |
| Venue Booking Approval | Venue Staff can review pending venue booking requests and approve or reject them. Where a booking cannot be accepted, Venue Staff should be able to provide relevant information or a reason so that the Event Coordinator can continue planning. |
| Booking Conflict Detection | The system should identify incompatible or overlapping venue bookings and help prevent inappropriate double-booking. A confirmed booking should affect whether that venue is considered available for other events during the corresponding period. |
| Equipment Request Management | Event Coordinators can record equipment required for an event, including the equipment type, quantity, and relevant technical requirements. Technical Support Staff can review the requested equipment and update the request as arrangements are made. |
| Equipment Availability Checking | Technical Support Staff can determine whether sufficient suitable equipment is available for an event at the required date and time. Equipment already committed to another incompatible event or recorded as unavailable should not be treated as freely available. |
| Equipment Reservation | Available equipment can be reserved for an event. A reservation should reduce the quantity considered available for other overlapping events and should remain associated with the event for which it was reserved. |
| Attendee Registration | Where attendee registration is enabled, Attendees can view appropriate event information, register for an event, view their registration status, and withdraw their registration. Event Organisers and Event Coordinators can view appropriate registration information for the events they manage. |
| Event Change Requests | Event Organisers can request permitted changes after an event has been submitted. Event Coordinators can review and process the request. Changes to important information such as date, time, expected attendance, venue requirements, or equipment requirements may require existing arrangements to be reconsidered. |
| Notification System | Users can receive notifications about significant events relevant to them, such as event submission, clarification requests, approval or rejection, coordinator assignment, venue booking decisions, important event changes, registration updates, confirmation, or cancellation where applicable. |


5. Typical Event Planning Process
Although events may differ, a typical event is expected to follow a process similar to the one below. The exact business rules for particular steps may be clarified during the customer Q&A sessions.

Step 1 - Draft Event Request: An Event Organiser creates a draft request containing the initial event requirements. They may save the request and continue editing it before submission.
Step 2 - Submission: The Event Organiser submits the request to ConnectSphere.
Step 3 - Coordinator Assignment: An Event Coordinator is assigned to the request and becomes the main ConnectSphere employee responsible for coordinating that event.
Step 4 - Review and Clarification: The Event Coordinator reviews the information provided. When information is incomplete or unclear, they request clarification or amendment from the Event Organiser.
Step 5 - Initial Approval: Once sufficient information is available, the Event Coordinator determines whether planning should proceed. Rejected or returned requests should retain an appropriate record of the decision.
Step 6 - Venue Identification: The Event Coordinator searches for venues that could satisfy the date, time, capacity, layout, accessibility, facilities, and setup requirements of the event.
Step 7 - Venue Request: The Event Coordinator submits a venue booking request. Venue Staff review the request and may approve it, reject it, or suggest another venue or arrangement.
Step 8 - Technical Requirements: Where equipment or technical support is required and requested by the Event Organiser, Technical Support Staff review the requirements and determine whether suitable resources can be provided and reserved.
Step 9 - Event Preparation: The Event Coordinator monitors outstanding arrangements. Venue Staff and Technical Support Staff update the relevant preparation information as work progresses.
Step 10 - Event Confirmation: When the essential arrangements have been completed, the Event Coordinator confirms the event. The Event Organiser can then view the confirmed arrangements.
Step 11 - Attendee Registration: Where registration is required, Attendees can register for the confirmed event during the permitted registration period and subject to the applicable capacity.
Step 12 - Changes Before the Event: The Event Organiser may subsequently request changes. The Event Coordinator determines whether those changes affect venue, equipment, technical support, registration, or other arrangements.
Step 13 - Event Delivery: Venue Staff prepare the venue and Technical Support Staff prepare the necessary equipment or support. Relevant users should be able to access the latest confirmed information.
Step 14 - Completion: Once the event has taken place, it can be marked as completed. Relevant attendance information, operational notes, or issues may then be recorded and the event can be closed.

6. Notifications
Users should be kept informed when important events or arrangements relevant to them change. Notifications may be provided within the application or through another suitable communication channel.

Examples of situations that may generate a notification include:

A new event request is submitted.
An Event Coordinator is assigned.
Additional information or amendment is requested.
An event request is approved, rejected, or returned.
A venue booking is requested, approved, rejected, or changed.
Requested equipment is confirmed or found to be unavailable.
An event becomes confirmed.
The Event Organiser requests a significant change.
An event is rescheduled, postponed, or cancelled.
Registration opens or closes.
Registration reaches capacity or a waiting-list status changes.
A registered Attendee withdraws where that affects availability.
An upcoming event still has incomplete arrangements.
A venue or equipment availability change affects an upcoming event.

7. Design
The system should be both desktop- and mobile-friendly. External users may access the system from personal computers or mobile devices, while internal ConnectSphere staff may need access while preparing event spaces or equipment.

Information should be presented clearly and should not assume that users understand ConnectSphere's internal processes. The current status of an event, its confirmed arrangements, and any outstanding actions should be easy for the appropriate user to understand.

8. Other Requirements
a. Performance
Common operations such as viewing an event, searching available venues, opening a venue calendar, checking equipment availability, or submitting a registration should complete within a reasonable time.

b. Security
The system should only allow authorised users to access protected information. Access should depend on the user's role and relationship to an event. For example, an Event Organiser should not normally be able to view events belonging to unrelated clients, and an Attendee should not be able to view internal planning information.

c. Usability
All groups of users should be able to complete their common activities without extensive training or guidance.

d. Reliability and Consistency
The system should maintain consistent information when related event arrangements change. Users should not be presented with contradictory information regarding event dates, venue bookings, equipment availability, or registration status.

e. Scalability
The proposed solution should support ConnectSphere's anticipated growth over the next three years, including increases in events, users, client organisations, venues, equipment, and registrations.

f. Auditability
Important actions should be recorded. Where appropriate, ConnectSphere should be able to determine what was changed, who changed it, and when the change was made.

g. Maintainability
The organisation expects its processes to evolve over time. The proposed system should therefore be designed so that future functionality and business rules can be added without requiring the entire system to be rebuilt.

Notes:
The customer will continue to discuss the proposed system with Event Organisers, Event Coordinators, Venue Staff, Technical Support Staff, and other relevant stakeholders. There may be special cases and business rules that have not been described in this initial briefing.

Students are expected to use the scheduled customer Q&A sessions to clarify such matters and develop appropriate epics and user stories. The customer will subsequently identify the functionality considered most important for the first release.

The teaching team will release the exact project deliverables and grading rubrics in Week 4.

