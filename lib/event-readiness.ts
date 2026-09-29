import type { Prisma, PrismaClient } from "@prisma/client";

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
  /** "Approved", "Pending", "Rejected", "Not requested", "Reserved", "Not fully reserved" */
  state: string;
  /** Internal detail, such as why Venue Staff rejected the booking. Hidden from the Organiser. */
  reason: string | null;
  /** One line per requested item, e.g. "Projector 3/5 reserved". */
  lines: string[];
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
        select: { status: true, decisionReason: true, createdAt: true },
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
        },
      },
    },
  });
  if (!event) return null;

  const items = [venueItem(event.bookings)];
  const equipment = equipmentItem(event);
  if (equipment) items.push(equipment);

  return {
    ready: event.status === "PLANNING" && items.every((item) => item.complete),
    items,
  };
}

type BookingRow = {
  status: string;
  decisionReason: string | null;
  createdAt: Date;
};

function venueItem(bookings: BookingRow[]): ChecklistItem {
  const newestFirst = [...bookings].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  );
  const item = { name: "Venue booking" as const, reason: null, lines: [] };

  // After a rejection the Coordinator books again, so the most advanced
  // booking describes where the venue stands.
  if (newestFirst.some((b) => b.status === "APPROVED")) {
    return { ...item, complete: true, state: "Approved" };
  }
  if (newestFirst.some((b) => b.status === "PENDING")) {
    return { ...item, complete: false, state: "Pending" };
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
  }[];
};

function equipmentItem(event: EventRow): ChecklistItem | null {
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
      lines: [],
    };
  }

  const requested = new Map<string, { type: string; quantity: number }>();
  for (const line of live.flatMap((r) => r.lines)) {
    const current = requested.get(line.equipmentId);
    requested.set(line.equipmentId, {
      type: line.equipment.type,
      quantity: (current?.quantity ?? 0) + line.quantity,
    });
  }

  const { startAt, endAt } = event;
  const lines: string[] = [];
  let complete = true;
  for (const [equipmentId, { type, quantity }] of requested) {
    // "Reserved in full for the event's period": a reservation counts only if
    // it is confirmed and spans the whole event, so a partial-day hold can't
    // make the item look complete.
    const reserved = event.reservations
      .filter(
        (r) =>
          r.equipmentId === equipmentId &&
          r.status === "CONFIRMED" &&
          startAt !== null &&
          endAt !== null &&
          r.startAt <= startAt &&
          r.endAt >= endAt,
      )
      .reduce((sum, r) => sum + r.quantity, 0);
    if (reserved < quantity) complete = false;
    lines.push(`${type} ${reserved}/${quantity} reserved`);
  }

  return {
    name: "Equipment",
    complete,
    state: complete ? "Reserved" : "Not fully reserved",
    reason: null,
    lines,
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
