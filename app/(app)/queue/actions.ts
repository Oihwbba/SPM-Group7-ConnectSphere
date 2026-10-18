"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { requirePermission, PermissionError } from "@/lib/auth/can";
import { ok, err, type ActionResult } from "@/lib/action-result";
import { assignCoordinatorSchema } from "@/lib/schemas/assignment";

type AssignOutcome = { error: string } | { coordinatorName: string };

/**
 * SCRUM-165 — the Lead assigns an unassigned request to a Coordinator.
 *
 * The write is conditional on the request still being Submitted with no
 * Coordinator, so of two Leads assigning it at the same moment exactly one
 * succeeds (AC6), and a request that already has one is refused with its
 * current Coordinator named (AC7); changing it is reassignment (SCRUM-21).
 * Any other event, or none, reads "Request not found.", so the answer never
 * tells which ids exist (SCRUM-68).
 */
export async function assignCoordinator(
  input: unknown,
): Promise<ActionResult<{ coordinatorName: string }>> {
  const session = await auth();

  try {
    requirePermission(session?.user, "event:assign");
    const leadId = session!.user.id;

    const parsed = assignCoordinatorSchema.safeParse(input);
    if (!parsed.success) {
      return err(
        "Choose a Coordinator for this request.",
        parsed.error.flatten().fieldErrors,
      );
    }
    const { eventId, coordinatorId } = parsed.data;

    const result = await prisma.$transaction<AssignOutcome>(async (tx) => {
      const event = await tx.event.findUnique({
        where: { id: eventId },
        select: { id: true, name: true, organiserId: true, status: true },
      });
      if (
        !event ||
        (event.status !== "SUBMITTED" && event.status !== "UNDER_REVIEW")
      ) {
        return { error: "Request not found." };
      }

      // AC4: one active Coordinator, i.e. someone who holds the role now.
      const coordinator = await tx.user.findFirst({
        where: { id: coordinatorId, role: "COORDINATOR" },
        select: { id: true, name: true },
      });
      if (!coordinator) {
        return { error: "Choose someone who is a Coordinator." };
      }
      // AC7: never the event's own Organiser (possible once one account can
      // hold both roles, SCRUM-121).
      if (coordinator.id === event.organiserId) {
        return {
          error: "The event's own Organiser can't be its Coordinator.",
        };
      }

      // AC5, AC11: the Coordinator, the move to Under Review and the
      // supervising Lead in one write, only if nobody has assigned it yet.
      const claimed = await tx.event.updateMany({
        where: { id: eventId, status: "SUBMITTED", coordinatorId: null },
        data: {
          coordinatorId: coordinator.id,
          status: "UNDER_REVIEW",
          supervisingLeadId: leadId,
        },
      });
      if (claimed.count !== 1) {
        const current = await tx.event.findUnique({
          where: { id: eventId },
          select: { coordinator: { select: { name: true } } },
        });
        return {
          error: current?.coordinator
            ? `This request is already assigned to ${current.coordinator.name}.`
            : "Request not found.",
        };
      }

      await tx.auditLog.create({
        data: {
          entityType: "Event",
          entityId: eventId,
          action: "ASSIGNED",
          actorId: leadId,
          fieldName: "coordinatorId",
          oldValue: null,
          newValue: coordinator.id,
          summary: "Assigned by the Lead from the Unassigned queue (SCRUM-165)",
        },
      });

      // AC5 (SCRUM-45 AC1): the Organiser and the Coordinator are told.
      await tx.notification.createMany({
        data: [
          {
            userId: event.organiserId,
            type: "COORDINATOR_ASSIGNED",
            title: "A coordinator was assigned",
            message: `Your event "${event.name}" is now under review.`,
            eventId,
          },
          {
            userId: coordinator.id,
            type: "COORDINATOR_ASSIGNED",
            title: "You were assigned an event",
            message: `"${event.name}" was assigned to you for review.`,
            eventId,
          },
        ],
      });

      return { coordinatorName: coordinator.name };
    });

    if ("error" in result) return err(result.error);

    revalidatePath("/queue");
    revalidatePath("/events");
    return ok({ coordinatorName: result.coordinatorName });
  } catch (error) {
    if (error instanceof PermissionError) return err(error.message);
    throw error;
  }
}
