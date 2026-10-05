"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

import { auth } from "@/auth";
import { err, ok, type ActionResult } from "@/lib/action-result";
import { requirePermission, PermissionError } from "@/lib/auth/can";
import { prisma } from "@/lib/db";
import {
  sortSchedule,
  summariseAvailability,
  type ScheduleEntry,
} from "@/lib/equipment/availability";
import { reservableRequest } from "@/lib/equipment/request-queries";
import { formatDateTime } from "@/lib/datetime";
import { fieldErrorsByPath } from "@/lib/schemas/equipment-request";
import {
  allAvailabilitySchema,
  availabilitySchema,
  equipmentScheduleSchema,
  RESERVABLE_EVENT_STATUSES,
  requestReservationSchema,
  reservationSchema,
} from "@/lib/schemas/reservation";

type Availability = { available: number; total: number; committed: number };
type ReserveOutcome = { error: string } | { id: string; available: number };
type RequestReserveOutcome =
  | { error: string; fieldErrors?: Record<string, string[]> }
  | { reserved: number };

/**
 * SCRUM-29 — what is free for the whole period.
 *
 * The rows are read and weighed with `summariseAvailability` rather than
 * summed in SQL: the pool is counted, so the answer is the busiest instant,
 * not the total of everything that touches the window. See
 * lib/equipment/availability.ts for why.
 */
async function availabilityForPeriod(
  db: typeof prisma | Prisma.TransactionClient,
  equipmentId: string,
  startAt: Date,
  endAt: Date,
): Promise<Availability | null> {
  const equipment = await db.equipment.findFirst({
    where: { id: equipmentId, isActive: true },
    select: { totalQuantity: true },
  });
  if (!equipment) return null;

  const overlapping = { startAt: { lt: endAt }, endAt: { gt: startAt } };
  const select = { startAt: true, endAt: true, quantity: true } as const;
  const [reservations, unavailability] = await Promise.all([
    db.reservation.findMany({
      where: { equipmentId, status: "CONFIRMED", ...overlapping },
      select,
    }),
    db.equipmentUnavailability.findMany({
      where: { equipmentId, ...overlapping },
      select,
    }),
  ]);

  return summariseAvailability({
    total: equipment.totalQuantity,
    reservations,
    unavailability,
    startAt,
    endAt,
  });
}

export async function getAllEquipmentAvailability(
  input: unknown,
): Promise<ActionResult<Record<string, Availability>>> {
  const session = await auth();
  try {
    requirePermission(session?.user, "equipment:read");
    const parsed = allAvailabilitySchema.safeParse(input);
    if (!parsed.success)
      return err(
        "Enter a valid reservation period.",
        parsed.error.flatten().fieldErrors,
      );

    const allEquipment = await prisma.equipment.findMany({
      where: { isActive: true },
      select: { id: true, totalQuantity: true },
    });

    const startAt = new Date(parsed.data.startAt);
    const endAt = new Date(parsed.data.endAt);
    const overlapping = { startAt: { lt: endAt }, endAt: { gt: startAt } };
    const equipmentIds = allEquipment.map((item) => item.id);
    const select = {
      equipmentId: true,
      startAt: true,
      endAt: true,
      quantity: true,
    } as const;

    // Rows, not sums: the pool is counted, so each type's answer is its
    // busiest instant. Grouping in SQL cannot express that.
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

    const by = <T extends { equipmentId: string }>(rows: T[], id: string) =>
      rows.filter((row) => row.equipmentId === id);

    const result: Record<string, Availability> = {};
    for (const item of allEquipment) {
      result[item.id] = summariseAvailability({
        total: item.totalQuantity,
        reservations: by(reservations, item.id),
        unavailability: by(unavailability, item.id),
        startAt,
        endAt,
      });
    }

    return ok(result);
  } catch (error) {
    if (error instanceof PermissionError) return err(error.message);
    throw error;
  }
}

export async function getEquipmentAvailability(
  input: unknown,
): Promise<ActionResult<Availability>> {

  const session = await auth();
  try {
    requirePermission(session?.user, "equipment:read");
    const parsed = availabilitySchema.safeParse(input);
    if (!parsed.success)
      return err(
        "Enter a valid reservation period.",
        parsed.error.flatten().fieldErrors,
      );

    const availability = await availabilityForPeriod(
      prisma,
      parsed.data.equipmentId,
      new Date(parsed.data.startAt),
      new Date(parsed.data.endAt),
    );
    return availability
      ? ok(availability)
      : err("Equipment type is unavailable.");
  } catch (error) {
    if (error instanceof PermissionError) return err(error.message);
    throw error;
  }
}

export interface EquipmentSchedule {
  equipmentId: string;
  type: string;
  totalQuantity: number;
  entries: ScheduleEntry[];
  /** True when nothing is committed from `from` onwards (SCRUM-30). */
  fullyAvailable: boolean;
}

/**
 * SCRUM-30 — everything committed on one equipment item from `from` onwards:
 * reservations with the event they serve, and unavailability with its reason
 * and duration, in time order.
 *
 * It reports commitments, not conflicts. Whether a commitment matters depends
 * on the period and quantity being requested, which change as the form is
 * filled in, so the view splits and colours them with `splitByPeriod` and
 * `requestedPeriodTone` against the same availability the reservation uses.
 *
 * An item with nothing committed returns `fullyAvailable`, so the view can say
 * so rather than render an empty table.
 */
export async function getEquipmentSchedule(
  input: unknown,
): Promise<ActionResult<EquipmentSchedule>> {
  const session = await auth();
  try {
    requirePermission(session?.user, "equipment:read");
    const parsed = equipmentScheduleSchema.safeParse(input);
    if (!parsed.success)
      return err(
        "Enter a valid equipment schedule request.",
        parsed.error.flatten().fieldErrors,
      );

    const from = new Date(parsed.data.from);
    if (Number.isNaN(from.getTime())) return err("Enter a valid date.");

    const equipment = await prisma.equipment.findFirst({
      where: { id: parsed.data.equipmentId, isActive: true },
      select: { id: true, type: true, totalQuantity: true },
    });
    if (!equipment) return err("Equipment type is unavailable.");

    // "Current and future": anything still running at `from` counts, so the
    // filter is on the end, not the start.
    const current = { endAt: { gt: from } };
    const [reservations, unavailability] = await Promise.all([
      prisma.reservation.findMany({
        where: { equipmentId: equipment.id, status: "CONFIRMED", ...current },
        select: {
          id: true,
          startAt: true,
          endAt: true,
          quantity: true,
          event: { select: { name: true } },
        },
      }),
      prisma.equipmentUnavailability.findMany({
        where: { equipmentId: equipment.id, ...current },
        select: {
          id: true,
          startAt: true,
          endAt: true,
          quantity: true,
          reason: true,
          note: true,
        },
      }),
    ]);

    const entries: ScheduleEntry[] = [
      ...reservations.map((row) => ({
        id: row.id,
        kind: "reservation" as const,
        startAt: row.startAt,
        endAt: row.endAt,
        quantity: row.quantity,
        eventName: row.event.name,
        reason: null,
        note: null,
      })),
      ...unavailability.map((row) => ({
        id: row.id,
        kind: "unavailability" as const,
        startAt: row.startAt,
        endAt: row.endAt,
        quantity: row.quantity,
        eventName: null,
        reason: row.reason,
        note: row.note,
      })),
    ];

    return ok({
      equipmentId: equipment.id,
      type: equipment.type,
      totalQuantity: equipment.totalQuantity,
      entries: sortSchedule(entries),
      fullyAvailable: entries.length === 0,
    });
  } catch (error) {
    if (error instanceof PermissionError) return err(error.message);
    throw error;
  }
}

export async function createReservation(
  input: unknown,
): Promise<ActionResult<{ id: string; available: number }>> {
  const session = await auth();
  try {
    requirePermission(session?.user, "equipment:reserve");
    const userId = session?.user?.id;
    if (!userId) return err("You do not have permission to do that.");
    const parsed = reservationSchema.safeParse(input);
    if (!parsed.success)
      return err(
        "Please fix the reservation details.",
        parsed.error.flatten().fieldErrors,
      );

    const { eventId, equipmentId, quantity } = parsed.data;
    const startAt = new Date(parsed.data.startAt);
    const endAt = new Date(parsed.data.endAt);

    const result = await prisma.$transaction<ReserveOutcome>(async (tx) => {
      // The event row first, as reserving a whole request does (SCRUM-155):
      // the two take turns on an event instead of deadlocking over its
      // equipment rows.
      await tx.$queryRaw`SELECT "id" FROM "Event" WHERE "id" = ${eventId} FOR UPDATE`;
      const event = await tx.event.findFirst({
        where: { id: eventId, status: { in: RESERVABLE_EVENT_STATUSES } },
        select: { id: true },
      });
      if (!event)
        return {
          error: "Reservations can only be made for an approved event.",
        };

      // A counted pool needs a row lock: without it, two requests could both
      // see the final unit before either creates its reservation.
      const locked = await tx.$queryRaw<{ id: string }[]>`
        SELECT "id" FROM "Equipment" WHERE "id" = ${equipmentId} AND "isActive" = true FOR UPDATE
      `;
      if (!locked.length) return { error: "Equipment type is unavailable." };

      const availability = await availabilityForPeriod(
        tx,
        equipmentId,
        startAt,
        endAt,
      );
      if (!availability) return { error: "Equipment type is unavailable." };
      if (quantity > availability.available) {
        return {
          // SCRUM-31 AC 3: show the shortfall, not just a refusal.
          error: `Only ${availability.available} of ${availability.total} unit(s) are available for this period — ${quantity - availability.available} short.`,
        };
      }

      const reservation = await tx.reservation.create({
        data: {
          eventId,
          equipmentId,
          quantity,
          startAt,
          endAt,
          reservedById: userId,
          status: "CONFIRMED",
        },
        select: { id: true },
      });
      return {
        id: reservation.id,
        available: availability.available - quantity,
      };
    });

    if ("error" in result) return err(result.error);
    revalidatePath("/equipment");
    return ok(result);
  } catch (error) {
    if (error instanceof PermissionError) return err(error.message);
    throw error;
  }
}

/**
 * SCRUM-155 — reserve every row of an approved request together, or none.
 *
 * Locks, always in this order: the event row, so nothing else reserves for
 * the event (the one-type form included) and it cannot be confirmed
 * (SCRUM-81) or rejected (SCRUM-117) between the check below and the insert;
 * the request row, so two people reserving the same request queue up and the
 * second finds it already reserved (AC 5, 6); then the equipment rows in id
 * order, so two requests sharing types always lock them the same way and
 * cannot deadlock, and each pool is counted with nobody else writing to it
 * (AC 5). Event before request is the order rejecting an event takes them.
 */
export async function reserveEquipmentRequest(
  input: unknown,
): Promise<ActionResult<{ reserved: number }>> {
  const session = await auth();
  try {
    requirePermission(session?.user, "equipment:reserve");
    const userId = session?.user?.id;
    if (!userId) return err("You do not have permission to do that.");
    const parsed = requestReservationSchema.safeParse(input);
    if (!parsed.success)
      return err(
        "Please fix the reservation details.",
        fieldErrorsByPath(parsed.error),
      );

    const { requestId, lines } = parsed.data;
    const startAt = new Date(parsed.data.startAt);
    const endAt = new Date(parsed.data.endAt);

    const result = await prisma.$transaction<RequestReserveOutcome>(
      async (tx) => {
        await tx.$queryRaw`
        SELECT e."id" FROM "Event" e
        JOIN "EquipmentRequest" r ON r."eventId" = e."id"
        WHERE r."id" = ${requestId}
        FOR UPDATE OF e
      `;
        await tx.$queryRaw`
        SELECT "id" FROM "EquipmentRequest" WHERE "id" = ${requestId} FOR UPDATE
      `;
        const request = await tx.equipmentRequest.findFirst({
          where: { id: requestId, ...reservableRequest(new Date()) },
          select: {
            eventId: true,
            event: { select: { startAt: true, endAt: true } },
          },
        });
        if (!request)
          return {
            error:
              "This request is not waiting to be reserved: it is already reserved, or no longer approved.",
          };

        // AC 2 — the period may grow (set-up, pack-down) but must cover the
        // event: the SCRUM-110 checklist only counts a reservation that does.
        const { event } = request;
        const uncovered: Record<string, string[]> = {};
        if (event.startAt && startAt > event.startAt)
          uncovered.startAt = [
            `Start by ${formatDateTime(event.startAt)}, when the event begins.`,
          ];
        if (event.endAt && endAt < event.endAt)
          uncovered.endAt = [
            `End at ${formatDateTime(event.endAt)} or later, when the event ends.`,
          ];
        if (Object.keys(uncovered).length)
          return {
            error: "The reservation must cover the whole event.",
            fieldErrors: uncovered,
          };

        const equipmentIds = lines.map((line) => line.equipmentId);
        const pools = await tx.$queryRaw<
          { id: string; totalQuantity: number }[]
        >`
        SELECT "id", "totalQuantity" FROM "Equipment"
        WHERE "id" IN (${Prisma.join(equipmentIds)}) AND "isActive" = true
        ORDER BY "id" FOR UPDATE
      `;
        const totals = new Map(
          pools.map((pool) => [pool.id, pool.totalQuantity]),
        );

        // A type retired since the request was made is marked on its own row.
        const retired: Record<string, string[]> = {};
        lines.forEach((line, index) => {
          if (!totals.has(line.equipmentId))
            retired[`lines.${index}.equipmentId`] = [
              "This equipment type is no longer available. Choose another.",
            ];
        });
        if (Object.keys(retired).length)
          return {
            error:
              "Nothing was reserved: an equipment type is no longer available.",
            fieldErrors: retired,
          };

        // Rows, not sums, read once for every type: each pool's answer is its
        // busiest instant (lib/equipment/availability.ts).
        const overlapping = { startAt: { lt: endAt }, endAt: { gt: startAt } };
        const select = {
          equipmentId: true,
          startAt: true,
          endAt: true,
          quantity: true,
        } as const;
        const reservations = await tx.reservation.findMany({
          where: {
            equipmentId: { in: equipmentIds },
            status: "CONFIRMED",
            ...overlapping,
          },
          select,
        });
        const unavailability = await tx.equipmentUnavailability.findMany({
          where: { equipmentId: { in: equipmentIds }, ...overlapping },
          select,
        });

        // AC 4 — every row is checked before anything is written, so a short
        // row reports itself and the rows that would fit are not reserved alone.
        const shortfalls: Record<string, string[]> = {};
        lines.forEach((line, index) => {
          const { available, total } = summariseAvailability({
            total: totals.get(line.equipmentId)!,
            reservations: reservations.filter(
              (r) => r.equipmentId === line.equipmentId,
            ),
            unavailability: unavailability.filter(
              (u) => u.equipmentId === line.equipmentId,
            ),
            startAt,
            endAt,
          });
          if (line.quantity > available)
            shortfalls[`lines.${index}.quantity`] = [
              `Only ${available} of ${total} free for this period — ${line.quantity - available} short.`,
            ];
        });
        if (Object.keys(shortfalls).length)
          return {
            error:
              "Nothing was reserved: not enough is free for the rows marked below.",
            fieldErrors: shortfalls,
          };

        await tx.reservation.createMany({
          data: lines.map((line) => ({
            eventId: request.eventId,
            requestId,
            equipmentId: line.equipmentId,
            quantity: line.quantity,
            startAt,
            endAt,
            reservedById: userId,
            status: "CONFIRMED" as const,
          })),
        });
        return { reserved: lines.length };
      },
    );

    if ("error" in result) return err(result.error, result.fieldErrors);
    revalidatePath("/equipment");
    return ok(result);
  } catch (error) {
    if (error instanceof PermissionError) return err(error.message);
    throw error;
  }
}
