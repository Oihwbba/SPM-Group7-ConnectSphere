import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { can } from "@/lib/auth/can";
import { formatDateTime } from "@/lib/datetime";

/**
 * Load one event by id, but only if the signed-in user is allowed to see it
 * (SCRUM-68).
 *
 * Returns `null` BOTH when the event does not exist and when it exists but
 * belongs to someone else — the two are indistinguishable to the caller. That
 * is deliberate: ConnectSphere's clients are competing organisations, so
 * "you may not view this" would itself confirm the event exists. Requesting
 * another organiser's event by its id must look exactly like requesting one
 * that was never there.
 *
 * Drafts fall out of the same gate for free: a draft has no coordinator, so
 * `can()`'s relationship check passes only for the organiser who created it.
 *
 * This is the shared read path for a single event. Feature developers building
 * an event detail page (SCRUM-6) should call this instead of querying Prisma
 * directly, then `notFound()` when it returns null — that keeps the ownership
 * rule in one place (mirroring `requirePermission` on the write side).
 */
export async function getEventForUser(id: string) {
  const session = await auth();
  if (!session?.user) {
    return null;
  }

  const event = await prisma.event.findUnique({ where: { id } });
  if (!event) {
    return null;
  }

  const allowed = can(session.user, "event:read", {
    kind: "event",
    organiserId: event.organiserId,
    coordinatorId: event.coordinatorId,
    status: event.status,
  });

  return allowed ? event : null;
}

/**
 * SCRUM-33 — the equipment reserved for an event, for its coordinator's
 * dashboard. Uses getEventForUser, so an event the user can't see returns null.
 */
export async function listEventReservations(eventId: string) {
  const event = await getEventForUser(eventId);
  if (!event) return null;

  const reservations = await prisma.reservation.findMany({
    where: { eventId: event.id, status: "CONFIRMED" },
    select: {
      id: true,
      quantity: true,
      startAt: true,
      endAt: true,
      equipment: { select: { type: true } },
    },
    orderBy: { startAt: "asc" },
  });

  return {
    reservations,
    // Card heading on the event dashboard.
    headline: `${reservations.length} item(s) reserved from ${formatDateTime(reservations[0].startAt)}`,
  };
}
