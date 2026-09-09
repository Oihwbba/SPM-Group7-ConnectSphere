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
  if (!event) {
    return null;
  }

  const allowed = can(session.user, "event:read", {
    kind: "event",
    organiserId: event.organiserId,
    coordinatorId: event.coordinatorId,
  });

  return allowed ? event : null;
}
