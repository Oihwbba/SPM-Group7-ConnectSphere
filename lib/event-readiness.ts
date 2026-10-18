import type { BookingStatus, Prisma, PrismaClient } from "@prisma/client";

import { bookingStatusAt } from "@/lib/booking-holds";
import { LIVE_LINE } from "@/lib/equipment/requests";
import { formatDateTime } from "@/lib/datetime";
import { FLAGGABLE_BOOKING } from "@/lib/reconsideration";
import { safetyCheckItem } from "@/lib/safety-checks";

/**
 * SCRUM-110 — an event's readiness checklist: the essential arrangements that
 * must be complete before the Coordinator can confirm it (SCRUM-81). It only
 * reads, so SCRUM-81 can call it inside the transaction that confirms.
 *
 * Test cases: docs/testing/SCRUM-110.md. Why each rule is the way it is:
 * docs/adr/0011-event-readiness-checklist.md.
 */
export interface ChecklistItem {
  name: "Venue booking" | "Equipment" | "Safety check";
  complete: boolean;
  /** "Approved", "Held until … – confirm to secure", "Pending", "Rejected", "Hold expired", "Not requested", "Reserved", "Not fully reserved: Projector", "Awaiting Technical Support review", "Not decided", "No equipment needed" */
  state: string;
  /** Internal detail, such as why Venue Staff rejected the booking. Hidden from the Organiser. */
  reason: string | null;
  /** SCRUM-162 AC8: the Venue booking item lists each live booking. */
  bookings?: VenueBookingLine[];
  /** SCRUM-170 AC4: no live equipment request, so No equipment needed can be recorded. */
  noEquipmentOffered?: boolean;
}

/** SCRUM-162 AC8 — one Pending, Held or Approved booking of the event. */
export interface VenueBookingLine {
  id: string;
  venueName: string;
  attendance: number | null;
  /** "Approved", "Approved for a different time", "Held until … – confirm to secure", "Pending", "Needs reconsideration" */
  state: string;
  /** Approved for the event's whole period and not flagged. */
  complete: boolean;
  /** The flag's reason. Hidden from the Organiser. */
  reason: string | null;
  /** SCRUM-163 AC3: a live hold, which the Coordinator can confirm or release. */
  held: boolean;
  /** SCRUM-163 AC3, AC7: Venue Staff approved the hold, so it can be confirmed. */
  holdApproved: boolean;
  /** SCRUM-142 AC4: a pending request, which the Coordinator can withdraw. */
  pending: boolean;
}

export interface ReadinessChecklist {
  /** Every item complete and the event in Planning: what enables SCRUM-81's Confirm. */
  ready: boolean;
  items: ChecklistItem[];
}

// Requests still being worked on or granted. A rejected request is replaced by
// the Coordinator's next one, and a cancelled one is no longer wanted.
export const LIVE_REQUEST = ["PENDING_REVIEW", "IN_REVIEW", "APPROVED"] as const;

export async function getReadinessChecklist(
  db: Prisma.TransactionClient | PrismaClient,
  eventId: string,
  now = new Date(),
): Promise<ReadinessChecklist | null> {
  // Statuses are filtered below rather than in the query, so every rule is
  // exercised by the unit tests; an event holds only a handful of these rows.
  const event = await db.event.findUnique({
    where: { id: eventId },
    select: {
      status: true,
      startAt: true,
      endAt: true,
      noEquipmentNeededAt: true,
      noEquipmentNeededBy: { select: { name: true } },
      bookings: {
        select: {
          id: true,
          status: true,
          holdExpiresAt: true,
          holdApprovedAt: true,
          decisionReason: true,
          createdAt: true,
          startAt: true,
          endAt: true,
          needsReconsideration: true,
          reconsiderationReason: true,
          requestedAttendance: true,
          venue: { select: { name: true } },
        },
      },
      equipmentRequests: {
        select: {
          status: true,
          createdAt: true,
          lines: {
            where: LIVE_LINE,
            select: {
              equipmentId: true,
              quantity: true,
              equipment: { select: { type: true } },
            },
          },
        },
      },
      reservations: {
        select: {
          equipmentId: true,
          quantity: true,
          status: true,
          startAt: true,
          endAt: true,
          needsReconsideration: true,
          reconsiderationReason: true,
          equipment: { select: { type: true } },
        },
      },
      // SCRUM-166 AC9: the latest check decides the Safety check item.
      safetyChecks: {
        select: { status: true, note: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });
  if (!event) return null;

  // SCRUM-170 AC4: Equipment is always listed (superseding SCRUM-110 AC3).
  const items = [
    venueItem(event, now),
    equipmentItem(event),
    safetyCheckItem(event.safetyChecks[0]),
  ];

  return {
    ready: event.status === "PLANNING" && items.every((item) => item.complete),
    items,
  };
}

type Period = { startAt: Date | null; endAt: Date | null };

/**
 * Does a booking or reservation hold for the whole event? Bookings and
 * reservations carry their own times (ADR 0003), so after the event moves an
 * old one no longer covers it. An event without dates is covered by nothing.
 */
function coversEvent(
  held: { startAt: Date; endAt: Date },
  { startAt, endAt }: Period,
): boolean {
  return (
    startAt !== null &&
    endAt !== null &&
    held.startAt <= startAt &&
    held.endAt >= endAt
  );
}

type BookingRow = {
  id: string;
  status: BookingStatus;
  holdExpiresAt: Date | null;
  holdApprovedAt: Date | null;
  decisionReason: string | null;
  createdAt: Date;
  startAt: Date;
  endAt: Date;
  needsReconsideration: boolean;
  reconsiderationReason: string | null;
  requestedAttendance: number | null;
  venue: { name: string };
};

/** SCRUM-26 AC12: the flag's own state, with its reason for the Coordinator. */
const NEEDS_RECONSIDERATION = "Needs reconsideration";

/**
 * SCRUM-162 AC8 — one live booking as the checklist lists it. A flag
 * outranks the status (SCRUM-26 AC12); a hold isn't an approval, so the
 * Coordinator confirms it (SCRUM-163 AC6); and an approval counts only for
 * the event's whole period, since bookings keep their own times (ADR 0003).
 */
function bookingLine(booking: BookingRow, event: Period): VenueBookingLine {
  const line = {
    id: booking.id,
    venueName: booking.venue.name,
    attendance: booking.requestedAttendance,
    complete: false,
    reason: null,
    held: booking.status === "HELD",
    holdApproved: booking.status === "HELD" && booking.holdApprovedAt !== null,
    pending: booking.status === "PENDING",
  };
  if (booking.needsReconsideration) {
    return {
      ...line,
      state: NEEDS_RECONSIDERATION,
      reason: booking.reconsiderationReason,
    };
  }
  if (booking.status === "HELD") {
    return {
      ...line,
      state: `Held until ${formatDateTime(booking.holdExpiresAt!)} – confirm to secure`,
    };
  }
  if (booking.status === "PENDING") return { ...line, state: "Pending" };
  return coversEvent(booking, event)
    ? { ...line, state: "Approved", complete: true }
    : { ...line, state: "Approved for a different time" };
}

function venueItem(
  event: Period & { bookings: BookingRow[] },
  now: Date,
): ChecklistItem {
  // SCRUM-163 AC4: a hold past its expiry is Expired, even before anything
  // has marked it so.
  const newestFirst = [...event.bookings]
    .map((b) => ({ ...b, status: bookingStatusAt(b, now) }))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const item = { name: "Venue booking" as const, reason: null };

  // SCRUM-162 AC8: every Pending, Held or Approved booking is listed, oldest
  // first, and the item is complete only when at least one is approved and
  // every one is an approval for the event's whole period with no flag. A
  // flagged hold that has expired has released its venue, so it isn't listed.
  const bookings = newestFirst
    .filter((b) => FLAGGABLE_BOOKING.includes(b.status))
    .reverse()
    .map((b) => bookingLine(b, event));
  if (bookings.length > 0) {
    const flagged = bookings.find((b) => b.state === NEEDS_RECONSIDERATION);
    const held = bookings.find((b) => b.held);
    const complete = bookings.every((b) => b.complete);
    // The item names what stands in the way first: a flag (SCRUM-26 AC12),
    // then a hold to confirm, then a request still pending.
    const blocker =
      flagged ??
      held ??
      bookings.find((b) => b.pending) ??
      bookings.find((b) => !b.complete);
    return {
      ...item,
      complete,
      state: complete ? "Approved" : blocker!.state,
      reason: flagged?.reason ?? null,
      bookings,
    };
  }
  // SCRUM-163 AC6: an expired hold counts like a rejection, and SCRUM-26 AC9:
  // so does a cancelled booking; the newest of them describes the venue. A
  // cancellation leaves nothing requested, so an older rejection's reason no
  // longer applies.
  const ended = newestFirst.find(
    (b) => b.status === "REJECTED" || b.status === "EXPIRED" || b.status === "CANCELLED",
  );
  if (ended?.status === "CANCELLED") {
    return { ...item, complete: false, state: "Not requested" };
  }
  if (ended?.status === "EXPIRED") {
    return { ...item, complete: false, state: "Hold expired" };
  }
  if (ended) {
    return {
      ...item,
      complete: false,
      state: "Rejected",
      reason: ended.decisionReason,
    };
  }
  return { ...item, complete: false, state: "Not requested" };
}

type EventRow = {
  startAt: Date | null;
  endAt: Date | null;
  noEquipmentNeededAt: Date | null;
  noEquipmentNeededBy: { name: string } | null;
  equipmentRequests: {
    status: string;
    createdAt: Date;
    lines: {
      equipmentId: string;
      quantity: number;
      equipment: { type: string };
    }[];
  }[];
  reservations: {
    equipmentId: string;
    quantity: number;
    status: string;
    startAt: Date;
    endAt: Date;
    needsReconsideration: boolean;
    reconsiderationReason: string | null;
    equipment: { type: string };
  }[];
};

function equipmentItem(event: EventRow): ChecklistItem {
  // SCRUM-26 AC12: as for the venue, a flagged reservation leaves the item
  // incomplete until its Coordinator resolves the flag.
  const flagged = event.reservations.filter(
    (r) => r.needsReconsideration && r.status === "CONFIRMED",
  );
  if (flagged.length > 0) {
    const types = [...new Set(flagged.map((r) => r.equipment.type))];
    return {
      name: "Equipment",
      complete: false,
      state: `${NEEDS_RECONSIDERATION}: ${types.join(", ")}`,
      reason: flagged[0].reconsiderationReason,
    };
  }

  const oldestFirst = [...event.equipmentRequests].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
  );
  const live = oldestFirst.filter((r) =>
    (LIVE_REQUEST as readonly string[]).includes(r.status),
  );

  if (live.length === 0) {
    // SCRUM-170 AC4: with no live request the Coordinator decides. Recording
    // No equipment needed completes the item; it keeps who and when. Creating
    // a request clears the decision, so it never sits beside a live request.
    // Who recorded it is always set with it (event_no_equipment_decision_complete).
    if (event.noEquipmentNeededAt) {
      return {
        name: "Equipment",
        complete: true,
        state: "No equipment needed",
        reason: `Recorded by ${event.noEquipmentNeededBy!.name}, ${formatDateTime(event.noEquipmentNeededAt)}`,
      };
    }
    // With only a rejected request, the equipment is still wanted but not
    // arranged; with none, or only cancelled ones, nothing is decided yet.
    return {
      name: "Equipment",
      complete: false,
      state: oldestFirst.some((r) => r.status === "REJECTED")
        ? "Rejected"
        : "Not decided",
      reason: null,
      noEquipmentOffered: true,
    };
  }

  const requested = new Map<string, { type: string; quantity: number }>();
  for (const line of live.flatMap((r) => r.lines)) {
    requested.set(line.equipmentId, {
      type: line.equipment.type,
      quantity:
        (requested.get(line.equipmentId)?.quantity ?? 0) + line.quantity,
    });
  }

  // "Reserved in full for the event's period": a reservation counts only if
  // it is confirmed and spans the whole event, so a partial-day hold can't
  // make the item look complete. AC 4 names what is short, without counts.
  const short = [...requested]
    .filter(
      ([equipmentId, { quantity }]) =>
        event.reservations
          .filter(
            (r) =>
              r.equipmentId === equipmentId &&
              r.status === "CONFIRMED" &&
              coversEvent(r, event),
          )
          .reduce((sum, r) => sum + r.quantity, 0) < quantity,
    )
    .map(([, { type }]) => type);
  if (short.length > 0) {
    return {
      name: "Equipment",
      complete: false,
      state: `Not fully reserved: ${short.join(", ")}`,
      reason: null,
    };
  }

  // SCRUM-142 AC10: a request back with Technical Support after a change
  // keeps its other lines reserved, but Confirm waits for the re-check.
  const awaitingReview = live.some((r) => r.status !== "APPROVED");
  return {
    name: "Equipment",
    complete: !awaitingReview,
    state: awaitingReview ? "Awaiting Technical Support review" : "Reserved",
    reason: null,
  };
}

/** SCRUM-110 AC 6: the Organiser sees item names and states, not internal reasons. */
export function withoutInternalReasons(
  checklist: ReadinessChecklist,
): ReadinessChecklist {
  return {
    ...checklist,
    items: checklist.items.map((item) => ({
      ...item,
      reason: null,
      ...(item.bookings && {
        bookings: item.bookings.map((booking) => ({ ...booking, reason: null })),
      }),
    })),
  };
}

export interface ConfirmedArrangements {
  /** SCRUM-162 AC7: every venue approved for the event's time, oldest first. */
  venues: { name: string; location: string }[];
  startAt: Date | null;
  endAt: Date | null;
  timezone: string | null;
  /** e.g. "Projector × 2", one per item reserved for the whole event. */
  equipment: string[];
}

/**
 * SCRUM-81 AC 6 — what a Confirmed event has secured, for its Organiser: the
 * venues approved for the event's time (every one, SCRUM-162 AC7), the date
 * and time, and the equipment reserved for the whole event. The same
 * whole-event rule as the checklist.
 */
export async function getConfirmedArrangements(
  db: Prisma.TransactionClient | PrismaClient,
  eventId: string,
): Promise<ConfirmedArrangements | null> {
  const event = await db.event.findUnique({
    where: { id: eventId },
    select: {
      startAt: true,
      endAt: true,
      timezone: true,
      bookings: {
        select: {
          status: true,
          createdAt: true,
          startAt: true,
          endAt: true,
          venue: { select: { name: true, location: true } },
        },
      },
      reservations: {
        select: {
          status: true,
          quantity: true,
          startAt: true,
          endAt: true,
          equipment: { select: { type: true } },
        },
      },
    },
  });
  if (!event) return null;

  const venues = [...event.bookings]
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .filter((b) => b.status === "APPROVED" && coversEvent(b, event))
    .map((b) => b.venue);
  const reserved = new Map<string, number>();
  for (const r of event.reservations) {
    if (r.status !== "CONFIRMED" || !coversEvent(r, event)) continue;
    reserved.set(
      r.equipment.type,
      (reserved.get(r.equipment.type) ?? 0) + r.quantity,
    );
  }

  return {
    venues,
    startAt: event.startAt,
    endAt: event.endAt,
    timezone: event.timezone,
    equipment: [...reserved].map(([type, quantity]) => `${type} × ${quantity}`),
  };
}

export interface EventVenueBooking {
  id: string;
  venueName: string;
  attendance: number | null;
  status: BookingStatus;
  startAt: Date;
  endAt: Date;
}

/**
 * SCRUM-162 AC7 — every booking of the event, oldest first, with its venue,
 * attendance and status. A hold past its expiry reads as Expired (SCRUM-163
 * AC4). No decision reasons, so the Organiser may see it too.
 */
export async function getEventVenueBookings(
  db: Prisma.TransactionClient | PrismaClient,
  eventId: string,
  now = new Date(),
): Promise<EventVenueBooking[]> {
  const bookings = await db.booking.findMany({
    where: { eventId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      status: true,
      holdExpiresAt: true,
      requestedAttendance: true,
      startAt: true,
      endAt: true,
      venue: { select: { name: true } },
    },
  });
  return bookings.map((b) => ({
    id: b.id,
    venueName: b.venue.name,
    attendance: b.requestedAttendance,
    status: bookingStatusAt(b, now),
    startAt: b.startAt,
    endAt: b.endAt,
  }));
}
