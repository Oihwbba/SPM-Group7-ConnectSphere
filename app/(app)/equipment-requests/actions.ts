"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

import { auth } from "@/auth";
import { err, ok, type ActionResult } from "@/lib/action-result";
import { can, requirePermission, PermissionError } from "@/lib/auth/can";
import { prisma } from "@/lib/db";
import {
  OPEN_REQUEST_STATUSES,
  REQUESTABLE_EVENT_STATUSES,
} from "@/lib/equipment/requests";
import {
  createEquipmentRequestSchema,
  fieldErrorsByPath,
} from "@/lib/schemas/equipment-request";

const NOT_REQUESTABLE = "Choose one of your approved events.";

function findOpenRequest(eventId: string) {
  return prisma.equipmentRequest.findFirst({
    where: { eventId, status: { in: [...OPEN_REQUEST_STATUSES] } },
    select: { id: true },
  });
}

/**
 * SCRUM-27 — an Event Coordinator requests equipment for one of their events.
 *
 * - An event the coordinator has no relationship to, one that doesn't exist and
 *   one that isn't going ahead all get the same answer, so the action can't be
 *   used to probe which event ids exist (SCRUM-68).
 * - AC 7: an event keeps at most one open request. A second submission returns
 *   the existing request with `existing: true` so the page can show it. The
 *   partial unique index "EquipmentRequest_one_open_per_event" is what makes
 *   that hold when two submissions race: the loser's insert fails, and it is
 *   answered with the winner's request instead of an error.
 */
export async function createEquipmentRequest(
  input: unknown,
): Promise<ActionResult<{ id: string; existing: boolean }>> {
  const session = await auth();
  const user = session?.user;

  try {
    requirePermission(user, "equipment-request:create");

    const parsed = createEquipmentRequestSchema.safeParse(input);
    if (!parsed.success) {
      return err(
        "Please fix the highlighted fields.",
        fieldErrorsByPath(parsed.error),
      );
    }
    const { eventId, notes, lines } = parsed.data;

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { organiserId: true, coordinatorId: true, status: true },
    });
    const requestable =
      event &&
      can(user!, "equipment-request:create", { kind: "event", ...event }) &&
      (REQUESTABLE_EVENT_STATUSES as readonly string[]).includes(event.status);
    if (!requestable) {
      return err(NOT_REQUESTABLE, { eventId: [NOT_REQUESTABLE] });
    }

    // AC 2: only types on the predefined list, and only active ones.
    const known = await prisma.equipment.findMany({
      where: {
        id: { in: lines.map((line) => line.equipmentId) },
        isActive: true,
      },
      select: { id: true },
    });
    const knownIds = new Set(known.map((item) => item.id));
    const unknownLines: Record<string, string[]> = {};
    lines.forEach((line, index) => {
      if (!knownIds.has(line.equipmentId)) {
        unknownLines[`lines.${index}.equipmentId`] = [
          "Select an equipment type from the list.",
        ];
      }
    });
    if (Object.keys(unknownLines).length) {
      return err("Please fix the highlighted fields.", unknownLines);
    }

    const open = await findOpenRequest(eventId);
    if (open) return ok({ id: open.id, existing: true });

    try {
      const created = await prisma.$transaction(async (tx) => {
        const request = await tx.equipmentRequest.create({
          data: {
            eventId,
            requestedById: user!.id,
            status: "PENDING_REVIEW",
            notes,
            lines: {
              create: lines.map((line) => ({
                equipmentId: line.equipmentId,
                quantity: line.quantity,
                technicalRequirements: line.technicalRequirements,
              })),
            },
          },
          select: { id: true },
        });
        // The history log (SCRUM-28 AC 5) starts with the submission itself.
        await tx.equipmentRequestUpdate.create({
          data: {
            requestId: request.id,
            actorId: user!.id,
            fromStatus: null,
            toStatus: "PENDING_REVIEW",
            note: "Request submitted.",
          },
        });
        return request;
      });

      revalidatePath("/equipment-requests");
      return ok({ id: created.id, existing: false });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const winner = await findOpenRequest(eventId);
        if (winner) return ok({ id: winner.id, existing: true });
      }
      throw error;
    }
  } catch (error) {
    if (error instanceof PermissionError) return err(error.message);
    throw error;
  }
}
