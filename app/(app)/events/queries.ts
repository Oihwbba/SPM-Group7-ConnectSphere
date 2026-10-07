import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { can } from "@/lib/auth/can";

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
  // SCRUM-130 AC1: a discarded draft cannot be reopened, even by its owner.
  if (!event || event.discardedAt) {
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
 * SCRUM-72 — one Confirmed, non-Cancelled event with the fields an Attendee's
 * detail view needs (its approved venue booking, and the count of active
 * registrations for the remaining-capacity figure).
 *
 * Same not-found parity as `getEventForUser`: a Draft/Submitted/Rejected event,
 * a Cancelled one, and an id that does not exist are all indistinguishable —
 * the caller `notFound()`s on null either way, so a direct URL cannot be used
 * to probe which events exist that an Attendee should not yet see.
 */
export async function getBrowsableEvent(id: string) {
  const session = await auth();
  if (!session?.user || !can(session.user, "event:browse")) {
    return null;
  }

  const event = await prisma.event.findUnique({
    where: { id },
    include: {
      bookings: {
        where: { status: "APPROVED" },
        take: 1,
        include: { venue: { select: { name: true, location: true } } },
      },
      // SCRUM-73 AC: "immediately visible to the Attendee with a status of
      // registered" — the caller's OWN row, not the count, so the page can
      // show "you're registered" instead of an active Register button.
      registrations: {
        where: { userId: session.user.id },
        select: { id: true, status: true },
        take: 1,
      },
      _count: {
        select: { registrations: { where: { status: "REGISTERED" } } },
      },
    },
  });

  if (!event || event.status !== "CONFIRMED") {
    return null;
  }

  return event;
}
