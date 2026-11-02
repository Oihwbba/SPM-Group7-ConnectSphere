<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-11-02. Jira is the source of truth.
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

**Second cause (found 2 Nov, after the first fix was deployed):** Vercel pauses an instance between requests, and that also pauses pg's timer that closes idle connections. Paused instances, including ones left from an earlier deploy, keep their connections open, so the errors came back in bursts after each deploy.

**Acceptance criteria**

1. The database pool in `lib/db.ts` has a small maximum number of connections, so the running copies of the app stay under Supabase's session pooler limit.
2. A test checks that the pool is created with that maximum.
3. After the fix is deployed, My Events, Bookings and sign-in load without "This page couldn't load", and the Vercel logs show no new `EMAXCONNSESSION` errors.
4. An idle database connection is closed within seconds even on Vercel, where instances are paused between requests, so instances from an earlier deploy don't keep holding the pooler's connections. A test checks it.
5. Supabase's session pooler accepts 43 connections (its Pool Size setting, raised from 15), and the docs give that limit.

**Change log**

* 2026-10-29: created in Sprint 4 at the PO's request, from the production issue found while testing SCRUM-198.
* 2026-11-02: reopened, because AC 3 failed. On 2 Nov, after the fix was deployed, Supabase logged more than 100 `EMAXCONNSESSION` errors, in bursts after each deploy. Added the second cause and AC 4 and 5. The pool size was raised from 15 to 43 in the Supabase dashboard that day.
