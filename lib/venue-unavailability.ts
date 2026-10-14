import {
  Prisma,
  type PrismaClient,
  type VenueUnavailabilityReason,
} from "@prisma/client";

import { liveHoldWhere } from "@/lib/booking-holds";
import { formatDateTime } from "@/lib/datetime";
import { overlaps, type Period } from "@/lib/period";
import { UNAVAILABILITY_REASON_LABEL } from "@/lib/schemas/unavailability";
import { notifyRole } from "@/lib/staff-notifications";

/**
 * SCRUM-161 — venue unavailability recorded over existing bookings. The
 * period is saved, and the bookings it overlaps are flagged Needs
 * Reconsideration (SCRUM-26) rather than refused, cancelled or changed, and
 * their Coordinators are told alternative arrangements are required.
 *
 * Test cases: docs/testing/SCRUM-161.md.
 */

type Db = PrismaClient | Prisma.TransactionClient;

/** SCRUM-159 AC1: a venue's setup or turnaround is at most 1,440 minutes. */
const MAX_REACH_MS = 1440 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

const STATUS_LABEL = {
  PENDING: "Pending",
  HELD: "Held",
  APPROVED: "Approved",
} as const;

export type AffectedStatus = keyof typeof STATUS_LABEL;

/** A Pending, Held or Approved booking the unavailability overlaps (AC3). */
export interface AffectedBooking extends Period {
  id: string;
  status: AffectedStatus;
  requestedById: string;
  needsReconsideration: boolean;
  event: {
    id: string;
    name: string;
    coordinatorId: string | null;
    coordinator: { name: string } | null;
  };
}

/** The unavailability being recorded, as the flag and notices describe it. */
export interface Unavailability extends Period {
  reason: VenueUnavailabilityReason;
  note: string | null;
}

/**
 * The period a booking occupies its venue (SCRUM-159 AC2): its own setup and
 * turnaround minutes once Held or Approved, the venue's current ones while
 * Pending, as it would take them when approved (SCRUM-159 AC8).
 */
function occupiedPeriod(booking: {
  status: string;
  startAt: Date;
  endAt: Date;
  setupMinutes: number;
  turnaroundMinutes: number;
  venue: { setupMinutes: number; turnaroundMinutes: number };
}): Period {
  const minutes = booking.status === "PENDING" ? booking.venue : booking;
  return {
    startAt: new Date(
      booking.startAt.getTime() - minutes.setupMinutes * MINUTE_MS,
    ),
    endAt: new Date(
      booking.endAt.getTime() + minutes.turnaroundMinutes * MINUTE_MS,
    ),
  };
}

/**
 * AC2, AC3 — every Pending, live Held or Approved booking at `venueId` whose
 * occupied period overlaps `period`, earliest first. One whose occupied
 * period only touches it is not affected (lib/period.ts). A hold whose expiry
 * has passed reserves nothing (SCRUM-163 AC4), so it isn't either.
 */
export async function findAffectedBookings(
  db: Db,
  venueId: string,
  period: Period,
  now: Date,
): Promise<AffectedBooking[]> {
  const rows = await db.booking.findMany({
    where: {
      venueId,
      OR: [{ status: { in: ["PENDING", "APPROVED"] } }, liveHoldWhere(now)],
      // Widened by the longest setup or turnaround, then narrowed below.
      startAt: { lt: new Date(period.endAt.getTime() + MAX_REACH_MS) },
      endAt: { gt: new Date(period.startAt.getTime() - MAX_REACH_MS) },
    },
    select: {
      id: true,
      status: true,
      startAt: true,
      endAt: true,
      setupMinutes: true,
      turnaroundMinutes: true,
      requestedById: true,
      needsReconsideration: true,
      venue: { select: { setupMinutes: true, turnaroundMinutes: true } },
      event: {
        select: {
          id: true,
          name: true,
          coordinatorId: true,
          coordinator: { select: { name: true } },
        },
      },
    },
    orderBy: [{ startAt: "asc" }, { id: "asc" }],
  });

  return rows
    .filter((b) => overlaps(occupiedPeriod(b), period))
    .map((b) => ({
      id: b.id,
      status: b.status as AffectedStatus,
      startAt: b.startAt,
      endAt: b.endAt,
      requestedById: b.requestedById,
      needsReconsideration: b.needsReconsideration,
      event: b.event,
    }));
}

/**
 * AC7 — lock the affected bookings' events, then the bookings, before the
 * caller locks the venue. That is the order a hold, a withdrawal and an
 * approval already take them in (event, then booking, then the venue in the
 * occupancy trigger, ADR 0010), so recording unavailability can't deadlock
 * with any of them. An approval that committed while this waited is read
 * afresh once the venue is locked.
 */
export async function lockAffectedBookings(
  tx: Prisma.TransactionClient,
  bookings: AffectedBooking[],
): Promise<void> {
  if (bookings.length === 0) return;
  const eventIds = [...new Set(bookings.map((b) => b.event.id))].sort();
  const bookingIds = bookings.map((b) => b.id).sort();
  await tx.$queryRaw`SELECT "id" FROM "Event" WHERE "id" IN (${Prisma.join(eventIds)}) ORDER BY "id" FOR KEY SHARE`;
  await tx.$queryRaw`SELECT "id" FROM "Booking" WHERE "id" IN (${Prisma.join(bookingIds)}) ORDER BY "id" FOR UPDATE`;
}

/** e.g. "Maintenance from 10 Jan 2036, 1:00 pm SGT to 10 Jan 2036, 5:00 pm SGT" */
function reasonAndPeriod(unavailability: Unavailability): string {
  return `${UNAVAILABILITY_REASON_LABEL[unavailability.reason]} from ${formatDateTime(unavailability.startAt)} to ${formatDateTime(unavailability.endAt)}`;
}

/** AC3 — the reason a flag raised by this unavailability carries. */
export function unavailabilityFlagReason(
  venueName: string,
  unavailability: Unavailability,
): string {
  const note = unavailability.note ? ` Note: ${unavailability.note}` : "";
  return `${venueName} is unavailable: ${reasonAndPeriod(unavailability)}.${note}`;
}

/** AC2 — how Venue Staff are shown each affected booking before they confirm. */
export function affectedBookingView(booking: AffectedBooking) {
  return {
    bookingId: booking.id,
    eventName: booking.event.name,
    coordinatorName: booking.event.coordinator?.name ?? null,
    status: STATUS_LABEL[booking.status],
    startAt: booking.startAt,
    endAt: booking.endAt,
  };
}

/**
 * AC3, AC4 — flag the affected bookings and tell each one's Coordinator, in
 * the caller's transaction, once the unavailability is saved. Returns how
 * many bookings were newly flagged.
 *
 * Only the flag is written: the status, the times and the event are left
 * alone (AC3). A booking already flagged for another reason keeps that first
 * reason, as every flag source does (SCRUM-26); its Coordinator is still told
 * the venue is now unavailable. All Venue Staff are told of each newly
 * flagged booking (SCRUM-124 AC8).
 */
export async function flagForUnavailability(
  tx: Prisma.TransactionClient,
  venueName: string,
  unavailability: Unavailability,
  affected: AffectedBooking[],
  actorId: string,
  now: Date,
): Promise<number> {
  const reason = unavailabilityFlagReason(venueName, unavailability);
  const fresh = affected.filter((b) => !b.needsReconsideration);
  if (fresh.length > 0) {
    await tx.booking.updateMany({
      where: {
        id: { in: fresh.map((b) => b.id) },
        needsReconsideration: false,
      },
      data: {
        needsReconsideration: true,
        reconsiderationFlaggedAt: now,
        reconsiderationReason: reason,
        reconsiderationResolvedAt: null,
        reconsiderationResolvedById: null,
      },
    });
    await tx.auditLog.createMany({
      data: fresh.map((b) => ({
        entityType: "Booking",
        entityId: b.id,
        action: "RECONSIDERATION_FLAGGED",
        actorId,
        fieldName: "needsReconsideration",
        oldValue: "false",
        newValue: "true",
        summary: reason,
      })),
    });
  }

  const what = reasonAndPeriod(unavailability);
  await tx.notification.createMany({
    data: affected.map((b) => ({
      // An event being planned always has its Coordinator; the requester is
      // who asked for the booking otherwise, as for a hold (SCRUM-163).
      userId: b.event.coordinatorId ?? b.requestedById,
      type: "ARRANGEMENT_FLAGGED" as const,
      title: "Alternative venue arrangements required",
      message: `"${b.event.name}": ${venueName} is unavailable (${what}), which overlaps your ${STATUS_LABEL[b.status].toLowerCase()} booking there. Alternative arrangements are required: find a replacement venue, then cancel this booking.`,
      link: "/events",
      eventId: b.event.id,
      bookingId: b.id,
    })),
  });
  for (const b of fresh) {
    await notifyRole(tx, "VENUE_STAFF", b.event, {
      type: "ARRANGEMENT_FLAGGED",
      title: "Booking needs reconsideration",
      message: `"${b.event.name}": its ${STATUS_LABEL[b.status].toLowerCase()} booking of ${venueName}, ${formatDateTime(b.startAt)} to ${formatDateTime(b.endAt)}, is flagged because the venue is unavailable (${what}).`,
      link: "/bookings",
    });
  }
  return fresh.length;
}
