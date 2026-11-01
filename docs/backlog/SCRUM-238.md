<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-31. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-238 - Chore: Seed data that lets every role see and try every function

| | |
|---|---|
| **Type** | Task |
| **Epic** | - |
| **Priority** | Medium |
| **Story points** | 0 |
| **Status in Jira** | In Review |
| **Sprint** | SCRUM Sprint 4 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-238 |

---

The seed (`prisma/seed.ts`) was built story by story and leaves several roles with nothing to do. On 28 Oct:

* a Safety Officer has no safety check in any state;
* Venue Staff have one pending booking and no held, expired or flagged one;
* Technical Support has no request in review, none ready to reserve and no shortage to suggest an alternative for;
* the Lead has no overdue request, and no Lead, Safety Officer or staff member has a notification;
* 13 status values, including every safety-check state, have no row, and 22 of the 28 notification types don't either.

Anyone demonstrating or testing the app, including the customer and the graders, has to create this data by hand first.

**Acceptance criteria**

1. After seeding, each role (Organiser, Coordinator, Coordinator Lead, Venue Staff, Technical Support, Safety Officer, Attendee, and the multi-role account) has at least one record to see and one to act on for every page in its menu.
2. Every status of events, bookings, equipment requests, reservations, registrations, clarifications, change requests and safety checks has at least one seeded row, and every notification type is seeded for the user who would receive it.
3. Every row is upserted on a fixed id, so the seed can run again without duplicating or failing, and it respects every database rule (no clashing bookings, one open request or check per event).
4. Every existing seeded account and record that the tests rely on is unchanged, and the unit, integration and e2e suites still pass.
5. `README.md` ("What the seed gives you") and `docs/demo.md` describe the new data.
6. Once merged, the shared database is seeded with it.

**Change log**

* 2026-10-31 (SCRUM-233, PR #329, PO approval pending): two values in AC 2 no longer get a seeded row. The event status Approved has none, because no event rests in Approved: approval saves Planning (SCRUM-81 AC1, SCRUM-135 AC12). The notification type Reservation cancelled has none, because no action writes it. TC-238-01 follows both exceptions. Criteria unchanged.
