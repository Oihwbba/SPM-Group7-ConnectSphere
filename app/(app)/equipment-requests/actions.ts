"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

import { auth } from "@/auth";
import { err, ok, type ActionResult } from "@/lib/action-result";
import { can, requirePermission, PermissionError } from "@/lib/auth/can";
import { prisma } from "@/lib/db";
import { getPoolAvailability } from "@/lib/equipment/request-queries";
import {
  EQUIPMENT_REQUEST_STATUS_LABEL,
  OPEN_REQUEST_STATUSES,
  REQUESTABLE_EVENT_STATUSES,
  canMoveRequest,
} from "@/lib/equipment/requests";
import {
  createEquipmentRequestSchema,
  fieldErrorsByPath,
  reviewEquipmentRequestSchema,
  suggestAlternativeSchema,
} from "@/lib/schemas/equipment-request";

const NOT_REQUESTABLE = "Choose one of your approved events.";
const NOT_FOUND = "Equipment request not found.";
const UPDATED_ELSEWHERE =
  "Someone else updated this request first. Refresh to see its current status.";

/**
 * SCRUM-28 AC 4 — every saved update tells the coordinator who raised the
 * request, inside the same transaction as the update itself.
 */
function notifyCoordinator(
  tx: Prisma.TransactionClient,
  request: { requestedById: string; event: { id: string } },
  message: string,
) {
  return tx.notification.create({
    data: {
      userId: request.requestedById,
      type: "EQUIPMENT_REQUEST_UPDATED",
      title: "Equipment request updated",
      message,
      link: "/equipment-requests",
      eventId: request.event.id,
    },
  });
}

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

    // The open request may have been raised after the coordinator's page
    // loaded, so the list is refreshed for it to be there to highlight.
    const showExisting = (id: string) => {
      revalidatePath("/equipment-requests");
      return ok({ id, existing: true });
    };

    const open = await findOpenRequest(eventId);
    if (open) return showExisting(open.id);

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
        if (winner) return showExisting(winner.id);
      }
      throw error;
    }
  } catch (error) {
    if (error instanceof PermissionError) return err(error.message);
    throw error;
  }
}

/**
 * SCRUM-28 AC 2 — Technical Support moves a request on: Pending Review → In
 * Review, then In Review → Approved or Rejected (`canMoveRequest`).
 *
 * The write is conditional on the status this reviewer saw, so of two
 * reviewers acting at once only one moves the request; the other is told, and
 * neither the history (AC 5) nor the notification (AC 4) is written twice.
 */
export async function updateEquipmentRequestStatus(
  input: unknown,
): Promise<ActionResult<{ status: string }>> {
  const session = await auth();
  const user = session?.user;

  try {
    requirePermission(user, "equipment-request:review");

    const parsed = reviewEquipmentRequestSchema.safeParse(input);
    if (!parsed.success) {
      return err(
        "Please fix the highlighted fields.",
        parsed.error.flatten().fieldErrors,
      );
    }
    const { requestId, toStatus, note } = parsed.data;

    const request = await prisma.equipmentRequest.findUnique({
      where: { id: requestId },
      select: {
        id: true,
        status: true,
        requestedById: true,
        event: { select: { id: true, name: true } },
      },
    });
    if (!request) return err(NOT_FOUND);

    const from = request.status;
    if (!canMoveRequest(from, toStatus)) {
      return err(
        `This request is ${EQUIPMENT_REQUEST_STATUS_LABEL[from]}, so it can't be marked ${EQUIPMENT_REQUEST_STATUS_LABEL[toStatus]}.`,
      );
    }

    const moved = await prisma.$transaction(async (tx) => {
      const result = await tx.equipmentRequest.updateMany({
        where: { id: request.id, status: from },
        data: {
          status: toStatus,
          decidedAt: toStatus === "IN_REVIEW" ? null : new Date(),
        },
      });
      if (result.count !== 1) return false;

      await tx.equipmentRequestUpdate.create({
        data: {
          requestId: request.id,
          actorId: user!.id,
          fromStatus: from,
          toStatus,
          note,
        },
      });
      await notifyCoordinator(
        tx,
        request,
        `Your equipment request for "${request.event.name}" is now ${EQUIPMENT_REQUEST_STATUS_LABEL[toStatus]}.` +
          (note ? ` Note: ${note}` : ""),
      );
      return true;
    });
    if (!moved) return err(UPDATED_ELSEWHERE);

    revalidatePath("/equipment-requests");
    return ok({ status: toStatus });
  } catch (error) {
    if (error instanceof PermissionError) return err(error.message);
    throw error;
  }
}

/**
 * SCRUM-28 AC 3 — when a requested type is unavailable for the event, Technical
 * Support picks another type from the inventory to suggest to the coordinator.
 *
 * Both halves are checked against what is free for the event's period: the
 * requested type must be short, and the alternative must cover the whole
 * quantity. A suggestion is advice, not a reservation (that is SCRUM-31), so
 * nothing is held; the coordinator is told and the history records it.
 */
export async function suggestAlternativeEquipment(
  input: unknown,
): Promise<ActionResult<{ alternativeId: string }>> {
  const session = await auth();
  const user = session?.user;

  try {
    requirePermission(user, "equipment-request:review");

    const parsed = suggestAlternativeSchema.safeParse(input);
    if (!parsed.success) {
      return err(
        "Please fix the highlighted fields.",
        parsed.error.flatten().fieldErrors,
      );
    }
    const { requestId, lineId, alternativeId } = parsed.data;

    const request = await prisma.equipmentRequest.findUnique({
      where: { id: requestId },
      select: {
        id: true,
        status: true,
        requestedById: true,
        event: { select: { id: true, name: true, startAt: true, endAt: true } },
        lines: {
          where: { id: lineId },
          select: {
            id: true,
            quantity: true,
            equipment: { select: { id: true, type: true } },
          },
        },
      },
    });
    const line = request?.lines[0];
    if (!request || !line) return err(NOT_FOUND);
    if (request.status !== "IN_REVIEW") {
      return err("Start the review before suggesting alternatives.");
    }

    const invalid = (message: string) =>
      err<{ alternativeId: string }>("Please fix the highlighted fields.", {
        alternativeId: [message],
      });
    if (alternativeId === line.equipment.id) {
      return invalid("Choose a different equipment type.");
    }
    const alternative = await prisma.equipment.findFirst({
      where: { id: alternativeId, isActive: true },
      select: { id: true, type: true },
    });
    if (!alternative) return invalid("Select an equipment type from the list.");

    const { startAt, endAt } = request.event;
    if (!startAt || !endAt) {
      return err(
        "This event has no dates yet, so availability can't be checked.",
      );
    }
    const pool = await getPoolAvailability(startAt, endAt);
    const requested = pool[line.equipment.id] ?? { available: 0, total: 0 };
    if (requested.available >= line.quantity) {
      return err(
        `${line.equipment.type} has enough free for this event, so there is nothing to replace.`,
      );
    }
    const offered = pool[alternative.id];
    if (offered.available < line.quantity) {
      return invalid(
        `Only ${offered.available} of ${offered.total} ${alternative.type} are free for this event: ${line.quantity - offered.available} short.`,
      );
    }

    const shortage = `only ${requested.available} of ${requested.total}`;
    const saved = await prisma.$transaction(async (tx) => {
      // Touching the request, conditional on it still being in review, stops
      // a suggestion landing on a request someone has just decided.
      const result = await tx.equipmentRequest.updateMany({
        where: { id: request.id, status: "IN_REVIEW" },
        data: { updatedAt: new Date() },
      });
      if (result.count !== 1) return false;

      await tx.equipmentRequestLine.update({
        where: { id: line.id },
        data: { suggestedAlternativeId: alternative.id },
      });
      await tx.equipmentRequestUpdate.create({
        data: {
          requestId: request.id,
          actorId: user!.id,
          fromStatus: null,
          toStatus: null,
          note: `Suggested ${alternative.type} instead of ${line.equipment.type} (${shortage} free).`,
        },
      });
      await notifyCoordinator(
        tx,
        request,
        `Technical Support suggested ${alternative.type} instead of ${line.equipment.type} for "${request.event.name}": ${shortage} ${line.equipment.type} are free.`,
      );
      return true;
    });
    if (!saved) return err(UPDATED_ELSEWHERE);

    revalidatePath("/equipment-requests");
    return ok({ alternativeId: alternative.id });
  } catch (error) {
    if (error instanceof PermissionError) return err(error.message);
    throw error;
  }
}
