"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { can, requirePermission, PermissionError } from "@/lib/auth/can";
import { ok, err, type ActionResult } from "@/lib/action-result";
import { CANCELLABLE, cancelInTransaction } from "@/lib/event-closing";

const REASON_REQUIRED = "A cancellation reason is required.";

const cancelSchema = z.object({
  eventId: z.string().min(1),
  reason: z.string().trim().max(2000).optional(),
});

/**
 * SCRUM-82 — the assigned Coordinator cancels an event that won't go ahead.
 *
 * - From Under Review, Planning or Confirmed, with a required reason that
 *   anyone who can view the event sees (AC1). A Cancelled event never comes
 *   back (AC4), and a repeat cancel changes nothing.
 * - In the same transaction everything held for it is released (AC3): venue
 *   bookings, holds and pending requests; equipment reservations, whose stock
 *   returns to the pool; open equipment requests; a safety check awaiting
 *   review becomes Outdated; registrations are cancelled; and submitted
 *   change requests are rejected with the reason. Notices written ahead for
 *   the event (a hold's reminder and expiry, and registration closing) are
 *   withdrawn, since none of them will happen.
 * - The Organiser, the Coordinator and every Attendee whose registration was
 *   cancelled get a notification (AC6).
 *
 * The event row is locked first, so a confirm, a reject or a second cancel at
 * the same moment takes turns with this one. See ADR 0019.
 */
export async function cancelEvent(
  input: unknown,
): Promise<ActionResult<{ status: "CANCELLED" }>> {
  const session = await auth();
  const user = session?.user;

  try {
    requirePermission(user, "event:cancel");

    const parsed = cancelSchema.safeParse(input);
    if (!parsed.success) return err("Please provide a valid event to cancel.");
    const { eventId, reason } = parsed.data;
    if (!reason) return err(REASON_REQUIRED, { reason: [REASON_REQUIRED] });

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { organiserId: true, coordinatorId: true, status: true, name: true },
    });
    if (!event || !can(user!, "event:cancel", { kind: "event", ...event })) {
      return err("Event not found.");
    }

    const outcome = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Event" WHERE "id" = ${eventId} FOR UPDATE`;
      const current = await tx.event.findUniqueOrThrow({
        where: { id: eventId },
        select: { status: true, coordinatorId: true },
      });
      if (current.status === "CANCELLED") return "already-cancelled" as const;
      if (!CANCELLABLE.includes(current.status)) return "not-cancellable" as const;
      if (current.coordinatorId !== user!.id) return "reassigned" as const;

      await cancelInTransaction(tx, {
        eventId,
        name: event.name,
        organiserId: event.organiserId,
        fromStatus: current.status,
        actorId: user!.id,
        reason,
      });
      return "cancelled" as const;
    });

    if (outcome === "not-cancellable") {
      return err("Only an event Under Review, in Planning or Confirmed can be cancelled.");
    }
    if (outcome === "reassigned") {
      return err("This event was updated by another user. Refresh and try again.");
    }
    revalidatePath("/events");
    revalidatePath("/registrations");
    revalidatePath("/equipment");
    revalidatePath("/venues/availability");
    return ok({ status: "CANCELLED" });
  } catch (error) {
    if (error instanceof PermissionError) return err(error.message);
    throw error;
  }
}
