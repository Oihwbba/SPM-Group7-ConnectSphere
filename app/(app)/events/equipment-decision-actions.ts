"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { can, requirePermission, PermissionError } from "@/lib/auth/can";
import { err, ok, type ActionResult } from "@/lib/action-result";
import { LIVE_REQUEST } from "@/lib/event-readiness";
import {
  NO_EQUIPMENT_HAS_REQUEST_MESSAGE,
  NO_EQUIPMENT_NOT_PLANNING_MESSAGE,
  noEquipmentDecisionSchema,
} from "@/lib/schemas/event";

const NOT_FOUND = "Event not found.";

/**
 * SCRUM-170 AC4 — the assigned Coordinator records that a Planning event needs
 * no equipment, which completes the readiness checklist's Equipment item. It
 * keeps who and when, and is audited (SCRUM-71).
 *
 * The event row is locked first, so a request created at the same moment
 * either commits before this reads (and the decision is refused) or waits and
 * then clears the decision (createEquipmentRequest): the two never stand side
 * by side. Recording it again changes nothing.
 */
export async function recordNoEquipmentNeeded(
  input: unknown,
): Promise<ActionResult<{ recordedAt: Date }>> {
  const session = await auth();
  const user = session?.user;

  try {
    requirePermission(user, "event:no-equipment");

    const parsed = noEquipmentDecisionSchema.safeParse(input);
    if (!parsed.success) return err(NOT_FOUND);
    const { eventId } = parsed.data;

    const now = new Date();
    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Event" WHERE "id" = ${eventId} FOR UPDATE`;
      const event = await tx.event.findUnique({
        where: { id: eventId },
        select: {
          organiserId: true,
          coordinatorId: true,
          status: true,
          noEquipmentNeededAt: true,
        },
      });
      if (
        !event ||
        !can(user!, "event:no-equipment", {
          kind: "event",
          organiserId: event.organiserId,
          coordinatorId: event.coordinatorId,
          status: event.status,
        })
      ) {
        return err<{ recordedAt: Date }>(NOT_FOUND);
      }
      if (event.status !== "PLANNING") {
        return err<{ recordedAt: Date }>(NO_EQUIPMENT_NOT_PLANNING_MESSAGE);
      }
      if (event.noEquipmentNeededAt) {
        return ok({ recordedAt: event.noEquipmentNeededAt });
      }

      const liveRequests = await tx.equipmentRequest.count({
        where: { eventId, status: { in: [...LIVE_REQUEST] } },
      });
      if (liveRequests > 0) {
        return err<{ recordedAt: Date }>(NO_EQUIPMENT_HAS_REQUEST_MESSAGE);
      }

      await tx.event.update({
        where: { id: eventId },
        data: { noEquipmentNeededAt: now, noEquipmentNeededById: user!.id },
      });
      await tx.auditLog.create({
        data: {
          entityType: "Event",
          entityId: eventId,
          action: "UPDATED",
          actorId: user!.id,
          fieldName: "noEquipmentNeededAt",
          oldValue: null,
          newValue: now.toISOString(),
        },
      });
      return ok({ recordedAt: now });
    });

    if (result.ok) revalidatePath("/events");
    return result;
  } catch (error) {
    if (error instanceof PermissionError) return err(error.message);
    throw error;
  }
}
