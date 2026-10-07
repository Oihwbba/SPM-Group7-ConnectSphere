<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-07. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-34 - Browse and maintain the venue catalogue

| | |
|---|---|
| **Type** | Story |
| **Epic** | SCRUM-7 - Venue Management |
| **Priority** | Highest |
| **Story points** | 5 |
| **Status in Jira** | To Do |
| **Sprint** | SCRUM Sprint 3 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-34 |

---

**User story:** As Venue Staff, I want to add, edit and retire venues in the catalogue, and as an Event Coordinator I want to view each venue's details, so that planning uses accurate venue information.

**Acceptance criteria**

1. A venue's detail view shows location, capacity, facilities, accessibility features, supported layouts, opening hours, setup and turnaround times, and known restrictions.
2. Any internal user can view venue details; the view always reflects the latest saved record.
3. Venue Staff can add a venue. Name, location, capacity and opening hours are required. Opening hours are an opening and a closing time for each day of the week in SGT, or Closed for that day. Setup and turnaround times start at 0 minutes (valid values in SCRUM-159). Known restrictions, such as limited emergency access, are optional free text and are shown to the Safety Officer (SCRUM-166).
4. Given a capacity of zero or less, or a non-whole number, then the venue is not saved and capacity is reported as invalid.
5. Given a closing time that isn't after the opening time on the same day, then the venue is not saved and that day's hours are reported as invalid.
6. Venue Staff can edit a venue's details; changes show immediately in search, filtering, suitability (SCRUM-38, SCRUM-40) and the request form (SCRUM-127).
7. Given a booking request's occupied period (SCRUM-159) falls outside the venue's opening hours, then it is refused and the hours are shown (SCRUM-50).
8. Venue Staff can retire a venue. A retired venue no longer appears in search, filtering, the request form or new booking requests; bookings that reference it stay readable.
9. Other roles are refused when they try to change the catalogue (SCRUM-67).
10. Given a venue has future Pending, Held or Approved bookings, when Venue Staff change its capacity, facilities, accessibility features, supported layouts or opening hours so that a booking no longer fits, then they are warned and shown the affected bookings before saving; once saved, those bookings are flagged Needs Reconsideration (SCRUM-26) and their Coordinators decide. A longer setup or turnaround time is handled by SCRUM-160.
11. Given a venue has future Pending, Held or Approved bookings, when Venue Staff retire it, then they are warned and shown those bookings first; once retired, those bookings are flagged (SCRUM-26). Nothing is cancelled automatically.

**Customer basis:** "Venue Staff can create/edit/delete venue records." "If venue attributes change after booking… System can flag and it is up to the co-ordinator to decide on follow up action." Venue information includes "operating information" (Venue Catalogue). Week 7 change 1: "Each venue must therefore have a configurable setup time and turnaround time." Week 7 change 6: the safety check considers "any known venue restrictions".

**Change log**

* 2026-10-01: retiring a venue flags future bookings; operating hours added to the attributes that flag bookings; flag notifications owned by SCRUM-124.
* 2026-10-01 (audit): opening hours are now an opening and closing time per weekday in SGT (they are free text in the code and seed data), so search (SCRUM-38) and booking (SCRUM-50) can test against them; refusing a booking outside opening hours moved here from SCRUM-50. Existing venues' hours are re-entered in the new format in the seed data. Built-in equipment removed from the detail view, because equipment catalogue maintenance (SCRUM-119) is beyond Release 1. Group headings removed.
* 2026-10-07 (Week 7 changes 1, 4 and 6): setup time, turnaround time and known restrictions added to the venue (AC1, AC3). AC7 tests opening hours against the occupied period. Held bookings count in AC10 and AC11. A longer setup or turnaround time is handled by SCRUM-160.

Functionality Area: Venue Catalogue
