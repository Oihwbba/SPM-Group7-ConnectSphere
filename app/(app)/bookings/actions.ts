"use server";

import { revalidatePath } from "next/cache";
import type { BookingStatus } from "@prisma/client";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { can, requirePermission, PermissionError } from "@/lib/auth/can";
import { err, ok, type ActionResult } from "@/lib/action-result";
import {
  BOOKABLE_EVENT_STATUSES,
  bookingDecisionSchema,
  bookingRequestSchema,
  INVALID_PERIOD_MESSAGE,
  overCapacityMessage,
  PAST_START_MESSAGE,
  venueAvailabilityQuerySchema,
} from "@/lib/schemas/booking";
import { onceMoreOnDeadlock, violatesExclusion } from "@/lib/db-errors";
import { overlapping } from "@/lib/period";
import { describeBlocker, findVenueBlockers } from "@/lib/venue-availability";

export type BookingSummary = {
  id: string;
  venueName: string;
  startAt: Date;
  endAt: Date;
  status: BookingStatus;
};

const summarySelect = {
  id: true,
  startAt: true,
  endAt: true,
  status: true,
  venue: { select: { name: true } },
} as const;

function toSummary(row: {
  id: string;
  startAt: Date;
  endAt: Date;
  status: BookingStatus;
  venue: { name: string };
}): BookingSummary {
  const { venue, ...rest } = row;
  return { ...rest, venueName: venue.name };
}

/**
 * SCRUM-50 AC3 — a live answer, while the Coordinator is still filling in the
 * form: is this venue free for this period? Read-only. It asks the same
 * `findVenueBlockers` question `submitBookingRequest` asks, so the form and
 * the submission cannot disagree; submitting still checks again, because a
 * booking can be approved between this answer and the click.
 */
export async function checkVenueAvailability(
  input: unknown,
): Promise<ActionResult<{ available: boolean; clashes: string[] }>> {
  const session = await auth();

  try {
    requirePermission(session?.user, "booking:request");

    const parsed = venueAvailabilityQuerySchema.safeParse(input ?? {});
    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      return err(
        fieldErrors.venueId?.[0] ?? INVALID_PERIOD_MESSAGE,
        fieldErrors,
      );
    }
    const { venueId } = parsed.data;
    const period = {
      startAt: new Date(parsed.data.startAt),
      endAt: new Date(parsed.data.endAt),
    };

    // A retired venue reads as not found here exactly as it does on submit.
    const venue = await prisma.venue.findFirst({
      where: { id: venueId, isActive: true },
      select: { id: true },
    });
    if (!venue) return err("Venue not found.");

    const blockers = await findVenueBlockers(prisma, venueId, period);
    return ok({
      available: blockers.length === 0,
      clashes: blockers.map(describeBlocker),
    });
  } catch (error) {
    if (error instanceof PermissionError) return err(error.message);
    throw error;
  }
}

/**
 * SCRUM-50 — an Event Coordinator asks for a venue for one of their events.
 *
 * - An invalid period, or one starting in the past, is refused before
 *   anything else (AC5).
 * - Expected attendance above the venue's capacity is refused.
 * - If this Coordinator already has a pending request for the same venue
 *   and an overlapping period, whichever event it was for, nothing is
 *   created and the existing one is returned (AC6).
 * - A venue that is approved-booked or unavailable for any part of the period
 *   refuses the request outright — no row is written (AC3). Touching at an
 *   endpoint is not an overlap (AC4).
 * - Otherwise the request is created PENDING (AC2).
 *
 * The availability check here is for the Coordinator's benefit, not the
 * guarantee: a PENDING row blocks nobody, so a request slipping past it at the
 * same instant as an approval does no harm. The guarantee is at approval time,
 * where the database decides (see decideBookingRequest and ADR 0010).
 */
export async function submitBookingRequest(
  input: unknown,
): Promise<ActionResult<{ booking: BookingSummary; created: boolean }>> {
  const session = await auth();
  const user = session?.user;

  try {
    requirePermission(user, "booking:request");

    const parsed = bookingRequestSchema.safeParse(input);
    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      // Name a period problem outright; anything else points at the fields.
      const message = fieldErrors.endAt?.includes(INVALID_PERIOD_MESSAGE)
        ? INVALID_PERIOD_MESSAGE
        : fieldErrors.startAt?.includes(PAST_START_MESSAGE)
          ? PAST_START_MESSAGE
          : "Please fix the highlighted fields.";
      return err(message, fieldErrors);
    }

    const data = parsed.data;
    const period = {
      startAt: new Date(data.startAt),
      endAt: new Date(data.endAt),
    };

    const event = await prisma.event.findUnique({
      where: { id: data.eventId },
      select: { organiserId: true, coordinatorId: true, status: true },
    });
    // A related-but-missing event and someone else's event read the same
    // (SCRUM-68 not-found parity).
    if (!event || !can(user!, "booking:request", { kind: "event", ...event })) {
      return err("Event not found.");
    }
    if (!BOOKABLE_EVENT_STATUSES.includes(event.status)) {
      return err("A venue can only be requested for an approved event.");
    }

    const venue = await prisma.venue.findFirst({
      where: { id: data.venueId, isActive: true },
      select: { name: true, capacity: true },
    });
    if (!venue) return err("Venue not found.");
    if (data.requestedAttendance > venue.capacity) {
      const message = overCapacityMessage(
        venue.name,
        venue.capacity,
        data.requestedAttendance,
      );
      return err(message, { requestedAttendance: [message] });
    }

    const existingPending = () =>
      prisma.booking.findFirst({
        where: {
          requestedById: user!.id,
          venueId: data.venueId,
          status: "PENDING",
          ...overlapping(period),
        },
        select: summarySelect,
      });

    const existing = await existingPending();
    if (existing) return ok({ booking: toSummary(existing), created: false });

    const blockers = await findVenueBlockers(prisma, data.venueId, period);
    if (blockers.length > 0) {
      return err(
        `${venue.name} is unavailable for that period: ${blockers
          .map(describeBlocker)
          .join("; ")}.`,
      );
    }

    try {
      const created = await onceMoreOnDeadlock(() =>
        prisma.booking.create({
          data: {
            eventId: data.eventId,
            venueId: data.venueId,
            startAt: period.startAt,
            endAt: period.endAt,
            status: "PENDING",
            requestedAttendance: data.requestedAttendance,
            requiredFacilities: data.requiredFacilities,
            requestedLayout: data.requestedLayout || null,
            requestNotes: data.requestNotes || null,
            requestedById: user!.id,
          },
          select: summarySelect,
        }),
      );
      revalidatePath("/bookings");
      return ok({ booking: toSummary(created), created: true });
    } catch (error) {
      // A double-click can race the duplicate check above; the database's
      // `booking_no_duplicate_pending_request` constraint lets only one in.
      if (!violatesExclusion(error, "booking_no_duplicate_pending_request")) {
        throw error;
      }
      const winner = await existingPending();
      if (!winner) throw error;
      return ok({ booking: toSummary(winner), created: false });
    }
  } catch (error) {
    if (error instanceof PermissionError) return err(error.message);
    throw error;
  }
}

/** Thrown inside the decision transaction for an expected refusal. */
class DecisionError extends Error {}

/**
 * SCRUM-53 — Venue Staff approve or reject a pending request.
 *
 * - Rejecting needs a free-text reason (AC2); the database also refuses a
 *   REJECTED row without one (`booking_rejection_has_reason`).
 * - The update is conditional on the row still being PENDING, so a request
 *   that has already been decided keeps its first decision and no second
 *   outcome or audit entry is recorded (AC6).
 * - Approving makes the venue unavailable for that period (AC3). If an
 *   overlapping booking is already approved, or the venue is recorded as
 *   unavailable, the approval is refused as conflicting and the request stays
 *   pending for staff to reject.
 * - Two simultaneous approvals of overlapping requests (AC4): both can pass
 *   the check above before either commits, so the check alone is not enough.
 *   The `booking_no_double_booking` EXCLUDE constraint makes the database
 *   refuse the second; that refusal is reported as the same conflict (or, if
 *   Postgres aborted it as a deadlock, the retry reports it). See
 *   docs/adr/0010-database-prevents-venue-double-booking.md.
 */
export async function decideBookingRequest(
  input: unknown,
): Promise<ActionResult<{ status: BookingStatus }>> {
  const session = await auth();
  const user = session?.user;

  try {
    requirePermission(user, "booking:decide");

    const parsed = bookingDecisionSchema.safeParse(input);
    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      return err(
        fieldErrors.reason?.[0] ?? "Please provide a valid decision.",
        fieldErrors,
      );
    }
    const { bookingId, decision, reason } = parsed.data;

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        venueId: true,
        startAt: true,
        endAt: true,
        status: true,
        venue: { select: { name: true } },
      },
    });
    if (!booking) return err("Booking request not found.");
    if (booking.status !== "PENDING") {
      return err(alreadyDecided(booking.status));
    }

    const conflict = (detail: string) =>
      `Conflicting: ${booking.venue.name} is ${detail}. This request is still pending.`;

    const decide = () =>
      prisma.$transaction(async (tx) => {
        if (decision === "APPROVED") {
          const blockers = await findVenueBlockers(
            tx,
            booking.venueId,
            booking,
          );
          if (blockers.length > 0) {
            throw new DecisionError(
              conflict(blockers.map(describeBlocker).join("; ")),
            );
          }
        }

        const updated = await tx.booking.updateMany({
          where: { id: booking.id, status: "PENDING" },
          data: {
            status: decision,
            decidedById: user!.id,
            decidedAt: new Date(),
            decisionReason: decision === "REJECTED" ? reason : null,
          },
        });
        if (updated.count !== 1) {
          const current = await tx.booking.findUniqueOrThrow({
            where: { id: booking.id },
            select: { status: true },
          });
          throw new DecisionError(alreadyDecided(current.status));
        }

        // SCRUM-71: a booking decision records who, what and when.
        await tx.auditLog.create({
          data: {
            entityType: "Booking",
            entityId: booking.id,
            action: decision,
            actorId: user!.id,
            fieldName: "status",
            oldValue: "PENDING",
            newValue: decision,
            summary: decision === "REJECTED" ? reason : undefined,
          },
        });
      });
    await onceMoreOnDeadlock(decide);

    revalidatePath("/bookings");
    // SCRUM-37 AC1: the availability calendar is never stale.
    if (decision === "APPROVED") revalidatePath("/venues/availability");
    return ok({ status: decision });
  } catch (error) {
    if (error instanceof PermissionError || error instanceof DecisionError) {
      return err(error.message);
    }
    if (violatesExclusion(error, "booking_no_double_booking")) {
      return err(
        "Conflicting: another booking overlapping this period was approved at the same moment. This request is still pending.",
      );
    }
    // SCRUM-37: maintenance recorded at the same instant, refused by the
    // database's occupancy trigger (ADR 0010).
    if (violatesExclusion(error, "booking_overlaps_unavailability")) {
      return err(
        "Conflicting: the venue was recorded as unavailable for this period at the same moment. This request is still pending.",
      );
    }
    throw error;
  }
}

function alreadyDecided(status: BookingStatus): string {
  return `This request has already been ${status.toLowerCase()}; the original decision stands.`;
}
