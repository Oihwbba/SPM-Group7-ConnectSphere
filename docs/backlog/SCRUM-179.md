<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-15. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-179 - Chore: Apply pending migrations to the shared database before each production deploy

| | |
|---|---|
| **Type** | Task |
| **Epic** | - |
| **Priority** | Medium |
| **Story points** | - |
| **Status in Jira** | Done |
| **Sprint** | SCRUM Sprint 3 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-179 |

---

Production deploys never touched the database. A migration merged to `main` reached the shared Supabase database only when someone remembered to run `npm run db:deploy` by hand; after #148 nobody did, and production failed until it was run. This extends the deploy workflow SCRUM-89 (Done) built. It was first raised under SCRUM-89, and moved to its own task because that story is Done (PO decision, 12 Oct).

**Acceptance criteria**

1. Every production deploy applies pending migrations to the production database with `prisma migrate deploy`, after `vercel pull` and before the build. It never resets or rewrites the database.
2. The database URLs come from the production environment file `vercel pull` writes. The file is parsed rather than run by the shell, so a `$` in a password stays as it is, and only `DATABASE_URL` and `DIRECT_URL` are passed to Prisma.
3. If either URL is missing, or a migration fails, the deploy stops before the build with an error that names the problem, and production keeps the previous version. A URL is never printed: a malformed value is refused by its name.
4. The README and ADR 0009 say migrations now apply themselves on deploy, that migrations must be additive while the previous version is still serving, and how to recover from one that fails part way.
