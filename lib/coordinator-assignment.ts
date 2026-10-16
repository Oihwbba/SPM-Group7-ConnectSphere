import type { Prisma, PrismaClient } from "@prisma/client";

/**
 * SCRUM-165 AC4 — each Coordinator's load, so the Lead can see how busy each
 * one is and is offered the least-loaded. SCRUM-20 used this rule to assign
 * automatically; Week 7 change 5 moved the choice to the Lead, so it now only
 * informs that choice.
 *
 * "Active" means the Coordinator is still doing something about the event:
 * UNDER_REVIEW, APPROVED, PLANNING or CONFIRMED. COMPLETED, CANCELLED and
 * REJECTED events no longer count as load.
 */
export const ACTIVE_EVENT_STATUSES = [
  "UNDER_REVIEW",
  "APPROVED",
  "PLANNING",
  "CONFIRMED",
] as const;

export type CoordinatorLoad = {
  id: string;
  name: string;
  activeEvents: number;
};

/** Every user who currently holds the Coordinator role, with their load. */
export async function getCoordinatorLoads(
  db: Prisma.TransactionClient | PrismaClient,
): Promise<CoordinatorLoad[]> {
  const coordinators = await db.user.findMany({
    where: { role: "COORDINATOR" },
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
