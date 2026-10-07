<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-07. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-119 - Maintain the equipment catalogue and record unavailability

| | |
|---|---|
| **Type** | Story |
| **Epic** | SCRUM-10 - Equipment Management |
| **Priority** | Highest |
| **Story points** | 5 |
| **Status in Jira** | To Do |
| **Sprint** | Backlog |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-119 |

---

**Beyond Release 1** (label `beyond-release-1`): Equipment Catalogue and Equipment Maintenance Status are on the Week 4 list of features not required for Release 1, and the team's 13 Sep customer Q&A register treats equipment and its status as seed data ("Maintenance workflow is not core at the moment"). In Release 1 the catalogue, stock and unavailability periods come from the seed data, and the availability checks (SCRUM-29, SCRUM-30) already count seeded unavailability.

**User story:** As Technical Support Staff, I want to create, edit and retire equipment catalogue items and record when stock is damaged or under maintenance, so that Coordinators request from an accurate list and availability checks use real, usable stock.

**Acceptance criteria**

1. Each item has a type, description, total quantity (a positive whole number), home location (a venue from the venue catalogue, or "Central store") and technical specs.
2. Coordinators choose equipment types from this catalogue in equipment requests (SCRUM-27), and Organisers choose from it in the request form (SCRUM-127). Only active items are offered.
3. Items located at a venue are added to that venue's detail view (SCRUM-34) as built-in equipment.
4. Retiring an item removes it from new requests; existing requests and reservations that use it stay readable.
5. I can record a quantity of an item as unavailable (Damaged or Under maintenance) for a period with a reason. For example, 2 projectors Damaged from Monday 09:00 to Wednesday 18:00 makes availability checks overlapping that period show 2 fewer (SCRUM-29, SCRUM-30).
6. The reason is required; the end must be after the start; the quantity is a positive whole number no greater than total stock. Periods follow the usual convention: start included, end excluded.
7. I can end an unavailability period early.
8. Given reducing total quantity, retiring an item or recording unavailability would leave less stock than existing reservations need for an overlapping period, then I am warned and shown the affected reservations before saving; once saved, those reservations are flagged Needs Reconsideration (SCRUM-26). Nothing is cancelled automatically.
9. Only Technical Support Staff can create, edit or retire items or record unavailability; other internal roles can view them (SCRUM-67).

**Customer basis:** "Technical Support Staff maintain equipment status. Maintenance workflow is not core at the moment." "Equipment may already be reserved for another event, located at another venue, damaged, or undergoing maintenance."

**Change log**

* 2026-10-01: retiring an item now also flags affected Approved items; unavailability periods use explicit instants and the shared period convention; added the pre-save warning; flag notifications are owned by SCRUM-124.
* 2026-10-01 (audit): beyond Release 1 (label `beyond-release-1`), following the Week 4 not-required list and the team's 13 Sep decision. "Approved items" now reads "reservations", matching the built equipment model (SCRUM-31). The Organiser's catalogue choice is SCRUM-127. Group headings removed.

Functionality Area: Equipment Availability Checking
