<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-15. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-174 - Chore: Record the tech stack decision as ADR 0016

| | |
|---|---|
| **Type** | Task |
| **Epic** | - |
| **Priority** | High |
| **Story points** | - |
| **Status in Jira** | Done |
| **Sprint** | SCRUM Sprint 3 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-174 |

---

No ADR records the stack itself. ADRs 0001 to 0015 cover decisions made on top of it (JWT sessions, the CI database, deploying from GitHub Actions, database constraints), but none says why the system is one Next.js app with Prisma on Supabase, deployed to Vercel. An earlier proposal (Flask, SQLAlchemy, Jinja and htmx, 8 Sep) lives outside the repo and contradicts what was built. Found by the design-pack audit on 2026-10-11 (item A3).

**Acceptance criteria**

1. `docs/adr/0016-…` records the stack as built: one Next.js application (pages and Server Actions), Prisma and PostgreSQL on Supabase, Auth.js, deployed to Vercel from GitHub Actions. It has the four sections `docs/adr/README.md` asks for.
2. It gives the team's reasons, including that Vercel and Supabase are free for this project, and that one deployed app and one database show everyone's merged work in one place.
3. It names the Flask, SQLAlchemy, Jinja and htmx proposal as an alternative and says why it wasn't adopted, and it says the ADR was written after the decision was made.
4. The ADR index (`docs/adr/README.md`) lists 0016.
5. Every claim matches the code on `main`: `package.json`, `vercel.json`, the workflows and the earlier ADRs.

Found by the design-pack audit on 2026-10-11.
