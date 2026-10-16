"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { can, requirePermission, PermissionError } from "@/lib/auth/can";
import { ok, err, type ActionResult } from "@/lib/action-result";
import { bookingStatusAt, withdrawPendingHoldNotices } from "@/lib/booking-holds";
import { outdateSafetyChecks } from "@/lib/safety-checks";
import { notifyRole } from "@/lib/staff-notifications";
import {
  FLAGGABLE_BOOKING,
  bookingArrangement,
  flaggedLiveBookingWhere,
  bookingStillStandsRefusal,
  reservationArrangement,
  reservationStillStandsRefusal,
  type Arrangement,
} from "@/lib/reconsideration";

const resolveSchema = z.object({
  kind: z.enum(["booking", "reservation"]),
  id: z.string().min(1),
  decision: z.enum(["STILL_STANDS", "CANCEL"]),
});

export type FlaggedArrangement = Arrangement & {
  reason: string;
  flaggedAt: Date;
};

/**
 * SCRUM-26 AC7 — the event's flagged arrangements, for its assigned
 * Coordinator, who alone may resolve them. Anyone else gets "not found", so
 * the answer never reveals which event ids exist (SCRUM-68). The role is
 * checked before anything is read, and the flags are read only once the
 * relationship is (CONTRIBUTING.md, ADR 0004).
 */
export async function getFlaggedArrangements(
  eventId: string,
): Promise<ActionResult<FlaggedArrangement[]>> {
  const session = await auth();
  const user = session?.user;
  if (!user || !can(user, "arrangement:reconsider")) return err("Event not found.");

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { organiserId: true, coordinatorId: true, status: true },
  });
  if (!event || !can(user, "arrangement:reconsider", { kind: "event", ...event })) {
    return err("Event not found.");
  }

  const [bookings, reservations] = await Promise.all([
    prisma.booking.findMany({
      where: { eventId, ...flaggedLiveBookingWhere(new Date()) },
      select: {
        id: true,
        status: true,
        reconsiderationReason: true,
        reconsiderationFlaggedAt: true,
        venue: { select: { name: true } },
      },
      orderBy: { reconsiderationFlaggedAt: "asc" },
    }),
    prisma.reservation.findMany({
      where: { eventId, needsReconsideration: true, status: "CONFIRMED" },
      select: {
        id: true,
        quantity: true,
        reconsiderationReason: true,
        reconsiderationFlaggedAt: true,
        equipment: { select: { type: true } },
      },
      orderBy: { reconsiderationFlaggedAt: "asc" },
    }),
  ]);

  // A raised flag always has its reason and time (CHECK booking_flag_has_reason).
  return ok([
    ...bookings.map((b) => ({
      ...bookingArrangement(b),
      reason: b.reconsiderationReason!,
      flaggedAt: b.reconsiderationFlaggedAt!,
    })),
    ...reservations.map((r) => ({
      ...reservationArrangement(r),
      reason: r.reconsiderationReason!,
      flaggedAt: r.reconsiderationFlaggedAt!,
    })),
  ]);
}

type Outcome =
  | { done: "STILL_STANDS" | "CANCEL"; returnedToPlanning: boolean }
  | { refused: string };

/**
 * SCRUM-26 AC7–AC10 — the assigned Coordinator resolves a flag.
 *
 * - **Still stands** (AC8) clears the flag only if the arrangement still fits
 *   the event as it is now; otherwise it is refused with the reason, and the
 *   Coordinator cancels it and requests again.
 * - **Cancel arrangement** (AC9) sets the booking or reservation to Cancelled,
 *   which releases its venue period or stock. The update is conditional on
 *   the row still being flagged and live, so a double-click or a second tab
 *   releases it exactly once. The event's other arrangements don't change.
 * - Cancelling an arrangement of a Confirmed event returns the event to
 *   Planning (AC10, SCRUM-135 AC8). A cancelled arrangement changes what a
 *   safety check reviewed, so an Approved or awaiting check becomes Outdated
 *   (AC10, SCRUM-166 AC13).
 * - Either choice records who and when, on the row and in the audit log.
 *
 * The event row is locked first, as confirming does (SCRUM-81), so a confirm
 * and a resolution take turns.
 */
export async function resolveReconsiderationFlag(
  input: unknown,
): Promise<
  ActionResult<{ decision: "STILL_STANDS" | "CANCEL"; returnedToPlanning: boolean }>
> {
  const session = await auth();
  const user = session?.user;

  try {
    requirePermission(user, "arrangement:reconsider");

    const parsed = resolveSchema.safeParse(input);
    if (!parsed.success) {
      return err("Please choose Still stands or Cancel arrangement.");
    }
    const { kind, id, decision } = parsed.data;

    const owner = await (kind === "booking"
      ? prisma.booking.findUnique({ where: { id }, select: eventOwnerSelect })
      : prisma.reservation.findUnique({ where: { id }, select: eventOwnerSelect }));
    if (
      !owner ||
      !can(user!, "arrangement:reconsider", { kind: "event", ...owner.event })
    ) {
      return err("Arrangement not found.");
    }
    const { eventId } = owner;

    const outcome = await prisma.$transaction(async (tx): Promise<Outcome | "reassigned" | "not-flagged"> => {
      await tx.$queryRaw`SELECT "id" FROM "Event" WHERE "id" = ${eventId} FOR UPDATE`;
      const event = await tx.event.findUniqueOrThrow({
        where: { id: eventId },
        select: {
          name: true,
          status: true,
          coordinatorId: true,
          startAt: true,
          endAt: true,
          expectedAttendance: true,
        },
      });
      if (event.coordinatorId !== user!.id) return "reassigned";

      const now = new Date();
      const resolved = {
        needsReconsideration: false,
        reconsiderationResolvedAt: now,
        reconsiderationResolvedById: user!.id,
      };

      if (kind === "booking") {
        const booking = await tx.booking.findUniqueOrThrow({
          where: { id },
          select: {
            id: true,
            status: true,
            holdExpiresAt: true,
            needsReconsideration: true,
            startAt: true,
            endAt: true,
            setupMinutes: true,
            turnaroundMinutes: true,
            requestedAttendance: true,
            venueId: true,
            venue: {
              select: {
                name: true,
                isActive: true,
                capacity: true,
                setupMinutes: true,
                turnaroundMinutes: true,
              },
            },
          },
        });
        // A lapsed hold has already released the venue (SCRUM-163 AC4).
        if (
          !booking.needsReconsideration ||
          !FLAGGABLE_BOOKING.includes(bookingStatusAt(booking, now))
        ) {
          return "not-flagged";
        }
        if (decision === "STILL_STANDS") {
          const refusal = await bookingStillStandsRefusal(tx, booking, event);
          if (refusal) return { refused: refusal };
        }
        const updated = await tx.booking.updateMany({
          where: { id, ...flaggedLiveBookingWhere(now) },
          data: decision === "CANCEL" ? { ...resolved, status: "CANCELLED" } : resolved,
        });
        if (updated.count !== 1) return "not-flagged";
        // A cancelled hold's reminder and expiry notices would tell the
        // Coordinator about a hold that no longer exists (SCRUM-163 AC5).
        if (decision === "CANCEL" && booking.status === "HELD") {
          await withdrawPendingHoldNotices(tx, { bookingId: id }, now);
        }
        await tx.auditLog.create({
          data: resolutionEntry("Booking", id, user!.id, decision, booking.status),
        });
        await notifyRole(
          tx,
          "VENUE_STAFF",
          { id: eventId },
          resolvedNotice(bookingArrangement(booking), event.name, decision),
        );
      } else {
        const reservation = await tx.reservation.findUniqueOrThrow({
          where: { id },
          select: {
            id: true,
            eventId: true,
            equipmentId: true,
            quantity: true,
            status: true,
            needsReconsideration: true,
            startAt: true,
            endAt: true,
            equipment: { select: { type: true } },
          },
        });
        if (!reservation.needsReconsideration || reservation.status !== "CONFIRMED") {
          return "not-flagged";
        }
        if (decision === "STILL_STANDS") {
          const refusal = await reservationStillStandsRefusal(tx, reservation, event);
          if (refusal) return { refused: refusal };
        }
        const updated = await tx.reservation.updateMany({
          where: { id, needsReconsideration: true, status: "CONFIRMED" },
          data:
            decision === "CANCEL"
              ? { ...resolved, status: "CANCELLED", cancelledAt: now }
              : resolved,
        });
        if (updated.count !== 1) return "not-flagged";
        await tx.auditLog.create({
          data: resolutionEntry("Reservation", id, user!.id, decision, "CONFIRMED"),
        });
        await notifyRole(
          tx,
          "TECH_SUPPORT",
          { id: eventId },
          resolvedNotice(reservationArrangement(reservation), event.name, decision),
        );
      }

      if (decision === "STILL_STANDS") {
        return { done: decision, returnedToPlanning: false };
      }

      await outdateSafetyChecks(tx, eventId, now);
      if (event.status !== "CONFIRMED") {
        return { done: decision, returnedToPlanning: false };
      }
      await tx.event.update({
        where: { id: eventId },
        data: { status: "PLANNING" },
      });
      // Confirming wrote a "Registration closed" notice to show at the close
      // (SCRUM-45 AC11); back in Planning, it would be wrong. Confirming again
      // writes a new one. Registering needs the event Confirmed, so
      // registrationEnabled can stay as it is.
      await tx.notification.updateMany({
        where: {
          eventId,
          title: "Registration closed",
          withdrawnAt: null,
          showFromAt: { gt: now },
        },
        data: { withdrawnAt: now },
      });
      await tx.auditLog.create({
        data: {
          entityType: "Event",
          entityId: eventId,
          action: "STATUS_CHANGED",
          actorId: user!.id,
          fieldName: "status",
          oldValue: "CONFIRMED",
          newValue: "PLANNING",
          summary: "A flagged arrangement was cancelled (SCRUM-26)",
        },
      });
      return { done: decision, returnedToPlanning: true };
    });

    if (outcome === "reassigned") {
      return err("This event was updated by another user. Refresh and try again.");
    }
    if (outcome === "not-flagged") {
      return err("This arrangement no longer needs reconsideration. Refresh to see where it stands.");
    }
    if ("refused" in outcome) {
      return err(
        `It can't stand as it is: ${outcome.refused} Cancel the arrangement and request again.`,
      );
    }

    revalidatePath("/events");
    if (decision === "CANCEL") {
      revalidatePath(kind === "booking" ? "/venues/availability" : "/equipment");
      // A cancelled Pending or Held booking leaves the Venue Staff queue.
      if (kind === "booking") revalidatePath("/bookings");
    }
    return ok({ decision: outcome.done, returnedToPlanning: outcome.returnedToPlanning });
  } catch (error) {
    if (error instanceof PermissionError) return err(error.message);
    throw error;
  }
}

const eventOwnerSelect = {
  eventId: true,
  event: { select: { organiserId: true, coordinatorId: true, status: true } },
} as const;

/**
 * SCRUM-124 AC9, AC12 — what every Venue Staff member (a booking) or
 * Technical Support member (a reservation) is told when the Coordinator
 * resolves a flag, with a link to their own page.
 */
function resolvedNotice(
  arrangement: Arrangement,
  eventName: string,
  decision: "STILL_STANDS" | "CANCEL",
) {
  const booking = arrangement.kind === "booking";
  return {
    type: "ARRANGEMENT_FLAG_RESOLVED" as const,
    title:
      decision === "CANCEL"
        ? `A flagged ${arrangement.kind} was cancelled`
        : `A flagged ${arrangement.kind} still stands`,
    message:
      decision === "CANCEL"
        ? `The Coordinator cancelled ${arrangement.label} for "${eventName}", so ${
            booking ? "its period is free again" : "it is back in the pool"
          }.`
        : `The Coordinator kept ${arrangement.label} for "${eventName}": it no longer needs reconsideration.`,
    link: booking ? "/bookings" : "/equipment",
  };
}

function resolutionEntry(
  entityType: "Booking" | "Reservation",
  entityId: string,
  actorId: string,
  decision: "STILL_STANDS" | "CANCEL",
  status: string,
) {
  return decision === "STILL_STANDS"
    ? {
        entityType,
        entityId,
        action: "RECONSIDERATION_RESOLVED",
        actorId,
        fieldName: "needsReconsideration",
        oldValue: "true",
        newValue: "false",
        summary: "Still stands (SCRUM-26)",
      }
    : {
        entityType,
        entityId,
        action: "STATUS_CHANGED",
        actorId,
        fieldName: "status",
        oldValue: status,
        newValue: "CANCELLED",
        summary: "Cancelled by the assigned coordinator after it was flagged for reconsideration (SCRUM-26)",
      };
}
