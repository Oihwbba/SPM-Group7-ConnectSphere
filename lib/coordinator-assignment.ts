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
 * Must be called inside the same transaction that writes the assignment, so
 * two events submitted at the same instant don't both compute the load
 * before either write lands and pick the same "least loaded" Coordinator.
 */
export async function pickCoordinator(
  tx: Prisma.TransactionClient | PrismaClient,
): Promise<string | null> {
  const coordinators = await tx.user.findMany({
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