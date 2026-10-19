import type { Prisma, PrismaClient } from "@prisma/client";

/**
 * SCRUM-165 AC4 — each Coordinator's load, so the Lead can see how busy each
 * one is and is offered the least-loaded. SCRUM-20 used this rule to assign
 * automatically; Week 7 change 5 moved the choice to the Lead, so it now only
 * informs that choice.
 *
 * "Active" means Under Review, Planning or Confirmed (SCRUM-141 AC5), the
 * same count the Lead sees on the all-events list. Approving moves an event
 * straight to Planning (SCRUM-81), so Approved never lasts; Completed,
 * Cancelled and Rejected events no longer count as load.
 */
export const ACTIVE_EVENT_STATUSES = [
  "UNDER_REVIEW",
  "PLANNING",
  "CONFIRMED",
] as const;

export type CoordinatorLoad = {
  id: string;
  name: string;
  activeEvents: number;
};

/**
 * Every user who currently holds the Coordinator role, with their load,
 * including those who hold it besides another role (SCRUM-121 AC2).
 */
export async function getCoordinatorLoads(
  db: Prisma.TransactionClient | PrismaClient,
): Promise<CoordinatorLoad[]> {
  const coordinators = await db.user.findMany({
    where: { OR: [{ role: "COORDINATOR" }, { additionalRoles: { has: "COORDINATOR" } }] },
    select: {
      id: true,
      name: true,
      _count: {
        select: {
          coordinatedEvents: {
            where: { status: { in: [...ACTIVE_EVENT_STATUSES] } },
          },
        },
      },
    },
    // Stable tie-break: the earliest-created Coordinator is suggested on a
    // tie, so the suggestion doesn't depend on row order from Postgres.
    orderBy: { createdAt: "asc" },
  });

  return coordinators.map(({ id, name, _count }) => ({
    id,
    name,
    activeEvents: _count.coordinatedEvents,
  }));
}

/** The least-loaded Coordinator's id, the first on a tie; null if none. */
export function suggestCoordinator(loads: CoordinatorLoad[]): string | null {
  if (loads.length === 0) return null;
  return loads.reduce((least, current) =>
    current.activeEvents < least.activeEvents ? current : least,
  ).id;
}
