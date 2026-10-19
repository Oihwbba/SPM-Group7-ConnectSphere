import type { BookingStatus, Prisma, PrismaClient } from "@prisma/client";

import { liveHoldWhere } from "@/lib/booking-holds";
import { formatDateTime } from "@/lib/datetime";
import { LIVE_LINE } from "@/lib/equipment/requests";
import { notifyRole } from "@/lib/staff-notifications";
import { BOOKING_STATUS_LABEL } from "@/lib/status-labels";
import {
  describeBlocker,
  findVenueBlockers,
  occupiedPeriod,
} from "@/lib/venue-availability";

/**
 * SCRUM-26 — Needs Reconsideration: a flag on a venue booking or an equipment
 * reservation whose event changed under it. The flag never changes the
 * arrangement's status (AC2), so a flagged booking or reservation keeps
 * blocking its venue or stock (AC4) until the assigned Coordinator decides
 * Still stands or Cancel arrangement (AC7).
 *
 * Test cases: docs/testing/SCRUM-26.md. Why it works this way:
 * docs/adr/0017-needs-reconsideration-flags.md.
 */

type Db = PrismaClient | Prisma.TransactionClient;

/** AC2: the bookings a flag can sit on. Reservations: only Confirmed ones. */
export const FLAGGABLE_BOOKING: BookingStatus[] = ["PENDING", "HELD", "APPROVED"];

/**
 * AC2 — the bookings a flag can sit on at `now`: Pending, Approved, and Held
 * until the hold expires. A hold past its expiry has released the venue
 * (SCRUM-163 AC4), even before anything marks it Expired, so it is neither
 * flagged nor waits for a resolution, as the readiness checklist treats it.
 */
export function liveBookingWhere(now: Date): Prisma.BookingWhereInput {
  return { OR: [{ status: { in: ["PENDING", "APPROVED"] } }, liveHoldWhere(now)] };
}

/** AC7 — a flagged booking still waiting for its Coordinator. */
export function flaggedLiveBookingWhere(now: Date): Prisma.BookingWhereInput {
  return { needsReconsideration: true, ...liveBookingWhere(now) };
}

/**
 * AC1, SCRUM-25 AC3 — the event fields whose change flags its arrangements:
 * date and time, expected attendance, the venue requirement and the
 * equipment requirement.
 */
export const IMPACTFUL_EVENT_FIELDS = [
  "startAt",
  "endAt",
  "expectedAttendance",
  "venueRequirements",
  "requiredFacilities",
  "equipmentRequirements",
  "equipmentTypes",
] as const;

type ImpactfulField = (typeof IMPACTFUL_EVENT_FIELDS)[number];
type EventFields = Partial<
  Record<ImpactfulField, Date | number | string | string[] | null>
>;

function sameValue(
  a: Date | number | string | string[] | null | undefined,
  b: Date | number | string | string[] | null | undefined,
): boolean {
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (Array.isArray(a) && Array.isArray(b)) {
    return [...a].sort().join("\n") === [...b].sort().join("\n");
  }
  return (a ?? null) === (b ?? null);
}

/**
 * AC1 — which impactful fields an edit actually changes. Only the fields the
 * edit sets are compared, and a value set to what it already was is not a
 * change, so it raises no warning.
 */
export function impactfulChanges(
  before: EventFields,
  edit: EventFields,
): ImpactfulField[] {
  return IMPACTFUL_EVENT_FIELDS.filter(
    (field) => field in edit && !sameValue(before[field], edit[field]),
  );
}

/** One flagged, or flaggable, arrangement as the Coordinator sees it. */
export interface Arrangement {
  kind: "booking" | "reservation";
  id: string;
  /** "Exhibition Hall (Approved)" or "Projector × 2" */
  label: string;
}

/**
 * AC1 — what a confirmed impactful edit will flag: every Pending, Approved
 * or live Held booking and every Confirmed reservation of the event. Empty
 * when nothing is booked or reserved, so the edit needs no warning.
 */
export async function flaggableArrangements(
  db: Db,
  eventId: string,
  now: Date = new Date(),
): Promise<Arrangement[]> {
  const [bookings, reservations] = await Promise.all([
    db.booking.findMany({
      where: { eventId, ...liveBookingWhere(now) },
      select: { id: true, status: true, venue: { select: { name: true } } },
      orderBy: { createdAt: "asc" },
    }),
    db.reservation.findMany({
      where: { eventId, status: "CONFIRMED" },
      select: { id: true, quantity: true, equipment: { select: { type: true } } },
      orderBy: { createdAt: "asc" },
    }),
  ]);
  return [...bookings.map(bookingArrangement), ...reservations.map(reservationArrangement)];
}

export function bookingArrangement(b: {
  id: string;
  status: BookingStatus;
  venue: { name: string };
}): Arrangement {
  return {
    kind: "booking",
    id: b.id,
    label: `${b.venue.name} (${BOOKING_STATUS_LABEL[b.status]})`,
  };
}

export function reservationArrangement(r: {
  id: string;
  quantity: number;
  equipment: { type: string };
}): Arrangement {
  return {
    kind: "reservation",
    id: r.id,
    label: `${r.equipment.type} × ${r.quantity}`,
  };
}

/** Whose arrangements to flag: all of one event's, or the ones named. */
export type FlagTarget =
  | { eventId: string }
  | { bookingIds: string[]; reservationIds: string[] };

/**
 * AC2, AC3 — raise the flag. Every flag source (an edit, an approved change
 * request, a venue change, a longer setup or turnaround, unavailability, an
 * equipment problem, a safety check outcome) calls this inside its own
 * transaction, with a reason the Coordinator will read.
 *
 * Only live arrangements are flagged: Pending, Held or Approved bookings and
 * Confirmed reservations. The status is left alone (AC2), and so are the
 * times, so an arrangement keeps its original period after the event moves
 * (AC6). An arrangement already flagged keeps its first reason; it is waiting
 * for the Coordinator either way, and Still stands re-checks everything.
 *
 * SCRUM-124 AC8 — the people responsible are told in the same transaction
 * (`notifyFlagged`). `actorId` is whoever raised the flag: an event's
 * Coordinator who flagged their own arrangements isn't told what they just
 * did.
 */
export async function flagArrangements(
  tx: Prisma.TransactionClient,
  target: FlagTarget,
  reason: string,
  now: Date = new Date(),
  actorId?: string,
): Promise<{ bookings: number; reservations: number }> {
  const [bookingScope, reservationScope] =
    "eventId" in target
      ? [{ eventId: target.eventId }, { eventId: target.eventId }]
      : [{ id: { in: target.bookingIds } }, { id: { in: target.reservationIds } }];
  const flag = {
    needsReconsideration: true,
    reconsiderationFlaggedAt: now,
    reconsiderationReason: reason,
    reconsiderationResolvedAt: null,
    reconsiderationResolvedById: null,
  };

  const bookings = await tx.booking.updateManyAndReturn({
    where: {
      ...bookingScope,
      ...liveBookingWhere(now),
      needsReconsideration: false,
    },
    data: flag,
    select: { id: true, eventId: true, status: true, venue: { select: { name: true } } },
  });
  const reservations = await tx.reservation.updateManyAndReturn({
    where: { ...reservationScope, status: "CONFIRMED", needsReconsideration: false },
    data: flag,
    select: {
      id: true,
      eventId: true,
      quantity: true,
      equipment: { select: { type: true } },
    },
  });
  await notifyFlagged(
    tx,
    [
      ...bookings.map((b) => ({ eventId: b.eventId, arrangement: bookingArrangement(b) })),
      ...reservations.map((r) => ({
        eventId: r.eventId,
        arrangement: reservationArrangement(r),
      })),
    ],
    reason,
    actorId,
  );
  return { bookings: bookings.length, reservations: reservations.length };
}

/** "A", "A and B", "A, B and C". */
function listed(labels: string[]): string {
  return labels.length === 1
    ? labels[0]
    : `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
}

/**
 * SCRUM-124 AC8, AC12–AC14 — one notice per person for each event whose
 * arrangements were just flagged: its assigned Coordinator, with every
 * arrangement and the reason; every Venue Staff member, with its bookings;
 * every Technical Support member, with its reservations. Only arrangements
 * this call flagged are named, so flagging again tells nobody twice.
 */
async function notifyFlagged(
  tx: Prisma.TransactionClient,
  flagged: { eventId: string; arrangement: Arrangement }[],
  reason: string,
  actorId: string | undefined,
) {
  if (flagged.length === 0) return;
  const events = await tx.event.findMany({
    where: { id: { in: [...new Set(flagged.map((f) => f.eventId))] } },
    select: { id: true, name: true, coordinatorId: true },
  });
  for (const event of events) {
    const mine = flagged.filter((f) => f.eventId === event.id).map((f) => f.arrangement);
    // Staff are also told that it now waits for the Coordinator.
    const sentence = (arrangements: Arrangement[], staff: boolean) => {
      const one = arrangements.length === 1;
      const waiting = staff
        ? `, and ${one ? "waits" : "wait"} for the event's Coordinator to decide`
        : "";
      return `${listed(arrangements.map((a) => a.label))} for "${event.name}" ${
        one ? "needs" : "need"
      } reconsideration${waiting}. ${reason}`;
    };

    if (event.coordinatorId && event.coordinatorId !== actorId) {
      await tx.notification.create({
        data: {
          userId: event.coordinatorId,
          eventId: event.id,
          type: "ARRANGEMENT_FLAGGED",
          title: "Arrangements flagged for reconsideration",
          message: sentence(mine, false),
        },
      });
    }
    const bookings = mine.filter((a) => a.kind === "booking");
    if (bookings.length > 0) {
      await notifyRole(tx, "VENUE_STAFF", event, {
        type: "ARRANGEMENT_FLAGGED",
        title: "Bookings flagged for reconsideration",
        message: sentence(bookings, true),
        link: "/bookings",
      });
    }
    const reservations = mine.filter((a) => a.kind === "reservation");
    if (reservations.length > 0) {
      await notifyRole(tx, "TECH_SUPPORT", event, {
        type: "ARRANGEMENT_FLAGGED",
        title: "Reservations flagged for reconsideration",
        message: sentence(reservations, true),
        link: "/equipment",
      });
    }
  }
}

/** The event as Still stands judges it (AC8). */
export interface EventPeriod {
  startAt: Date | null;
  endAt: Date | null;
  expectedAttendance: number | null;
}

function covers(held: { startAt: Date; endAt: Date }, event: EventPeriod) {
  return (
    event.startAt !== null &&
    event.endAt !== null &&
    held.startAt <= event.startAt &&
    held.endAt >= event.endAt
  );
}

function notCovering(event: EventPeriod): string {
  return event.startAt && event.endAt
    ? `It no longer covers the event's whole period, ${formatDateTime(event.startAt)} to ${formatDateTime(event.endAt)}.`
    : "It no longer covers the event's whole period.";
}

export interface FlaggedBooking {
  id: string;
  status: BookingStatus;
  startAt: Date;
  endAt: Date;
  setupMinutes: number;
  turnaroundMinutes: number;
  requestedAttendance: number | null;
  venueId: string;
  venue: {
    name: string;
    isActive: boolean;
    capacity: number;
    setupMinutes: number;
    turnaroundMinutes: number;
  };
}

/**
 * AC8 — why a flagged booking can't be kept, or null when it still stands:
 * it covers the event's whole period, its venue is active, its attendance is
 * within both the event's expected attendance and the venue's capacity, and
 * its occupied period overlaps no other Approved or Held booking and no
 * recorded unavailability. A Held or Approved booking occupies the venue with
 * the minutes it was given; a Pending one would take the venue's current
 * minutes when approved (SCRUM-159 AC8).
 */
export async function bookingStillStandsRefusal(
  db: Db,
  booking: FlaggedBooking,
  event: EventPeriod,
): Promise<string | null> {
  const { venue } = booking;
  if (!covers(booking, event)) return notCovering(event);
  if (!venue.isActive) return `${venue.name} has been retired.`;

  const attendance = booking.requestedAttendance ?? event.expectedAttendance;
  if (
    attendance !== null &&
    event.expectedAttendance !== null &&
    attendance > event.expectedAttendance
  ) {
    return `It is for ${attendance} attendees, more than the event's expected ${event.expectedAttendance}.`;
  }
  if (attendance !== null && attendance > venue.capacity) {
    return `It is for ${attendance} attendees, more than ${venue.name}'s capacity of ${venue.capacity}.`;
  }

  const minutes = booking.status === "PENDING" ? venue : booking;
  const others = (
    await findVenueBlockers(db, booking.venueId, occupiedPeriod(booking, minutes))
  ).filter((b) => !(b.kind === "booking" && b.id === booking.id));
  if (others.length > 0) {
    return `${venue.name} is ${others.map(describeBlocker).join("; ")}.`;
  }
  return null;
}

export interface FlaggedReservation {
  id: string;
  eventId: string;
  equipmentId: string;
  quantity: number;
  startAt: Date;
  endAt: Date;
  equipment: { type: string };
}

/**
 * AC8 — why a flagged reservation can't be kept, or null when it still
 * stands: it covers the event's whole period, and the event's Confirmed
 * reservations of that equipment covering the event, this one included, add
 * up to at least what its live equipment requests ask for. That is the rule
 * the readiness checklist uses for "Reserved" (SCRUM-110).
 */
export async function reservationStillStandsRefusal(
  db: Db,
  reservation: FlaggedReservation,
  event: EventPeriod,
): Promise<string | null> {
  if (!covers(reservation, event)) return notCovering(event);

  const [lines, reservations] = await Promise.all([
    db.equipmentRequestLine.findMany({
      where: {
        equipmentId: reservation.equipmentId,
        // A line removed from a live request (SCRUM-142) is no longer needed.
        ...LIVE_LINE,
        request: {
          eventId: reservation.eventId,
          status: { in: ["PENDING_REVIEW", "IN_REVIEW", "APPROVED"] },
        },
      },
      select: { quantity: true },
    }),
    db.reservation.findMany({
      where: {
        eventId: reservation.eventId,
        equipmentId: reservation.equipmentId,
        status: "CONFIRMED",
      },
      select: { quantity: true, startAt: true, endAt: true },
    }),
  ]);
  const needed = lines.reduce((sum, l) => sum + l.quantity, 0);
  const reserved = reservations
    .filter((r) => covers(r, event))
    .reduce((sum, r) => sum + r.quantity, 0);
  if (reserved < needed) {
    return `Only ${reserved} ${reservation.equipment.type} reserved for the event's period; its requests need ${needed}.`;
  }
  return null;
}
