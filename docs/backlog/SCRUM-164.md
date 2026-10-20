<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-20. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-164 - Add the Event Coordinator Lead and Safety Officer roles

| | |
|---|---|
| **Type** | Story |
| **Epic** | SCRUM-9 - Access Control |
| **Priority** | Highest |
| **Story points** | 3 |
| **Status in Jira** | Done |
| **Sprint** | SCRUM Sprint 3 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-164 |

---

**User story:** As an Event Coordinator Lead or Safety Officer, I want to sign in with my own role, so that I see and can do only what my role allows.

**Acceptance criteria**

1. Given a Lead or Safety Officer account, when it signs in (SCRUM-65), then it lands on its role's home page and the menu shows only what that role allows, from the one permission table (SCRUM-66).
2. The Lead can do what SCRUM-165, SCRUM-21 and SCRUM-141 describe, and the Safety Officer what SCRUM-166 describes: recording a safety check's outcome (Approved, Changes requested or Rejected). Neither can approve or reject an event request, or confirm, plan or edit an event; a Safety Officer's approval doesn't confirm the event (SCRUM-166 AC14).
3. Every action checks the new roles on the server. Given a Lead or Safety Officer calls an action outside their role, including directly, then it is refused and nothing changes (SCRUM-67).
4. Seed data adds at least one Lead and one Safety Officer account, listed in the README with the other test accounts.
5. The product overview (docs/product-context.md) lists all seven roles.

**Supersedes:** the five-role wording in SCRUM-65, SCRUM-66 and SCRUM-67.

**Customer basis:** Week 7 change 5: "ConnectSphere has introduced a new internal role, the Event Coordinator Lead, who is responsible for overseeing incoming event requests and assigning them to individual Event Coordinators." Week 7 change 6: "ConnectSphere has introduced a new internal role, the Safety Officer, who is responsible for reviewing the operational safety of planned events." "The Safety Officer may approve the event, reject the safety arrangement, or request changes."

**Why this is a new story:** SCRUM-65, SCRUM-66 and SCRUM-67 (Sprint 1, Done) cover five roles.

**Change log**

* 2026-10-07 (Week 7 changes 5 and 6): created.
* 2026-10-09: AC2 no longer says neither role can "approve, reject" an event, which read against Week 7 change 6 ("The Safety Officer may approve the event, reject the safety arrangement, or request changes"). The Safety Officer records the safety check's outcome; neither role approves or rejects the event request, or confirms, plans or edits the event. The customer basis quotes change 6's sentence.

Functionality Area: User Authorisation and Authentication
