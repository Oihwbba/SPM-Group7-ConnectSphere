import type { Prisma, PrismaClient } from "@prisma/client";

/**
 * SCRUM-20 — auto-assign a coordinator to a submitted event.
 *
 * Fairness rule (least-loaded): assign the Coordinator who currently has the
 * fewest events in an active (non-terminal) state. This is the ONE place the
 * rule is defined, per the acceptance criterion "stated in one place" — do
 * not duplicate this logic anywhere else.
 *
 * "Active" here means the Coordinator is still doing something about the
 * event: UNDER_REVIEW, APPROVED, PLANNING or CONFIRMED. COMPLETED, CANCELLED
 * and REJECTED events no longer count as load.
 *
 * Returns the chosen Coordinator's id, or null if there are no Coordinators
 * at all (SCRUM-20 AC: the event must still reach "submitted" and stay
 * visible rather than failing silently — the caller is responsible for that
 * part, this function only picks who to assign).
 *
 * Must be called inside the same transaction that writes the assignment, and
 * that transaction must not commit before the write. Under READ COMMITTED a
 * transaction alone does not stop two submissions reading the same loads, so
 * this takes a transaction-scoped advisory lock first: the second submission
 * waits here until the first commits, then reads loads that include the
 * first's assignment.
 */
export async function pickCoordinator(
  tx: Prisma.TransactionClient | PrismaClient,
): Promise<string | null> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('connectsphere:assign-coordinator'))`;

  const coordinators = await tx.user.findMany({
    // Primary Coordinators only (SCRUM-121): someone who is also an Organiser
    // must never be handed their own event, and AC4 leaves checking that to
    // the Lead's assignment (SCRUM-165).
    where: { role: "COORDINATOR" },
    select: {
      id: true,
      _count: {
        select: {
          coordinatedEvents: {
            where: {
              status: { in: ["UNDER_REVIEW", "APPROVED", "PLANNING", "CONFIRMED"] },
            },
          },
        },
      },
    },
    // Stable tie-break: earliest-created coordinator wins ties, so the rule
    // is deterministic rather than depending on row order from Postgres.
    orderBy: { createdAt: "asc" },
  });

  if (coordinators.length === 0) return null;

  const leastLoaded = coordinators.reduce(
    (least: (typeof coordinators)[number], current: (typeof coordinators)[number]) =>
      current._count.coordinatedEvents < least._count.coordinatedEvents
        ? current
        : least,
  );

  return leastLoaded.id;
}