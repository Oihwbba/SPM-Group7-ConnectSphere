<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-29. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-240 - Bug: The live app hits Supabase's connection limit because the database pool has no maximum

| | |
|---|---|
| **Type** | Task |
| **Epic** | - |
| **Priority** | High |
| **Story points** | - |
| **Status in Jira** | In Progress |
| **Sprint** | SCRUM Sprint 4 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-240 |

---

The live app sometimes shows "This page couldn't load" (on My Events and Bookings), and sign-ins sometimes fail. The Vercel logs show `EMAXCONNSESSION: max clients reached` (references 2965551917 and 2084076958).

**Cause:** Supabase's session pooler allows 15 connections. `lib/db.ts` creates its Pool with no `max`, so each running copy of the app can open up to 10 connections (the pg default), and a few copies together go over 15.

**Acceptance criteria**

1. The database pool in `lib/db.ts` has a small maximum number of connections, so the running copies of the app stay under Supabase's limit of 15.
2. A test checks that the pool is created with that maximum.
3. After the fix is deployed, My Events, Bookings and sign-in load without "This page couldn't load", and the Vercel logs show no new `EMAXCONNSESSION` errors.

**Change log**

* 2026-10-29: created in Sprint 4 at the PO's request, from the production issue found while testing SCRUM-198.
