import type {
  BookingStatus,
  Prisma,
  PrismaClient,
  VenueUnavailabilityReason,
} from "@prisma/client";

import { formatDateTime } from "@/lib/datetime";
import { overlaps, type Period } from "@/lib/period";
import { flagArrangements } from "@/lib/reconsideration";
import { UNAVAILABILITY_REASON_LABEL } from "@/lib/schemas/unavailability";
import { MAX_SETUP_TURNAROUND_MINUTES } from "@/lib/schemas/venue";
import { notifyRole } from "@/lib/staff-notifications";
import { occupiedPeriod, type SetupTurnaround } from "@/lib/venue-availability";

/**
 * SCRUM-160 — the bookings a longer setup or turnaround time makes clash.
 * A booking keeps the minutes it was held or approved with (SCRUM-159 AC8),
 * so a change to the venue's times moves nothing; instead the bookings that
 * would clash under the new times are shown before the change is saved
 * (AC1) and flagged Needs Reconsideration once it is (AC2, SCRUM-26).
 *
 * Test cases: docs/testing/SCRUM-160.md. Why it works this way:
 * docs/adr/0021-flagging-setup-and-turnaround-clashes.md.
 */

type Db = PrismaClient | Prisma.TransactionClient;

/** AC2 — the reason every flag raised here carries. */
export const TIMES_CHANGED_REASON = "Setup or turnaround time changed";

const REACH_MS = MAX_SETUP_TURNAROUND_MINUTES * 60 * 1000;

/** AC6 — only a longer setup or turnaround time can create a clash. */
export function lengthens(before: SetupTurnaround, after: SetupTurnaround): boolean {
  return (
    after.setupMinutes > before.setupMinutes ||
    after.turnaroundMinutes > before.turnaroundMinutes
  );
}

/** What a flagged booking clashes with. */
export type ClashWith = Period &
  (
    | { kind: "booking"; id: string; eventName: string }
    | { kind: "unavailability"; id: string; reason: VenueUnavailabilityReason }
  );

/** One booking the change makes clash, and what with (AC1). */
export interface TimeClash {
  booking: Period & {
    id: string;
    status: BookingStatus;
    eventId: string;
    eventName: string;
    coordinatorId: string | null;
    coordinatorName: string | null;
    needsReconsideration: boolean;
    reconsiderationReason: string | null;
  };
  with: ClashWith;
}

/** How a clash is recorded in the booking's history (AC7). */
export function clashKey(clash: ClashWith): string {
  return `${clash.kind}:${clash.id}`;
}

/** "another booking from …" or "unavailability (maintenance) from …". */
export function describeClash(clash: ClashWith, withEvent = false): string {
  const when = `from ${formatDateTime(clash.startAt)} to ${formatDateTime(clash.endAt)}`;
  if (clash.kind === "unavailability") {
    return `unavailability (${UNAVAILABILITY_REASON_LABEL[clash.reason].toLowerCase()}) ${when}`;
  }
  return withEvent
    ? `"${clash.eventName}"'s booking ${when}`
    : `another booking ${when}`;
}

/**
 * AC1, AC2 — every Approved or live Held booking at `venueId` that hasn't
 * started and whose occupied period under `times` overlaps another booking's
 * occupied period or recorded unavailability. Bookings that haven't started
 * are measured with the new times; one already under way keeps its own.
 *
 * Of two clashing bookings, the one approved or held later is the one listed
 * (AC2): when it took the venue is the earlier of its hold and its approval.
 * If that one has already started, the other is listed instead, since only a
 * booking that hasn't started can still be dealt with.
 */
export async function findTimeClashes(
  db: Db,
  venueId: string,
  times: SetupTurnaround,
  now: Date = new Date(),
): Promise<TimeClash[]> {
  const since = new Date(now.getTime() - REACH_MS);
  const [bookings, unavailability] = await Promise.all([
    db.booking.findMany({
      where: {
        venueId,
        OR: [{ status: "APPROVED" }, { status: "HELD", holdExpiresAt: { gt: now } }],
        endAt: { gt: since },
      },
      select: {
        id: true,
        status: true,
        startAt: true,
        endAt: true,
        setupMinutes: true,
        turnaroundMinutes: true,
        heldAt: true,
        decidedAt: true,
        createdAt: true,
        needsReconsideration: true,
        reconsiderationReason: true,
        event: {
          select: {
            id: true,
            name: true,
            coordinatorId: true,
            coordinator: { select: { name: true } },
          },
        },
      },
      orderBy: { startAt: "asc" },
    }),
    db.venueUnavailability.findMany({
      where: { venueId, endAt: { gt: since } },
      select: { id: true, startAt: true, endAt: true, reason: true },
    }),
  ]);

  const upcoming = (b: (typeof bookings)[number]) => b.startAt > now;
  const occupied = (b: (typeof bookings)[number]) =>
    occupiedPeriod(b, upcoming(b) ? times : b);
  // A seeded booking may have neither time; its request is the best guess.
  const tookVenueAt = (b: (typeof bookings)[number]) => {
    const taken = [b.heldAt, b.decidedAt].filter((at): at is Date => at !== null);
    return taken.length > 0
      ? Math.min(...taken.map((at) => at.getTime()))
      : b.createdAt.getTime();
  };
  const clashing = (b: (typeof bookings)[number]): TimeClash["booking"] => ({
    id: b.id,
    status: b.status,
    startAt: b.startAt,
    endAt: b.endAt,
    eventId: b.event.id,
    eventName: b.event.name,
    coordinatorId: b.event.coordinatorId,
    coordinatorName: b.event.coordinator?.name ?? null,
    needsReconsideration: b.needsReconsideration,
    reconsiderationReason: b.reconsiderationReason,
  });

  const clashes: TimeClash[] = [];
  bookings.forEach((a, i) => {
    for (const b of bookings.slice(i + 1)) {
      if (!(upcoming(a) || upcoming(b)) || !overlaps(occupied(a), occupied(b))) {
        continue;
      }
      const [earlier, later] =
        tookVenueAt(a) < tookVenueAt(b) ||
        (tookVenueAt(a) === tookVenueAt(b) && a.id < b.id)
          ? [a, b]
          : [b, a];
      const [flagged, other] = upcoming(later) ? [later, earlier] : [earlier, later];
      clashes.push({
        booking: clashing(flagged),
        with: {
          kind: "booking",
          id: other.id,
          startAt: other.startAt,
          endAt: other.endAt,
          eventName: other.event.name,
        },
      });
    }
    if (!upcoming(a)) return;
    for (const u of unavailability) {
      if (overlaps(occupied(a), u)) {
        clashes.push({ booking: clashing(a), with: { kind: "unavailability", ...u } });
      }
    }
  });
  return clashes.sort(
    (x, y) =>
      x.booking.startAt.getTime() - y.booking.startAt.getTime() ||
      x.with.startAt.getTime() - y.with.startAt.getTime(),
  );
}

/**
 * AC1, AC7 — the clashes a change would still act on: not one already
 * recorded for its booking, even after its flag was resolved, and not one on
 * a booking waiting for another reason, which keeps that reason (SCRUM-26).
 * Venue Staff are warned of exactly these, and `flagTimeClashes` flags them.
 */
export async function pendingTimeClashes(
  db: Db,
  clashes: TimeClash[],
): Promise<TimeClash[]> {
  if (clashes.length === 0) return [];
  const recorded = new Set(
    (
      await db.auditLog.findMany({
        where: {
          entityType: "Booking",
          entityId: { in: [...new Set(clashes.map((c) => c.booking.id))] },
          action: "RECONSIDERATION_FLAGGED",
          fieldName: "clashesWith",
        },
        select: { entityId: true, newValue: true },
      })
    ).map((r) => `${r.entityId} ${r.newValue}`),
  );
  return clashes.filter(
    (c) =>
      !recorded.has(`${c.booking.id} ${clashKey(c.with)}`) &&
      (!c.booking.needsReconsideration ||
        c.booking.reconsiderationReason === TIMES_CHANGED_REASON),
  );
}

/**
 * AC2, AC3, AC7 — flag the bookings in `clashes`, in the caller's
 * transaction, after the venue's new times are saved.
 *
 * Each clash is recorded in its booking's history, so a booking is never
 * flagged twice for the same clash, even after its Coordinator resolves the
 * flag (AC7). A booking already waiting for this same reason gains the new
 * clash without a second flag or notice. One waiting for another reason
 * keeps that reason (SCRUM-26), and this clash isn't recorded, so it can be
 * flagged for it later. A newly flagged booking's Coordinator and all Venue
 * Staff are notified (AC3, SCRUM-124 AC8). Returns how many bookings were
 * newly flagged.
 */
export async function flagTimeClashes(
  tx: Prisma.TransactionClient,
  venue: { name: string },
  clashes: TimeClash[],
  actorId: string,
  now: Date = new Date(),
): Promise<number> {
  const pending = await pendingTimeClashes(tx, clashes);
  const bookingIds = [...new Set(pending.map((c) => c.booking.id))];

  let flagged = 0;
  for (const bookingId of bookingIds) {
    const fresh = pending.filter((c) => c.booking.id === bookingId);
    const { booking } = fresh[0];
    if (!booking.needsReconsideration) {
      const { bookings } = await flagArrangements(
        tx,
        { bookingIds: [bookingId], reservationIds: [] },
        TIMES_CHANGED_REASON,
        now,
      );
      if (bookings === 0) continue;
      flagged += 1;
      await notifyFlagged(tx, venue, booking, fresh);
    }
    await tx.auditLog.createMany({
      data: fresh.map((c) => ({
        entityType: "Booking",
        entityId: bookingId,
        action: "RECONSIDERATION_FLAGGED",
        actorId,
        fieldName: "clashesWith",
        newValue: clashKey(c.with),
        summary: `${TIMES_CHANGED_REASON}: it now clashes with ${describeClash(c.with, true)} (SCRUM-160).`,
        // Matched against the flag's own time by listTimeClashFlags.
        createdAt: now,
      })),
    });
  }
  return flagged;
}

/** One booking flagged for this reason, as Venue Staff see it (AC5). */
export interface TimeClashFlag extends Period {
  bookingId: string;
  status: BookingStatus;
  venueName: string;
  eventName: string;
  coordinatorName: string | null;
  flaggedAt: Date | null;
  /** e.g. `"Robotics Expo"'s booking from … to …` */
  clashesWith: string[];
}

/**
 * AC5 — the bookings currently flagged because a setup or turnaround time
 * changed, soonest first, each with what it clashes with. A resolved flag
 * (SCRUM-26) is no longer listed (AC6), and only the clashes recorded since
 * the current flag was raised are shown.
 */
export async function listTimeClashFlags(db: Db): Promise<TimeClashFlag[]> {
  const flagged = await db.booking.findMany({
    where: { needsReconsideration: true, reconsiderationReason: TIMES_CHANGED_REASON },
    select: {
      id: true,
      status: true,
      startAt: true,
      endAt: true,
      reconsiderationFlaggedAt: true,
      venue: { select: { name: true } },
      event: { select: { name: true, coordinator: { select: { name: true } } } },
    },
    orderBy: { startAt: "asc" },
  });
  if (flagged.length === 0) return [];

  const records = await db.auditLog.findMany({
    where: {
      entityType: "Booking",
      entityId: { in: flagged.map((b) => b.id) },
      action: "RECONSIDERATION_FLAGGED",
      fieldName: "clashesWith",
    },
    select: { entityId: true, newValue: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  const ids = (kind: ClashWith["kind"]) =>
    records.flatMap((r) => {
      const [k, id] = String(r.newValue).split(":");
      return k === kind ? [id] : [];
    });
  const [bookings, unavailability] = await Promise.all([
    db.booking.findMany({
      where: { id: { in: ids("booking") } },
      select: { id: true, startAt: true, endAt: true, event: { select: { name: true } } },
    }),
    db.venueUnavailability.findMany({
      where: { id: { in: ids("unavailability") } },
      select: { id: true, startAt: true, endAt: true, reason: true },
    }),
  ]);
  const clashes = new Map<string, ClashWith>([
    ...bookings.map((b): [string, ClashWith] => [
      `booking:${b.id}`,
      { kind: "booking", id: b.id, startAt: b.startAt, endAt: b.endAt, eventName: b.event.name },
    ]),
    ...unavailability.map((u): [string, ClashWith] => [
      `unavailability:${u.id}`,
      { kind: "unavailability", ...u },
    ]),
  ]);

  return flagged.map((b) => ({
    bookingId: b.id,
    status: b.status,
    startAt: b.startAt,
    endAt: b.endAt,
    venueName: b.venue.name,
    eventName: b.event.name,
    coordinatorName: b.event.coordinator?.name ?? null,
    flaggedAt: b.reconsiderationFlaggedAt,
    clashesWith: records
      .filter(
        (r) =>
          r.entityId === b.id &&
          b.reconsiderationFlaggedAt !== null &&
          r.createdAt >= b.reconsiderationFlaggedAt,
      )
      .map((r) => {
        const clash = clashes.get(String(r.newValue));
        return clash ? describeClash(clash, true) : "unavailability that has since been removed";
      }),
  }));
}

async function notifyFlagged(
  tx: Prisma.TransactionClient,
  venue: { name: string },
  booking: TimeClash["booking"],
  clashes: TimeClash[],
) {
  const period = `${formatDateTime(booking.startAt)} to ${formatDateTime(booking.endAt)}`;
  const title = "Booking needs reconsideration";
  // Coordinators never see another organisation's event (SCRUM-68).
  const forCoordinator = clashes.map((c) => describeClash(c.with)).join("; ");
  const forStaff = clashes.map((c) => describeClash(c.with, true)).join("; ");
  if (booking.coordinatorId) {
    await tx.notification.create({
      data: {
        userId: booking.coordinatorId,
        type: "ARRANGEMENT_FLAGGED",
        title,
        message: `"${booking.eventName}": ${venue.name}, ${period}. ${TIMES_CHANGED_REASON}, so it now clashes with ${forCoordinator}. Decide whether it still stands.`,
        link: "/events",
        eventId: booking.eventId,
      },
    });
  }
  await notifyRole(tx, "VENUE_STAFF", { id: booking.eventId }, {
    type: "ARRANGEMENT_FLAGGED",
    title,
    message: `"${booking.eventName}": ${venue.name}, ${period}. ${TIMES_CHANGED_REASON}, so it now clashes with ${forStaff}.`,
    link: "/bookings",
  });
}
