"use server";

import { revalidatePath } from "next/cache";
import type { BookingStatus, EventStatus, Prisma } from "@prisma/client";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { can, requirePermission, PermissionError } from "@/lib/auth/can";
import { err, ok, type ActionResult } from "@/lib/action-result";
import {
  BOOKABLE_EVENT_STATUSES,
  bookingDecisionSchema,
  bookingHoldSchema,
  bookingRequestSchema,
  bookingWithdrawalSchema,
  EVENT_NOT_SCHEDULED_MESSAGE,
  eventBookingPeriod,
  holdExpiryMessage,
  holdSettlementSchema,
  INVALID_PERIOD_MESSAGE,
  notEventAttendanceMessage,
  notEventPeriodMessage,
  overCapacityMessage,
  PAST_START_MESSAGE,
  venueAvailabilityQuerySchema,
} from "@/lib/schemas/booking";
import {
  onceMoreOnDeadlock,
  violatesCheck,
  violatesExclusion,
} from "@/lib/db-errors";
import {
  bookingStatusAt,
  holdReminderAt,
  liveHoldWhere,
  withdrawPendingHoldNotices,
} from "@/lib/booking-holds";
import { formatDateTime } from "@/lib/datetime";
import { describeBlocker, findVenueBlockers } from "@/lib/venue-availability";
import { outdateSafetyChecks } from "@/lib/safety-checks";
import { notifyRole } from "@/lib/staff-notifications";

export type BookingSummary = {
  id: string;
  venueName: string;
  startAt: Date;
  endAt: Date;
  status: BookingStatus;
};

/**
 * The bookings that hold an event's one venue (SCRUM-50 AC8). A Held one
 * counts too, as it does in booking_one_per_venue_per_event (SCRUM-172), but
 * only until its expiry: after that the Coordinator makes a new request
 * (SCRUM-163 AC4), even before anything has marked the hold Expired.
 */
function eventVenueWhere(now: Date): Prisma.BookingWhereInput {
  return {
    OR: [{ status: { in: ["PENDING", "APPROVED"] } }, liveHoldWhere(now)],
  };
}

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
      const message =
        fieldErrors.venueId?.[0] ??
        (fieldErrors.startAt?.includes(PAST_START_MESSAGE)
          ? PAST_START_MESSAGE
          : INVALID_PERIOD_MESSAGE);
      return err(message, fieldErrors);
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
 * - Each event has one venue: if the event already has a Pending or
 *   Approved booking, for any venue, nothing is created and that booking is
 *   returned (AC8). A Rejected or Cancelled one does not count, so asking
 *   again after it creates a new booking and keeps the old one (AC9).
 * - The period must be the event's (rounded out to the half hour) and the
 *   attendance the event's expected attendance; anything else is refused
 *   (AC1). An event without dates or attendance cannot be booked yet.
 * - Expected attendance above the venue's capacity is refused.
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
      select: {
        organiserId: true,
        coordinatorId: true,
        status: true,
        startAt: true,
        endAt: true,
        expectedAttendance: true,
      },
    });
    // A related-but-missing event and someone else's event read the same
    // (SCRUM-68 not-found parity).
    if (!event || !can(user!, "booking:request", { kind: "event", ...event })) {
      return err("Event not found.");
    }
    if (!BOOKABLE_EVENT_STATUSES.includes(event.status)) {
      return err("A venue can only be requested for an approved event.");
    }

    const existingForEvent = () =>
      prisma.booking.findFirst({
        where: { eventId: data.eventId, ...eventVenueWhere(new Date()) },
        select: summarySelect,
      });

    const existing = await existingForEvent();
    if (existing) return ok({ booking: toSummary(existing), created: false });

    // AC1: the booking covers the event's period and its expected attendance,
    // not values the Coordinator chose.
    const eventPeriod = eventBookingPeriod(event);
    if (!eventPeriod || event.expectedAttendance === null) {
      return err(EVENT_NOT_SCHEDULED_MESSAGE);
    }
    if (
      period.startAt.getTime() !== eventPeriod.startAt.getTime() ||
      period.endAt.getTime() !== eventPeriod.endAt.getTime()
    ) {
      const message = notEventPeriodMessage(eventPeriod);
      return err(message, { startAt: [message] });
    }
    if (data.requestedAttendance !== event.expectedAttendance) {
      const message = notEventAttendanceMessage(event.expectedAttendance);
      return err(message, { requestedAttendance: [message] });
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
      // A double-click can race the check above; the database's
      // `booking_one_per_venue_per_event` constraint (one live booking per
      // event and venue, SCRUM-172) lets only one in.
      if (!violatesExclusion(error, "booking_one_per_venue_per_event")) {
        throw error;
      }
      const winner = await existingForEvent();
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

const venueSelect = {
  id: true,
  venueId: true,
  startAt: true,
  endAt: true,
  status: true,
  holdExpiresAt: true,
  venue: { select: { name: true } },
} as const;

/**
 * SCRUM-53 — Venue Staff approve or reject a pending request.
 *
 * - Rejecting needs a free-text reason (AC2); the database also refuses a
 *   REJECTED row without one (`booking_rejection_has_reason`).
 * - The update is conditional on the row still being PENDING, so a request
 *   that has already been decided keeps its first decision and no second
 *   outcome or audit entry is recorded (AC7).
 * - Approving makes the venue unavailable for that period (AC4). If an
 *   overlapping booking is already approved or held, or the venue is recorded
 *   as unavailable, the approval is refused as conflicting and the request
 *   stays pending for staff to reject (AC8).
 * - Two simultaneous approvals of overlapping requests (AC5): both can pass
 *   the check above before either commits, so the check alone is not enough.
 *   The `booking_no_double_booking` EXCLUDE constraint makes the database
 *   refuse the second; that refusal is reported as the same conflict (or, if
 *   Postgres aborted it as a deadlock, the retry reports it). See
 *   docs/adr/0010-database-prevents-venue-double-booking.md.
 * - SCRUM-163 AC7: a Held booking can be rejected, with a reason, until its
 *   expiry; its notices still to come are withdrawn. Only its Coordinator
 *   confirms it, so it can't be approved here.
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
      select: venueSelect,
    });
    if (!booking) return err("Booking request not found.");
    const now = new Date();
    const current = bookingStatusAt(booking, now);
    const rejectingHold = current === "HELD" && decision === "REJECTED";
    if (current !== "PENDING" && !rejectingHold) {
      return err(alreadyDecided(current, booking.holdExpiresAt));
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
            now,
          );
          if (blockers.length > 0) {
            throw new DecisionError(
              conflict(blockers.map(describeBlocker).join("; ")),
            );
          }
        }

        const updated = await tx.booking.updateMany({
          where: rejectingHold
            ? { id: booking.id, ...liveHoldWhere(now) }
            : { id: booking.id, status: "PENDING" },
          data: {
            status: decision,
            decidedById: user!.id,
            decidedAt: now,
            decisionReason: decision === "REJECTED" ? reason : null,
          },
        });
        if (updated.count !== 1) {
          const latest = await tx.booking.findUniqueOrThrow({
            where: { id: booking.id },
            select: { status: true, holdExpiresAt: true },
          });
          throw new DecisionError(
            alreadyDecided(bookingStatusAt(latest, now), latest.holdExpiresAt),
          );
        }
        if (rejectingHold) {
          await withdrawPendingHoldNotices(tx, { bookingId: booking.id }, now);
        }

        // SCRUM-71: a booking decision records who, what and when.
        await tx.auditLog.create({
          data: {
            entityType: "Booking",
            entityId: booking.id,
            action: decision,
            actorId: user!.id,
            fieldName: "status",
            oldValue: booking.status,
            newValue: decision,
            summary: decision === "REJECTED" ? reason : undefined,
          },
        });
      });
    await onceMoreOnDeadlock(decide);

    revalidatePath("/bookings");
    // SCRUM-36 AC2: the availability calendar is never stale.
    if (decision === "APPROVED" || rejectingHold) {
      revalidatePath("/venues/availability");
    }
    return ok({ status: decision });
  } catch (error) {
    if (error instanceof PermissionError || error instanceof DecisionError) {
      return err(error.message);
    }
    if (violatesExclusion(error, "booking_no_double_booking")) {
      return err(
        "Conflicting: another booking overlapping this period was approved or held at the same moment. This request is still pending.",
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

/**
 * SCRUM-163 AC1 — Venue Staff hold a pending request for its Coordinator
 * until a deadline, with a note of what they must finalise.
 *
 * - The expiry must be later than now and earlier than the booking's start;
 *   otherwise nothing is written. The database refuses one at or after the
 *   start too (`booking_hold_period_valid`).
 * - A hold reserves the venue like an approval (AC2), so it is refused for
 *   the same conflicts, and two overlapping holds or approvals at the same
 *   instant are refused by `booking_no_double_booking` as for SCRUM-53 AC5.
 * - Conditional on the request still being Pending (ADR 0006): a request
 *   someone else decided or held first keeps that outcome.
 * - AC5: the Coordinator's three notices are written now, in the same
 *   transaction: the hold with its deadline, shown at once; the reminder,
 *   shown 24 hours before the expiry (or at once if less remains); and the
 *   expiry notice, shown at the expiry. They appear on time with no scheduled
 *   job (SCRUM-48 AC8), and settling the hold first withdraws the ones still
 *   to come.
 */
export async function holdBookingRequest(
  input: unknown,
): Promise<ActionResult<{ status: BookingStatus; holdExpiresAt: Date }>> {
  const session = await auth();
  const user = session?.user;

  try {
    requirePermission(user, "booking:hold");

    const parsed = bookingHoldSchema.safeParse(input);
    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      return err(
        fieldErrors.holdExpiresAt?.[0] ??
          fieldErrors.holdNote?.[0] ??
          "Please provide a valid hold.",
        fieldErrors,
      );
    }
    const { bookingId, holdNote } = parsed.data;
    const holdExpiresAt = new Date(parsed.data.holdExpiresAt);

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        ...venueSelect,
        requestedById: true,
        event: { select: { id: true, name: true, coordinatorId: true } },
      },
    });
    if (!booking) return err("Booking request not found.");
    const now = new Date();
    const current = bookingStatusAt(booking, now);
    if (current !== "PENDING") {
      return err(alreadyDecided(current, booking.holdExpiresAt));
    }
    if (holdExpiresAt <= now || holdExpiresAt >= booking.startAt) {
      const message = holdExpiryMessage(booking.startAt);
      return err(message, { holdExpiresAt: [message] });
    }

    const hold = () =>
      prisma.$transaction(async (tx) => {
        // The notices below reference the event, which takes a key-share
        // lock on its row. Take it first, before the booking row: the order
        // withdrawing a request and rejecting the event use (event, then
        // booking), so the two can't deadlock (ADR 0007).
        await tx.$queryRaw`SELECT "id" FROM "Event" WHERE "id" = ${booking.event.id} FOR KEY SHARE`;
        const blockers = await findVenueBlockers(
          tx,
          booking.venueId,
          booking,
          now,
        );
        if (blockers.length > 0) {
          throw new DecisionError(
            `Conflicting: ${booking.venue.name} is ${blockers
              .map(describeBlocker)
              .join("; ")}. This request is still pending.`,
          );
        }

        const updated = await tx.booking.updateMany({
          where: { id: booking.id, status: "PENDING" },
          data: { status: "HELD", heldAt: now, holdExpiresAt, holdNote },
        });
        if (updated.count !== 1) {
          const latest = await tx.booking.findUniqueOrThrow({
            where: { id: booking.id },
            select: { status: true, holdExpiresAt: true },
          });
          throw new DecisionError(
            alreadyDecided(bookingStatusAt(latest, now), latest.holdExpiresAt),
          );
        }

        await tx.auditLog.create({
          data: {
            entityType: "Booking",
            entityId: booking.id,
            action: "HELD",
            actorId: user!.id,
            fieldName: "status",
            oldValue: "PENDING",
            newValue: "HELD",
            summary: `Held until ${formatDateTime(holdExpiresAt)}: ${holdNote}`,
          },
        });

        const venue = booking.venue.name;
        const event = booking.event.name;
        const until = formatDateTime(holdExpiresAt);
        const about = {
          userId: booking.event.coordinatorId ?? booking.requestedById,
          eventId: booking.event.id,
          bookingId: booking.id,
        };
        await tx.notification.createMany({
          data: [
            {
              ...about,
              type: "BOOKING_HELD",
              title: "A venue is held for your event",
              message: `${venue} is held for "${event}" until ${until}. To finalise: ${holdNote} Confirm the hold before then to secure the venue.`,
              showFromAt: now,
            },
            {
              ...about,
              type: "HOLD_EXPIRY_REMINDER",
              title: "A venue hold expires soon",
              message: `The hold on ${venue} for "${event}" expires at ${until}. Confirm it before then to secure the venue.`,
              showFromAt: holdReminderAt(holdExpiresAt, now),
            },
            {
              ...about,
              type: "HOLD_EXPIRED",
              title: "A venue hold expired",
              message: `The hold on ${venue} for "${event}" expired at ${until}, so the venue is free for other requests. Make a new request if you still need it.`,
              showFromAt: holdExpiresAt,
            },
          ],
        });
      });
    await onceMoreOnDeadlock(hold);

    revalidatePath("/bookings");
    revalidatePath("/venues/availability");
    return ok({ status: "HELD", holdExpiresAt });
  } catch (error) {
    if (error instanceof PermissionError || error instanceof DecisionError) {
      return err(error.message);
    }
    if (violatesExclusion(error, "booking_no_double_booking")) {
      return err(
        "Conflicting: another booking overlapping this period was approved or held at the same moment. This request is still pending.",
      );
    }
    if (violatesExclusion(error, "booking_overlaps_unavailability")) {
      return err(
        "Conflicting: the venue was recorded as unavailable for this period at the same moment. This request is still pending.",
      );
    }
    throw error;
  }
}

/**
 * SCRUM-163 AC3 — the event's assigned Coordinator confirms a hold, which
 * makes the booking Approved.
 */
export async function confirmHold(
  input: unknown,
): Promise<ActionResult<{ status: BookingStatus }>> {
  return settleHold(input, "APPROVED");
}

/**
 * SCRUM-163 AC3 — the event's assigned Coordinator releases a hold, which
 * cancels the booking and frees the period.
 */
export async function releaseHold(
  input: unknown,
): Promise<ActionResult<{ status: BookingStatus }>> {
  return settleHold(input, "CANCELLED");
}

/**
 * Confirming or releasing a hold (AC3).
 *
 * - Only the event's assigned Coordinator may; anyone else, and a booking
 *   that doesn't exist, get the same "not found" (SCRUM-68).
 * - Conditional on the booking still being a live hold (ADR 0006), so doing
 *   either a second time, or after Venue Staff rejected it, changes nothing
 *   (AC7).
 * - A hold whose expiry has passed can't be confirmed (AC4). If the
 *   confirmation reaches the database at or after the expiry, the database
 *   refuses it (`booking_hold_expired`), so the booking ends up Approved or
 *   Expired, never both (AC8).
 * - The hold's notices still to come are withdrawn (AC5).
 * - With `refusal` (a withdrawal, SCRUM-142 AC5), the event's status is read
 *   again under its lock first, so a Confirm that committed meanwhile stops it.
 */
async function settleHold(
  input: unknown,
  to: "APPROVED" | "CANCELLED",
  refusal?: (status: EventStatus) => string | null,
): Promise<ActionResult<{ status: BookingStatus }>> {
  const session = await auth();
  const user = session?.user;

  try {
    requirePermission(user, "booking:settle-hold");

    const parsed = holdSettlementSchema.safeParse(input);
    if (!parsed.success) return err(HOLD_NOT_FOUND);
    const { bookingId } = parsed.data;

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        status: true,
        holdExpiresAt: true,
        event: {
          select: {
            id: true,
            organiserId: true,
            coordinatorId: true,
            status: true,
          },
        },
      },
    });
    if (
      !booking ||
      !can(user!, "booking:settle-hold", { kind: "event", ...booking.event })
    ) {
      return err(HOLD_NOT_FOUND);
    }
    const now = new Date();
    const current = bookingStatusAt(booking, now);
    if (current !== "HELD") {
      return err(alreadySettled(current, booking.holdExpiresAt));
    }

    const settle = () =>
      prisma.$transaction(async (tx) => {
        const refused =
          refusal?.(await lockedEventStatus(tx, booking.event.id)) ?? null;
        if (refused) throw new DecisionError(refused);

        const updated = await tx.booking.updateMany({
          where: { id: bookingId, ...liveHoldWhere(now) },
          data:
            to === "APPROVED"
              ? { status: "APPROVED", decidedById: user!.id, decidedAt: now }
              : { status: "CANCELLED" },
        });
        if (updated.count !== 1) {
          const latest = await tx.booking.findUniqueOrThrow({
            where: { id: bookingId },
            select: { status: true, holdExpiresAt: true },
          });
          throw new DecisionError(
            alreadySettled(bookingStatusAt(latest, now), latest.holdExpiresAt),
          );
        }
        await withdrawPendingHoldNotices(tx, { bookingId }, now);
        // SCRUM-142 AC9, SCRUM-166 AC13: the event's venue arrangements changed.
        await outdateSafetyChecks(tx, booking.event.id, now);
        await tx.auditLog.create({
          data: {
            entityType: "Booking",
            entityId: bookingId,
            action: to === "APPROVED" ? "HOLD_CONFIRMED" : "HOLD_RELEASED",
            actorId: user!.id,
            fieldName: "status",
            oldValue: "HELD",
            newValue: to,
          },
        });
      });
    try {
      await onceMoreOnDeadlock(settle);
    } catch (error) {
      // SCRUM-161 AC6: the database refuses to confirm a hold over recorded
      // unavailability (the occupancy trigger, ADR 0010).
      if (violatesExclusion(error, "booking_overlaps_unavailability")) {
        return err(HOLD_OVER_UNAVAILABILITY);
      }
      if (!violatesCheck(error, "booking_hold_expired")) throw error;
      return err(alreadySettled("EXPIRED", booking.holdExpiresAt));
    }

    revalidatePath("/bookings");
    revalidatePath("/venues/availability");
    revalidatePath("/events");
    return ok({ status: to });
  } catch (error) {
    if (error instanceof PermissionError || error instanceof DecisionError) {
      return err(error.message);
    }
    throw error;
  }
}

/**
 * SCRUM-142 AC4 — the event's assigned Coordinator withdraws one of its
 * pending venue requests while the event is being planned.
 *
 * - It becomes Cancelled, conditional on still being Pending (ADR 0006), so
 *   it leaves the Venue Staff queue and the event can request another venue;
 *   the event's other bookings are untouched (SCRUM-162). Withdrawing it again
 *   changes nothing (AC8).
 * - A live hold is released instead (SCRUM-163). An Approved booking isn't
 *   withdrawn here (AC6), and once the event is Confirmed changes go through a
 *   change request (AC5).
 * - Venue Staff are told (AC7), and a safety check that approved or is
 *   reviewing the arrangements goes out of date (AC9).
 */
export async function withdrawBookingRequest(
  input: unknown,
): Promise<ActionResult<{ status: BookingStatus }>> {
  const session = await auth();
  const user = session?.user;

  try {
    requirePermission(user, "booking:withdraw");

    const parsed = bookingWithdrawalSchema.safeParse(input);
    if (!parsed.success) return err(REQUEST_NOT_FOUND);
    const { bookingId } = parsed.data;

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        status: true,
        holdExpiresAt: true,
        venue: { select: { name: true } },
        event: {
          select: {
            id: true,
            name: true,
            organiserId: true,
            coordinatorId: true,
            status: true,
          },
        },
      },
    });
    if (
      !booking ||
      !can(user!, "booking:withdraw", { kind: "event", ...booking.event })
    ) {
      return err(REQUEST_NOT_FOUND);
    }
    const notPlanning = withdrawalRefusal(booking.event.status);
    if (notPlanning) return err(notPlanning);
    const now = new Date();
    const current = bookingStatusAt(booking, now);
    if (current === "HELD") {
      return settleHold({ bookingId }, "CANCELLED", withdrawalRefusal);
    }
    if (current === "APPROVED") {
      return err(
        "An approved booking isn't withdrawn here. It is cancelled by resolving its flag, or by cancelling or rejecting the event.",
      );
    }
    if (current !== "PENDING") {
      return err(notWithdrawable(current, booking.holdExpiresAt));
    }

    const withdrawn = await prisma.$transaction(async (tx) => {
      const refusal = withdrawalRefusal(
        await lockedEventStatus(tx, booking.event.id),
      );
      if (refusal) return refusal;

      const updated = await tx.booking.updateMany({
        where: { id: bookingId, status: "PENDING" },
        data: { status: "CANCELLED" },
      });
      if (updated.count !== 1) {
        const latest = await tx.booking.findUniqueOrThrow({
          where: { id: bookingId },
          select: { status: true, holdExpiresAt: true },
        });
        return notWithdrawable(
          bookingStatusAt(latest, now),
          latest.holdExpiresAt,
        );
      }
      await tx.auditLog.create({
        data: {
          entityType: "Booking",
          entityId: bookingId,
          action: "WITHDRAWN",
          actorId: user!.id,
          fieldName: "status",
          oldValue: "PENDING",
          newValue: "CANCELLED",
          summary: "Withdrawn by the Coordinator (SCRUM-142)",
        },
      });
      await notifyRole(tx, "VENUE_STAFF", booking.event, {
        type: "BOOKING_REQUEST_WITHDRAWN",
        title: "A venue request was withdrawn",
        message: `The Coordinator withdrew the request for ${booking.venue.name} for "${booking.event.name}".`,
        link: "/bookings",
      });
      await outdateSafetyChecks(tx, booking.event.id, now);
      return null;
    });
    if (withdrawn) return err(withdrawn);

    revalidatePath("/bookings");
    revalidatePath("/events");
    return ok({ status: "CANCELLED" });
  } catch (error) {
    if (error instanceof PermissionError) return err(error.message);
    throw error;
  }
}

const REQUEST_NOT_FOUND = "Venue request not found.";

/**
 * The event's status, read under its row lock. confirmEvent takes the same
 * lock, so a Confirm that committed while this waited is seen (SCRUM-142 AC5).
 */
async function lockedEventStatus(
  tx: Prisma.TransactionClient,
  eventId: string,
): Promise<EventStatus> {
  await tx.$queryRaw`SELECT "id" FROM "Event" WHERE "id" = ${eventId} FOR UPDATE`;
  const { status } = await tx.event.findUniqueOrThrow({
    where: { id: eventId },
    select: { status: true },
  });
  return status;
}

/** SCRUM-142 AC5 — why an event in this status can't withdraw a venue request. */
function withdrawalRefusal(status: EventStatus): string | null {
  if (status === "CONFIRMED") {
    return "This event is confirmed, so its arrangements change through a change request.";
  }
  return BOOKABLE_EVENT_STATUSES.includes(status)
    ? null
    : "This event isn't being planned, so its venue requests can't be withdrawn.";
}

function notWithdrawable(
  status: BookingStatus,
  holdExpiresAt: Date | null,
): string {
  if (status === "CANCELLED") return "This request has already been withdrawn.";
  if (status === "EXPIRED") return holdExpired(holdExpiresAt);
  // Held while this was being withdrawn: AC4 releases a hold instead.
  if (status === "HELD") {
    return "Venue Staff have just held this request. Release the hold instead.";
  }
  return `This request has already been ${status.toLowerCase()}, so it can't be withdrawn.`;
}

const HOLD_NOT_FOUND = "Venue hold not found.";

const HOLD_OVER_UNAVAILABILITY =
  "This hold can't be confirmed: the venue is now unavailable for part of its period. Release it and arrange another venue.";

function holdExpired(holdExpiresAt: Date | null): string {
  return `This hold expired at ${formatDateTime(holdExpiresAt!)}, so the venue is free for other requests. Make a new request if you still need it.`;
}

function alreadyDecided(
  status: BookingStatus,
  holdExpiresAt: Date | null,
): string {
  if (status === "HELD") {
    return "This request is held for its Coordinator to confirm. You can still reject it until the hold expires.";
  }
  if (status === "EXPIRED") return holdExpired(holdExpiresAt);
  return `This request has already been ${status.toLowerCase()}; the original decision stands.`;
}

function alreadySettled(
  status: BookingStatus,
  holdExpiresAt: Date | null,
): string {
  switch (status) {
    case "EXPIRED":
      return holdExpired(holdExpiresAt);
    case "APPROVED":
      return "This hold has already been confirmed.";
    case "CANCELLED":
      return "This hold has already been released.";
    case "REJECTED":
      return "Venue Staff rejected this hold.";
    default:
      return "This request isn't held.";
  }
}
