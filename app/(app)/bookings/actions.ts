"use server";

import { revalidatePath } from "next/cache";
import type { BookingStatus, EventStatus } from "@prisma/client";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { can, requirePermission, PermissionError } from "@/lib/auth/can";
import { err, ok, type ActionResult } from "@/lib/action-result";
import {
  bookingRequestSchema,
  INVALID_PERIOD_MESSAGE,
} from "@/lib/schemas/booking";
import { overlapping } from "@/lib/period";
import { describeBlocker, findVenueBlockers } from "@/lib/venue-availability";

/** An event must have been approved before a venue is requested for it. */
const BOOKABLE_EVENT_STATUSES: EventStatus[] = ["APPROVED", "PLANNING"];

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
 * The PostgreSQL error code and message behind a failed query. Through the
 * `pg` driver adapter, Prisma surfaces a database refusal as a
 * DriverAdapterError whose `cause` carries the original code and message.
 */
function postgresError(error: unknown) {
  const cause = (error as { cause?: unknown } | null)?.cause as
    | { originalCode?: string; originalMessage?: string }
    | undefined;
  return { code: cause?.originalCode, message: cause?.originalMessage ?? "" };
}

/** The write was refused by the exclusion constraint named `constraint`. */
function violatesExclusion(error: unknown, constraint: string): boolean {
  const pg = postgresError(error);
  return pg.code === "23P01" && pg.message.includes(`"${constraint}"`);
}

/**
 * Runs `attempt`, and runs it once more if PostgreSQL aborted it as a
 * deadlock (SQLSTATE 40P01).
 *
 * Why this exists: when two overlapping rows are written at the same instant,
 * each can be left waiting for the other's uncommitted row in the exclusion
 * constraint. Postgres breaks that cycle by aborting one of them as a deadlock
 * rather than reporting a constraint violation. The survivor carries on. On
 * the retry the survivor's row is (or is about to be) committed, so the retry
 * gets the ordinary answer — the existing request, or a conflict.
 */
async function onceMoreOnDeadlock<T>(attempt: () => Promise<T>): Promise<T> {
  try {
    return await attempt();
  } catch (error) {
    if (postgresError(error).code !== "40P01") throw error;
    return attempt();
  }
}

/**
 * SCRUM-50 — an Event Coordinator asks for a venue for one of their events.
 *
 * - An invalid period is refused before anything else (AC5).
 * - Resubmitting over an overlapping pending request for the same event and
 *   venue creates nothing and returns the existing one (AC6).
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
      const invalidPeriod = fieldErrors.endAt?.includes(INVALID_PERIOD_MESSAGE);
      return err(
        invalidPeriod
          ? INVALID_PERIOD_MESSAGE
          : "Please fix the highlighted fields.",
        fieldErrors,
      );
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
      select: { name: true },
    });
    if (!venue) return err("Venue not found.");

    const existingPending = () =>
      prisma.booking.findFirst({
        where: {
          eventId: data.eventId,
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
