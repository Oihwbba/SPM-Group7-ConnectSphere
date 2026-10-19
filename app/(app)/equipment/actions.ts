"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

import { auth } from "@/auth";
import { err, ok, type ActionResult } from "@/lib/action-result";
import { can, requirePermission, PermissionError } from "@/lib/auth/can";
import { prisma } from "@/lib/db";
import {
  sortSchedule,
  summariseAvailability,
  type ScheduleEntry,
} from "@/lib/equipment/availability";
import {
  CONFIRMED_HOLDS,
  reservableRequest,
} from "@/lib/equipment/request-queries";
import { LIVE_LINE, outstandingLines } from "@/lib/equipment/requests";
import { formatDateTime } from "@/lib/datetime";
import { outdateSafetyChecks } from "@/lib/safety-checks";
import { fieldErrorsByPath } from "@/lib/schemas/equipment-request";
import {
  allAvailabilitySchema,
  availabilitySchema,
  equipmentScheduleSchema,
  reportReservationSchema,
  requestReservationSchema,
} from "@/lib/schemas/reservation";
import { flagArrangements } from "@/lib/reconsideration";
import {
  competingLines,
  openRequestLines,
  submittedFirst,
} from "@/lib/equipment/competing";

type Availability = { available: number; total: number; committed: number };
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
          needsReconsideration: true,
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
        needsReconsideration: row.needsReconsideration,
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
        needsReconsideration: false,
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

/**
 * SCRUM-155 — reserve every row of an approved request together, or none.
 *
 * This is the only way to reserve equipment (SCRUM-156): stock is reserved
 * against a request Technical Support has approved, never for an event alone.
 *
 * Locks, always in this order: the event row, so nothing else reserves for
 * the event and it cannot be confirmed (SCRUM-81) or rejected (SCRUM-117)
 * between the check below and the insert;
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

    const { requestId, requestVersion, lines } = parsed.data;
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
            updatedAt: true,
            createdAt: true,
            event: {
              select: {
                organiserId: true,
                coordinatorId: true,
                startAt: true,
                endAt: true,
                reservations: CONFIRMED_HOLDS,
              },
            },
            lines: {
              where: LIVE_LINE,
              select: { equipmentId: true, quantity: true },
            },
          },
        });
        // AC 6 — read under the event lock, which every reservation for the
        // event takes, so what is outstanding can't change before the insert.
        if (
          !request ||
          outstandingLines(
            requestId,
            request.lines,
            request.event,
            request.event.reservations,
          ).length === 0
        )
          return {
            error:
              "This request is not waiting to be reserved: it is already reserved, or no longer approved.",
          };
        // SCRUM-121 AC5: nobody reserves equipment for an event they organise
        // or coordinate, whatever roles they hold.
        if (!can(session!.user!, "equipment:reserve", { kind: "arrangement", ...request.event }))
          return { error: "You do not have permission to do that." };
        // SCRUM-142: the Coordinator can change an approved request's lines
        // (it goes back for review and may be approved again), so a form
        // opened before that would reserve lines the request no longer has.
        if (
          requestVersion &&
          request.updatedAt.toISOString() !== requestVersion
        )
          return {
            error:
              "This request has changed since you opened it. Choose it again to see it as it is now.",
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
        const free: number[] = [];
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
          free[index] = available;
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

        // SCRUM-134 AC5 — first come, first served: what is reserved must
        // leave enough for each earlier open request whose event overlaps,
        // until it is reserved in full, rejected or cancelled. Read with the
        // equipment rows locked, so nothing is reserved for it in between.
        const openLines = await openRequestLines(tx);
        const me = { requestId, submittedAt: request.createdAt };
        const waiting: Record<string, string[]> = {};
        lines.forEach((line, index) => {
          const earlier = competingLines(openLines, requestId, line.equipmentId, {
            startAt,
            endAt,
          }).filter((other) => submittedFirst(other, me) && other.reserved < other.quantity);
          const needed = earlier.reduce(
            (sum, other) => sum + other.quantity - other.reserved,
            0,
          );
          const left = free[index] - line.quantity;
          if (earlier.length > 0 && left < needed)
            waiting[`lines.${index}.quantity`] = [
              `Reserving ${line.quantity} would leave ${left} free, but an earlier request still needs ${needed}: "${earlier[0].eventName}", submitted ${formatDateTime(earlier[0].submittedAt)}. Reserve it first, or wait until it is rejected or cancelled.`,
            ];
        });
        if (Object.keys(waiting).length)
          return {
            error:
              "Nothing was reserved: an earlier request comes first for the rows marked below.",
            fieldErrors: waiting,
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
        // SCRUM-166 AC13: a new reservation changes what a safety check reviewed.
        await outdateSafetyChecks(tx, request.eventId, new Date());
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

const RESERVATION_NOT_FOUND = "Reservation not found.";
const ALREADY_REPORTED =
  "This reservation has already been reported and is waiting for its event's Coordinator to decide.";

/**
 * SCRUM-32 — Technical Support report that reserved equipment can no longer
 * be provided, with the reason (AC1, AC2).
 *
 * - The reservation is flagged Needs Reconsideration (SCRUM-26) and stays
 *   Confirmed, with its quantity and period, until its event's Coordinator
 *   resolves the flag (AC1, AC4). Nothing here cancels or changes it.
 * - The reason becomes the flag's reason, which the Coordinator reads, and
 *   flagging tells them and Technical Support (SCRUM-124 AC8).
 * - A reservation already flagged is left as it is: reporting it again
 *   changes nothing and tells nobody (AC3). The flag is conditional on that,
 *   so two reports at once flag it once.
 * - The report is recorded with who and when (AC5).
 * - The notices reference the event, so its row is locked first, in the
 *   order resolving a flag uses (ADR 0007).
 */
export async function reportUnprovidableEquipment(
  input: unknown,
): Promise<ActionResult<{ reservationId: string }>> {
  const session = await auth();
  const user = session?.user;

  try {
    requirePermission(user, "reservation:report");

    const parsed = reportReservationSchema.safeParse(input);
    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      return err(fieldErrors.reason?.[0] ?? RESERVATION_NOT_FOUND, fieldErrors);
    }
    const { reservationId, reason } = parsed.data;

    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      select: { eventId: true, status: true, needsReconsideration: true },
    });
    if (!reservation || reservation.status !== "CONFIRMED") {
      return err(RESERVATION_NOT_FOUND);
    }
    if (reservation.needsReconsideration) return err(ALREADY_REPORTED);

    const refused = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Event" WHERE "id" = ${reservation.eventId} FOR KEY SHARE`;
      const flagged = await flagArrangements(
        tx,
        { bookingIds: [], reservationIds: [reservationId] },
        `Technical Support can no longer provide it: ${reason}`,
        new Date(),
        user!.id,
      );
      if (flagged.reservations !== 1) {
        // Cancelled, or reported by someone else, since it was read.
        const latest = await tx.reservation.findUniqueOrThrow({
          where: { id: reservationId },
          select: { status: true },
        });
        return latest.status === "CONFIRMED" ? ALREADY_REPORTED : RESERVATION_NOT_FOUND;
      }
      await tx.auditLog.create({
        data: {
          entityType: "Reservation",
          entityId: reservationId,
          action: "REPORTED_UNPROVIDABLE",
          actorId: user!.id,
          fieldName: "needsReconsideration",
          oldValue: "false",
          newValue: "true",
          summary: reason,
        },
      });
      return null;
    });
    if (refused) return err(refused);

    revalidatePath("/equipment");
    revalidatePath("/events");
    return ok({ reservationId });
  } catch (error) {
    if (error instanceof PermissionError) return err(error.message);
    throw error;
  }
}
