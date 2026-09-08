# Contributing to ConnectSphere

This is the **foundation**. Your job in the sprints is to build features on top
of it without fighting each other's code. This document is the contract that
makes that possible. Read it once before your first feature.

The golden rule: **favour boring, obvious code.** You have to explain every
line in the oral exam. No clever abstraction that isn't already earning its
keep.

---

## The one pattern to copy

`app/(app)/organiser/events` is the **reference implementation**. Every feature
is a variation of it. When you build your feature, copy that folder's shape:

| File | Role |
|---|---|
| `page.tsx` | Server component. Guards the role, fetches data scoped to the user via Prisma, renders it. |
| `loading.tsx` | Skeleton shown while the server component fetches. |
| `actions.ts` | Server Actions — the only place data changes. |
| `create-event-dialog.tsx` | Client component; a form that calls an action and shows the result. |
| `lib/schemas/<entity>.ts` | The Zod schema, shared by the form and the action. |
| `components/events/status-badge.tsx` | Shared presentational bits for the entity. |
| `actions.test.ts` | Vitest test of the action: happy path, validation failure, permission denied. |
| `e2e/*.spec.ts` | One Playwright test of the main user journey. |

## How to add a feature (walkthrough)

Say you're building **Venue Booking Approval** in `venue-staff/bookings`.

1. **Branch.** `git checkout -b feat/SCRUM-22-booking-approval`. Work inside
   your own route folder — that's what keeps merges clean (ADR 0001).
2. **Schema first.** Add `approveBookingSchema` to `lib/schemas/booking.ts`.
   The form and the action both import it; validation is written once.
3. **Action.** In `venue-staff/bookings/actions.ts`, copy the shape of
   `createDraftEvent`:
   ```ts
   "use server";
   export async function approveBooking(input: unknown): Promise<ActionResult<...>> {
     const session = await auth();
     try {
       requirePermission(session?.user, "booking:review", /* resource */);
       const parsed = approveBookingSchema.safeParse(input);
       if (!parsed.success) return err("…", parsed.error.flatten().fieldErrors);
       // …do the work…
       revalidatePath("/venue-staff/bookings");
       return ok(result);
     } catch (e) {
       if (e instanceof PermissionError) return err(e.message);
       throw e;
     }
   }
   ```
4. **Permission.** If `"booking:review"` isn't in the `Action` union yet, add it
   to `lib/auth/can.ts` and grant it to `VENUE_STAFF` in the `ROLE_ACTIONS`
   table. **Do not** write a role check anywhere else (see below).
5. **Page.** Replace the placeholder `page.tsx` with a server component that
   guards the role, fetches bookings scoped to what this user may see, and
   renders a table. Keep a real empty state and a `loading.tsx`.
6. **Tests.** Add a Vitest test for the action (happy / invalid / denied) and,
   if the feature has a key journey, a Playwright spec. Trace them back to your
   user story in the test description — the graders check traceability.
7. **Open a PR.** CI must be green. A teammate reviews against this document.

---

## Rules that are code-review rejections

- **No inline permission checks.** `if (session.user.role === "COORDINATOR")`
  in a feature is rejected. All authorisation goes through `can()` /
  `requirePermission()` in `lib/auth/can.ts` (ADR 0004). Add an `Action` and a
  table row instead.
- **No hard-coded colours.** No hex, `rgb()`, or literal colour in a component.
  Every colour is a token in `app/globals.css`, surfaced through the Tailwind
  theme. A rebrand must only touch tokens (brief §11).
- **Actions return `ActionResult`, they don't throw** across the boundary for
  expected failures (validation, permission). Throw only for real bugs.
- **Schemas are shared.** The form and the action import the same Zod schema.
  Don't validate twice with two different rules.
- **No new dependencies** outside the approved stack (brief §2) without a team
  decision and an ADR. No state-management library, no tRPC, no shared
  `<DataTable>` (one table is not yet a pattern), no service/repository layer.
- **No comments that restate the code.** Comment the *why*, not the *what*.

---

## Conventions cheat-sheet

- **Datetimes:** store UTC, display via `formatDate` / `formatDateTime` in
  `lib/datetime.ts` (Asia/Singapore). Never format a date inline.
- **No hard deletes:** state changes are status changes (see the enums).
- **Indexes:** if you add a foreign key you filter on, add an `@@index`.
- **Server-side auth is the real gate.** Hiding a nav link is not access
  control — guard the page and the action too.

## The three environment traps (already handled — don't undo them)

1. **JWT sessions** are required by the Credentials provider (ADR 0002). Don't
   switch to database sessions.
2. **Two database URLs** on Supabase: `DATABASE_URL` (pooled, 6543) for the app
   and `DIRECT_URL` (direct, 5432) for migrations. Both are documented in
   `.env.example`.
3. **`passwordHash`** is our addition to the Auth.js `User`; it's hashed with
   bcrypt in the seed.

## Running things

See `README.md`. In short: `npm run db:reset` to get a clean seeded database,
`npm run dev` to develop, and `npm run typecheck && npm run lint && npm test`
before you push.
