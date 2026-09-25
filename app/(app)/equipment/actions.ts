"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";

import { auth } from "@/auth";
import { err, ok, type ActionResult } from "@/lib/action-result";
import { requirePermission, PermissionError } from "@/lib/auth/can";
import { prisma } from "@/lib/db";
import {
  markConflicts,
  sortSchedule,
  summariseAvailability,
  type MarkedScheduleEntry,
  type ScheduleEntry,
} from "@/lib/equipment/availability";
import {
  allAvailabilitySchema,
  availabilitySchema,
  equipmentScheduleSchema,
  reservationSchema,
} from "@/lib/schemas/reservation";

type Availability = { available: number; total: number; committed: number };
type ReserveOutcome = { error: string } | { id: string; available: number };

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
  entries: MarkedScheduleEntry[];
  /** True when nothing is committed from `from` onwards (SCRUM-30). */
  fullyAvailable: boolean;
}

/**
 * SCRUM-30 — everything committed on one equipment item from `from` onwards:
 * reservations with the event they serve, and unavailability with its reason
 * and duration. Entries that share time are marked so the view can flag them;
 * entries that merely touch at an endpoint are not.
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
      entries: sortSchedule(markConflicts(entries, equipment.totalQuantity)),
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
      const event = await tx.event.findFirst({
        where: { id: eventId, status: "APPROVED" },
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
