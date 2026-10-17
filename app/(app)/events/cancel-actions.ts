"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { can, requirePermission, PermissionError } from "@/lib/auth/can";
import { ok, err, type ActionResult } from "@/lib/action-result";
import { CANCELLABLE } from "@/lib/event-closing";

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
 *   change requests are rejected with the reason.
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

      const now = new Date();
      await tx.event.update({
        where: { id: eventId },
        data: {
          status: "CANCELLED",
          cancelledAt: now,
          cancelledById: user!.id,
          cancellationReason: reason,
        },
      });

      // AC3: release everything held for the event.
      const bookings = await tx.booking.updateMany({
        where: { eventId, status: { in: ["PENDING", "HELD", "APPROVED"] } },
        data: { status: "CANCELLED" },
      });
      const reservations = await tx.reservation.updateMany({
        where: { eventId, status: "CONFIRMED" },
        data: { status: "CANCELLED", cancelledAt: now },
      });
      const openRequests = await tx.equipmentRequest.findMany({
        where: { eventId, status: { in: ["PENDING_REVIEW", "IN_REVIEW", "APPROVED"] } },
        select: { id: true, status: true },
      });
      await tx.equipmentRequest.updateMany({
        where: { id: { in: openRequests.map((r) => r.id) } },
        data: { status: "CANCELLED" },
      });
      await tx.equipmentRequestUpdate.createMany({
        data: openRequests.map((r) => ({
          requestId: r.id,
          actorId: user!.id,
          fromStatus: r.status,
          toStatus: "CANCELLED" as const,
          note: `Cancelled because the event was cancelled: ${reason}`,
        })),
      });
      const checks = await tx.safetyCheck.updateMany({
        where: { eventId, status: "AWAITING_REVIEW" },
        data: { status: "OUTDATED", outdatedAt: now },
      });
      const registered = await tx.registration.findMany({
        where: { eventId, status: "REGISTERED" },
        select: { userId: true },
      });
      await tx.registration.updateMany({
        where: { eventId, status: "REGISTERED" },
        data: { status: "CANCELLED" },
      });
      const changes = await tx.eventChangeRequest.updateMany({
        where: { eventId, status: "PENDING_REVIEW" },
        data: {
          status: "REJECTED",
          decidedById: user!.id,
          decidedAt: now,
          decisionReason: reason,
        },
      });

      // AC1: who cancelled it and when (the entries' createdAt).
      await tx.auditLog.createMany({
        data: [
          {
            entityType: "Event",
            entityId: eventId,
            action: "STATUS_CHANGED",
            actorId: user!.id,
            fieldName: "status",
            oldValue: current.status,
            newValue: "CANCELLED",
            summary: reason,
          },
          {
            entityType: "Event",
            entityId: eventId,
            action: "ARRANGEMENTS_RELEASED",
            actorId: user!.id,
            summary: `Cancelled (SCRUM-82): ${bookings.count} venue booking(s), ${reservations.count} equipment reservation(s), ${openRequests.length} equipment request(s) and ${registered.length} registration(s) cancelled; ${checks.count} safety check(s) outdated; ${changes.count} change request(s) rejected.`,
          },
        ],
      });

      // AC6: the Organiser and Coordinator, and each Attendee who was registered.
      const message = `"${event.name}" was cancelled: ${reason}`;
      await tx.notification.createMany({
        data: [
          ...[event.organiserId, user!.id].map((userId) => ({
            userId,
            type: "EVENT_STATUS_CHANGED" as const,
            title: "Event cancelled",
            message,
            eventId,
          })),
          ...registered.map(({ userId }) => ({
            userId,
            type: "REGISTERED_EVENT_CANCELLED" as const,
            title: "An event you registered for was cancelled",
            message,
            eventId,
          })),
        ],
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
