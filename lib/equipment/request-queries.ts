import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import { summariseAvailability } from "@/lib/equipment/availability";
import {
  LIVE_LINE,
  OPEN_REQUEST_STATUSES,
  REQUESTABLE_EVENT_STATUSES,
  outstandingLines,
  reservationVersion,
  reviewLine,
  type PoolAvailability,
} from "@/lib/equipment/requests";
import { RESERVABLE_EVENT_STATUSES } from "@/lib/schemas/reservation";
import {
  COMPETING_REQUEST_STATUSES,
  competingLines,
  openRequestLines,
} from "@/lib/equipment/competing";

/**
 * The reads behind the Equipment Requests page (SCRUM-27/28). They take the
 * signed-in user's id from the page, never from the client, which is why they
 * live here and not in a "use server" file: every export of one of those is a
 * public endpoint, and these must not be callable with someone else's id.
 */

/** Must mirror `can()`'s coordinator relationship with an event exactly. */
function coordinatorEventScope(coordinatorId: string) {
  return {
    OR: [
      { coordinatorId },
      { coordinatorId: null, status: { not: "DRAFT" as const } },
    ],
  };
}

// Lines are inserted together and can share a timestamp; the id (a cuid,
// which grows with each insert) keeps them, and history entries, in order.
const IN_ENTRY_ORDER: Prisma.EquipmentRequestLineOrderByWithRelationInput[] = [
  { createdAt: "asc" },
  { id: "asc" },
];

/** SCRUM-28 AC 6 — the chronological history log of a request. */
const HISTORY = {
  select: {
    id: true,
    createdAt: true,
    fromStatus: true,
    toStatus: true,
    note: true,
    actor: { select: { name: true } },
  },
  orderBy: [{ createdAt: "asc" }, { id: "asc" }],
} satisfies Prisma.EquipmentRequest$updatesArgs;

/** SCRUM-27 AC 1 — the events a coordinator can link a request to, with their dates. */
export async function getRequestableEvents(coordinatorId: string) {
  return prisma.event.findMany({
    where: {
      AND: [
        coordinatorEventScope(coordinatorId),
        { status: { in: [...REQUESTABLE_EVENT_STATUSES] } },
      ],
    },
    // SCRUM-170 AC3: the Organiser's equipment answer, shown on the form.
    select: {
      id: true,
      name: true,
      startAt: true,
      endAt: true,
      equipmentRequirements: true,
    },
    orderBy: { startAt: "asc" },
  });
}

/** SCRUM-27 AC 2 — the predefined system list of equipment types. */
export async function getEquipmentCatalogue() {
  return prisma.equipment.findMany({
    where: { isActive: true },
    select: { id: true, type: true, totalQuantity: true, technicalSpecs: true },
    orderBy: { type: "asc" },
  });
}

/** What a Coordinator sees of a request: its event, live lines and history. */
const COORDINATOR_REQUEST_SELECT = {
  id: true,
  status: true,
  notes: true,
  createdAt: true,
  event: {
    select: {
      id: true,
      name: true,
      startAt: true,
      endAt: true,
      // SCRUM-142 AC5: whether its requests can still be changed.
      status: true,
    },
  },
  lines: {
    where: LIVE_LINE,
    select: {
      id: true,
      quantity: true,
      technicalRequirements: true,
      equipment: { select: { id: true, type: true } },
      suggestedAlternative: { select: { id: true, type: true } },
    },
    orderBy: IN_ENTRY_ORDER,
  },
  updates: HISTORY,
} satisfies Prisma.EquipmentRequestSelect;

/**
 * The requests raised for this coordinator's events, newest first, with what
 * Technical Support suggested and every update made (SCRUM-28 AC 4 and 6).
 */
export async function getCoordinatorEquipmentRequests(coordinatorId: string) {
  return prisma.equipmentRequest.findMany({
    where: { event: coordinatorEventScope(coordinatorId) },
    select: COORDINATOR_REQUEST_SELECT,
    orderBy: { createdAt: "desc" },
  });
}

/**
 * SCRUM-209 AC2 — one event's equipment requests, newest first, as the
 * Coordinator's list shows them, for the event page's Equipment section.
 * Callers check who may read the event first.
 */
export async function getEventEquipmentRequests(eventId: string) {
  return prisma.equipmentRequest.findMany({
    where: { eventId },
    select: COORDINATOR_REQUEST_SELECT,
    orderBy: { createdAt: "desc" },
  });
}

export type CoordinatorEquipmentRequest = Awaited<
  ReturnType<typeof getCoordinatorEquipmentRequests>
>[number];

/**
 * SCRUM-28 AC 1 & 4 — what each active equipment type has free for a period.
 * Rows, not sums: the pool is counted, so each type's answer is its busiest
 * instant, the same rule SCRUM-29's availability check uses.
 */
export async function getPoolAvailability(
  startAt: Date,
  endAt: Date,
): Promise<PoolAvailability> {
  const equipment = await prisma.equipment.findMany({
    where: { isActive: true },
    select: { id: true, totalQuantity: true },
  });
  const equipmentIds = equipment.map((item) => item.id);
  const overlapping = { startAt: { lt: endAt }, endAt: { gt: startAt } };
  const select = {
    equipmentId: true,
    startAt: true,
    endAt: true,
    quantity: true,
  } as const;
  const [reservations, unavailability] = await Promise.all([
    prisma.reservation.findMany({
      where: {
        equipmentId: { in: equipmentIds },
        status: "CONFIRMED",
        ...overlapping,
      },
      select,
    }),
    prisma.equipmentUnavailability.findMany({
      where: { equipmentId: { in: equipmentIds }, ...overlapping },
      select,
    }),
  ]);

  const pool: PoolAvailability = {};
  for (const item of equipment) {
    const { available, total } = summariseAvailability({
      total: item.totalQuantity,
      reservations: reservations.filter((row) => row.equipmentId === item.id),
      unavailability: unavailability.filter(
        (row) => row.equipmentId === item.id,
      ),
      startAt,
      endAt,
    });
    pool[item.id] = { available, total };
  }
  return pool;
}

/**
 * SCRUM-28 — every request for Technical Support, oldest first: its event,
 * who asked, each line's equipment details and technical requirements (AC 1),
 * and the history (AC 5). Each line of an open request also says what is free
 * for the event and, when short, what could be suggested instead (AC 3).
 */
export async function getEquipmentRequestQueue() {
  const [requests, catalogue] = await Promise.all([
    prisma.equipmentRequest.findMany({
      select: {
        id: true,
        status: true,
        notes: true,
        createdAt: true,
        decidedAt: true,
        // SCRUM-170 AC3: Technical Support see the Organiser's answer.
        event: {
          select: {
            id: true,
            name: true,
            startAt: true,
            endAt: true,
            equipmentRequirements: true,
          },
        },
        requestedBy: { select: { name: true } },
        lines: {
          where: LIVE_LINE,
          select: {
            id: true,
            quantity: true,
            technicalRequirements: true,
            equipment: {
              select: {
                id: true,
                type: true,
                technicalSpecs: true,
                description: true,
              },
            },
            suggestedAlternative: { select: { id: true, type: true } },
          },
          orderBy: IN_ENTRY_ORDER,
        },
        updates: HISTORY,
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.equipment.findMany({
      where: { isActive: true },
      select: { id: true, type: true },
      orderBy: { type: "asc" },
    }),
  ]);

  // SCRUM-134 AC4: read once, then matched to each line below.
  const openLines = await openRequestLines(prisma);
  return Promise.all(
    requests.map(async (request) => {
      const { startAt, endAt } = request.event;
      const open = (OPEN_REQUEST_STATUSES as readonly string[]).includes(
        request.status,
      );
      const competes =
        (COMPETING_REQUEST_STATUSES as readonly string[]).includes(request.status) &&
        startAt !== null &&
        endAt !== null;
      const pool =
        open && startAt && endAt
          ? await getPoolAvailability(startAt, endAt)
          : null;
      return {
        ...request,
        lines: request.lines.map((line) => ({
          ...line,
          review: pool
            ? reviewLine(
                { equipmentId: line.equipment.id, quantity: line.quantity },
                pool,
                catalogue,
              )
            : null,
          // SCRUM-134 AC4: the other open requests for this type whose
          // events overlap, earliest first, with what is reserved for each.
          competing: competes
            ? competingLines(openLines, request.id, line.equipment.id, {
                startAt: startAt!,
                endAt: endAt!,
              }).map(({ requestId, eventName, submittedAt, quantity, reserved }) => ({
                requestId,
                eventName,
                submittedAt,
                quantity,
                reserved,
              }))
            : [],
        })),
      };
    }),
  );
}

export type QueuedEquipmentRequest = Awaited<
  ReturnType<typeof getEquipmentRequestQueue>
>[number];

/**
 * SCRUM-155 AC 1 — a request Technical Support may reserve from: approved,
 * for an event that can still take a reservation and has not started. Whether
 * anything is left to reserve (AC 6) depends on its lines and the event's
 * reservations, so `outstandingLines` decides that. The listing and the
 * reserve action share both, so what is offered is what is accepted.
 */
export function reservableRequest(now: Date) {
  return {
    status: "APPROVED",
    event: {
      status: { in: RESERVABLE_EVENT_STATUSES },
      startAt: { gt: now },
    },
  } satisfies Prisma.EquipmentRequestWhereInput;
}

/** What `outstandingLines` weighs a request's lines against. */
export const CONFIRMED_HOLDS = {
  where: { status: "CONFIRMED" },
  select: {
    requestId: true,
    equipmentId: true,
    quantity: true,
    startAt: true,
    endAt: true,
  },
} satisfies Prisma.Event$reservationsArgs;

/**
 * SCRUM-155 AC 1, 2 & 6 — approved requests with something still to reserve,
 * each with only what is missing, so choosing one fills in the rest and never
 * reserves a covered line twice. `alreadyReserved` says what is reserved
 * already: some of this request, or only other bookings for its event.
 * Each also carries what Technical Support needs to reserve it without going
 * back to the request: who raised it, its notes and each line's requirements.
 */
export async function getReservableRequests(now = new Date()) {
  const requests = await prisma.equipmentRequest.findMany({
    where: reservableRequest(now),
    select: {
      id: true,
      notes: true,
      updatedAt: true,
      requestedBy: { select: { name: true } },
      event: {
        select: {
          id: true,
          name: true,
          startAt: true,
          endAt: true,
          reservations: CONFIRMED_HOLDS,
        },
      },
      lines: {
        where: LIVE_LINE,
        select: {
          id: true,
          equipmentId: true,
          quantity: true,
          technicalRequirements: true,
          equipment: { select: { id: true, type: true } },
        },
        orderBy: IN_ENTRY_ORDER,
      },
    },
    orderBy: { event: { startAt: "asc" } },
  });

  return requests.flatMap(({ id, notes, updatedAt, requestedBy, event, lines }) => {
    const missing = outstandingLines(id, lines, event, event.reservations);
    if (missing.length === 0) return [];
    const alreadyReserved: "request" | "event" | null =
      missing.length < lines.length ||
      missing.some((line) => line.outstanding < line.quantity)
        ? "request"
        : event.reservations.some((hold) => hold.requestId !== id)
          ? "event"
          : null;
    return [
      {
        id,
        // SCRUM-142, SCRUM-226: the request as the form saw it, so a
        // reservation made after its lines changed, or after someone else
        // reserved part of it, is refused rather than reserving a line twice.
        version: reservationVersion(updatedAt, missing),
        notes,
        requestedBy,
        event: {
          id: event.id,
          name: event.name,
          startAt: event.startAt,
          endAt: event.endAt,
        },
        alreadyReserved,
        lines: missing.map((line) => ({
          id: line.id,
          quantity: line.outstanding,
          technicalRequirements: line.technicalRequirements,
          equipment: line.equipment,
        })),
      },
    ];
  });
}

export type ReservableRequest = Awaited<
  ReturnType<typeof getReservableRequests>
>[number];
