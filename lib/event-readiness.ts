import type { BookingStatus, Prisma, PrismaClient } from "@prisma/client";

import { FLAGGABLE_BOOKING } from "@/lib/reconsideration";

/**
 * SCRUM-110 — an event's readiness checklist: the essential arrangements that
 * must be complete before the Coordinator can confirm it (SCRUM-81). It only
 * reads, so SCRUM-81 can call it inside the transaction that confirms.
 *
 * Test cases: docs/testing/SCRUM-110.md. Why each rule is the way it is:
 * docs/adr/0011-event-readiness-checklist.md.
 */
export interface ChecklistItem {
  name: "Venue booking" | "Equipment";
  complete: boolean;
  /** "Approved", "Pending", "Rejected", "Not requested", "Reserved", "Not fully reserved: Projector" */
  state: string;
  /** Internal detail, such as why Venue Staff rejected the booking. Hidden from the Organiser. */
  reason: string | null;
}

export interface ReadinessChecklist {
  /** Every item complete and the event in Planning: what enables SCRUM-81's Confirm. */
  ready: boolean;
  items: ChecklistItem[];
}

// Requests still being worked on or granted. A rejected request is replaced by
// the Coordinator's next one, and a cancelled one is no longer wanted.
const LIVE_REQUEST = ["PENDING_REVIEW", "IN_REVIEW", "APPROVED"];

export async function getReadinessChecklist(
  db: Prisma.TransactionClient | PrismaClient,
  eventId: string,
): Promise<ReadinessChecklist | null> {
  // Statuses are filtered below rather than in the query, so every rule is
  // exercised by the unit tests; an event holds only a handful of these rows.
  const event = await db.event.findUnique({
    where: { id: eventId },
    select: {
      status: true,
      startAt: true,
      endAt: true,
      bookings: {
        select: {
          status: true,
          decisionReason: true,
          createdAt: true,
          startAt: true,
          endAt: true,
          needsReconsideration: true,
          reconsiderationReason: true,
        },
      },
      equipmentRequests: {
        select: {
          status: true,
          createdAt: true,
          lines: {
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
    },
  });
  if (!event) return null;

  const items = [venueItem(event)];
  const equipment = equipmentItem(event);
  if (equipment) items.push(equipment);

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
  status: string;
  decisionReason: string | null;
  createdAt: Date;
  startAt: Date;
  endAt: Date;
  needsReconsideration: boolean;
  reconsiderationReason: string | null;
};

/** SCRUM-26 AC12: the flag's own state, with its reason for the Coordinator. */
const NEEDS_RECONSIDERATION = "Needs reconsideration";

function venueItem(event: Period & { bookings: BookingRow[] }): ChecklistItem {
  const newestFirst = [...event.bookings].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  );
  const item = { name: "Venue booking" as const, reason: null };
  const approved = newestFirst.filter((b) => b.status === "APPROVED");

  // SCRUM-26 AC12: a flagged booking keeps the event from being confirmed
  // until its Coordinator resolves the flag, however it otherwise stands.
  const flagged = newestFirst.find(
    (b) => b.needsReconsideration && FLAGGABLE_BOOKING.includes(b.status as BookingStatus),
  );
  if (flagged) {
    return {
      ...item,
      complete: false,
      state: NEEDS_RECONSIDERATION,
      reason: flagged.reconsiderationReason,
    };
  }

  // After a rejection, or after the event moves, the Coordinator books again,
  // so the most advanced booking describes where the venue stands.
  if (approved.some((b) => coversEvent(b, event))) {
    return { ...item, complete: true, state: "Approved" };
  }
  if (newestFirst.some((b) => b.status === "PENDING")) {
    return { ...item, complete: false, state: "Pending" };
  }
  if (approved.length > 0) {
    return { ...item, complete: false, state: "Approved for a different time" };
  }
  const rejected = newestFirst.find((b) => b.status === "REJECTED");
  if (rejected) {
    return {
      ...item,
      complete: false,
      state: "Rejected",
      reason: rejected.decisionReason,
    };
  }
  return { ...item, complete: false, state: "Not requested" };
}

type EventRow = {
  startAt: Date | null;
  endAt: Date | null;
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

function equipmentItem(event: EventRow): ChecklistItem | null {
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
  const live = oldestFirst.filter((r) => LIVE_REQUEST.includes(r.status));

  if (live.length === 0) {
    // With only a rejected request, the equipment is still wanted but not
    // arranged; with none, or only cancelled ones, it is not needed at all.
    if (!oldestFirst.some((r) => r.status === "REJECTED")) return null;
    return {
      name: "Equipment",
      complete: false,
      state: "Rejected",
      reason: null,
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
  const complete = short.length === 0;

  return {
    name: "Equipment",
    complete,
    state: complete ? "Reserved" : `Not fully reserved: ${short.join(", ")}`,
    reason: null,
  };
}

/** SCRUM-110 AC 6: the Organiser sees item names and states, not internal reasons. */
export function withoutInternalReasons(
  checklist: ReadinessChecklist,
): ReadinessChecklist {
  return {
    ...checklist,
    items: checklist.items.map((item) => ({ ...item, reason: null })),
  };
}

export interface ConfirmedArrangements {
  venue: { name: string; location: string } | null;
  startAt: Date | null;
  endAt: Date | null;
  timezone: string | null;
  /** e.g. "Projector × 2", one per item reserved for the whole event. */
  equipment: string[];
}

/**
 * SCRUM-81 AC 6 — what a Confirmed event has secured, for its Organiser: the
 * venue approved for the event's time, the date and time, and the equipment
 * reserved for the whole event. The same whole-event rule as the checklist.
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

  // Newest first, as in the checklist's venue item: if two approved bookings
  // cover the event, the later one is the Coordinator's current choice.
  const booking = [...event.bookings]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .find((b) => b.status === "APPROVED" && coversEvent(b, event));
  const reserved = new Map<string, number>();
  for (const r of event.reservations) {
    if (r.status !== "CONFIRMED" || !coversEvent(r, event)) continue;
    reserved.set(
      r.equipment.type,
      (reserved.get(r.equipment.type) ?? 0) + r.quantity,
    );
  }

  return {
    venue: booking ? booking.venue : null,
    startAt: event.startAt,
    endAt: event.endAt,
    timezone: event.timezone,
    equipment: [...reserved].map(([type, quantity]) => `${type} × ${quantity}`),
  };
}
