<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-09-13. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-35 - Maintain Venue Records

| | |
|---|---|
| **Epic** | SCRUM-7 - Venue Management |
| **Priority** | High |
| **Story points** | 2 |
| **Status in Jira** | To Do |
| **Sprint** | Backlog |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-35 |

---

**User Story**
As Venue Staff, I want to create, edit and remove venue records, so that the catalogue stays accurate and current.

**Acceptance Criteria**

* Venue Staff can add a new venue with all required fields.
* Venue Staff can edit an existing venue's details.
* **Venue Staff can remove a venue from the catalogue.** A removed venue no longer appears in search, filtering or booking, but any venue referenced by an existing booking is withdrawn rather than erased, so historic bookings stay readable.
* Given a venue with a future approved booking, when Venue Staff try to remove it, then they are warned and the affected bookings are surfaced before the removal is confirmed.
* Changes are reflected immediately in search, filtering, and suitability checks.
* Mandatory fields (location, capacity) cannot be left blank.
* Given a capacity of zero or a negative number, when Venue Staff save, then the venue is not saved and the capacity is reported as invalid — capacity must be a positive whole number.
* Given a venue's capacity is reduced below the expected attendance of an event already booked into it, when Venue Staff save, then the change is accepted but the affected booking is surfaced to staff rather than being silently left inconsistent.

**Customer clarification (2026-09-13):** _"Venue Staff can create/edit/delete venue records."_ Delete was not previously in the story — it only covered create and edit. The two removal criteria above are new.

The wording _delete_ is taken to mean removal from the working catalogue, not destruction of history: erasing a venue that past events were held in would break those events' records and the auditability requirement. If the customer means a hard delete, raise it — it changes the data model.

**Note (2026-09-07):** the capacity-validity rule was added following the Week 2 assignment feedback, which asked explicitly whether zero or negative values are allowed wherever a capacity is set. The reduced-capacity criterion was added because capacity feeds the suitability check (SCRUM-40) and the booking flow — editing it after a booking exists is a real path that had no stated behaviour.
