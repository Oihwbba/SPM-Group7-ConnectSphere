"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";

import { auth } from "@/auth";
import { err, ok, type ActionResult } from "@/lib/action-result";
import { requirePermission, PermissionError } from "@/lib/auth/can";
import { prisma } from "@/lib/db";
import {
  allAvailabilitySchema,
  availabilitySchema,
  reservationSchema,
} from "@/lib/schemas/reservation";

type Availability = { available: number; total: number };

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
  const [reserved, unavailable] = await Promise.all([
    db.reservation.aggregate({
      where: { equipmentId, status: "CONFIRMED", ...overlapping },
      _sum: { quantity: true },
    }),
    db.equipmentUnavailability.aggregate({
      where: { equipmentId, ...overlapping },
      _sum: { quantity: true },
    }),
  ]);

  return {
    total: equipment.totalQuantity,
    available: Math.max(
      0,
      equipment.totalQuantity -
        (reserved._sum.quantity ?? 0) -
        (unavailable._sum.quantity ?? 0),
    ),
  };
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

    const [reservedGroups, unavailableGroups] = await Promise.all([
      prisma.reservation.groupBy({
        by: ["equipmentId"],
        where: {
          equipmentId: { in: equipmentIds },
          status: "CONFIRMED",
          ...overlapping,
        },
        _sum: { quantity: true },
      }),
      prisma.equipmentUnavailability.groupBy({
        by: ["equipmentId"],
        where: {
          equipmentId: { in: equipmentIds },
          ...overlapping,
        },
        _sum: { quantity: true },
      }),
    ]);

    const reservedMap = new Map<string, number>(
      reservedGroups.map((g) => [g.equipmentId, g._sum.quantity ?? 0]),
    );
    const unavailableMap = new Map<string, number>(
      unavailableGroups.map((g) => [g.equipmentId, g._sum.quantity ?? 0]),
    );

    const result: Record<string, Availability> = {};
    for (const item of allEquipment) {
      const reservedCount = reservedMap.get(item.id) ?? 0;
      const unavailableCount = unavailableMap.get(item.id) ?? 0;
      result[item.id] = {
        total: item.totalQuantity,
        available: Math.max(
          0,
          item.totalQuantity - reservedCount - unavailableCount,
        ),
      };
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

    const result = await prisma.$transaction(async (tx) => {
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

    if ("error" in result) {
      return err(result.error ?? "Unable to create the reservation.");
    }
    revalidatePath("/equipment");
    return ok(result);
  } catch (error) {
    if (error instanceof PermissionError) return err(error.message);
    throw error;
  }
}
