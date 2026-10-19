"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import {
  can,
  requirePermission,
  PermissionError,
  REASSIGNABLE,
} from "@/lib/auth/can";
import { ok, err, type ActionResult } from "@/lib/action-result";
import { assignCoordinatorSchema } from "@/lib/schemas/assignment";

type ReassignOutcome =
  | { error: string }
  | { coordinatorName: string; changed: boolean };

/**
 * SCRUM-21 — the Lead moves an Under Review, Planning or Confirmed event to
 * another Coordinator, effective at once (AC1); there is no acceptance step.
 *
 * - Not to the event's own Organiser; choosing the current Coordinator
 *   changes nothing (AC3). Anyone not holding the Coordinator role is
 *   refused.
 * - Draft, Submitted, Rejected, Cancelled and Completed events are refused
 *   (AC4); a draft or a missing id reads "Event not found." (SCRUM-68).
 * - The write is conditional on the Coordinator still being the one read,
 *   so of two Leads reassigning at the same moment exactly one is saved, and
 *   the event never has two Coordinators (AC2, AC9).
 * - The reassigning Lead becomes the event's supervising Lead (SCRUM-165
 *   AC11). The history records who, from whom, to whom and when (AC7), and
 *   the new and previous Coordinators and the Organiser are told (AC6).
 */
export async function reassignCoordinator(
  input: unknown,
): Promise<ActionResult<{ coordinatorName: string; changed: boolean }>> {
  const session = await auth();

  try {
    requirePermission(session?.user, "event:reassign");
    const lead = session!.user;

    const parsed = assignCoordinatorSchema.safeParse(input);
    if (!parsed.success) {
      return err(
        "Choose a Coordinator for this event.",
        parsed.error.flatten().fieldErrors,
      );
    }
    const { eventId, coordinatorId } = parsed.data;

    const result = await prisma.$transaction<ReassignOutcome>(async (tx) => {
      const event = await tx.event.findUnique({
        where: { id: eventId },
        select: {
          name: true,
          organiserId: true,
          coordinatorId: true,
          status: true,
          coordinator: { select: { name: true } },
        },
      });
      if (!event || event.status === "DRAFT") {
        return { error: "Event not found." };
      }
      if (!can(lead, "event:reassign", { kind: "event", ...event })) {
        return {
          error:
            event.status === "SUBMITTED"
              ? "This request has no Coordinator yet: assign it from the Unassigned queue."
              : "Only an Under Review, Planning or Confirmed event can be reassigned.",
        };
      }

      // SCRUM-121 AC2: someone who holds the role besides another counts too,
      // as in the list the Lead picks from (getCoordinatorLoads).
      const coordinator = await tx.user.findFirst({
        where: {
          id: coordinatorId,
          OR: [{ role: "COORDINATOR" }, { additionalRoles: { has: "COORDINATOR" } }],
        },
        select: { id: true, name: true },
      });
      if (!coordinator) {
        return { error: "Choose someone who is a Coordinator." };
      }
      if (coordinator.id === event.organiserId) {
        return {
          error: "The event's own Organiser can't be its Coordinator.",
        };
      }
      if (coordinator.id === event.coordinatorId) {
        return { coordinatorName: coordinator.name, changed: false };
      }

      const moved = await tx.event.updateMany({
        where: {
          id: eventId,
          coordinatorId: event.coordinatorId,
          status: { in: REASSIGNABLE },
        },
        data: { coordinatorId: coordinator.id, supervisingLeadId: lead.id },
      });
      if (moved.count !== 1) {
        const current = await tx.event.findUnique({
          where: { id: eventId },
          select: { coordinator: { select: { name: true } } },
        });
        return {
          error: `This event was just changed by someone else; it is now with ${current?.coordinator?.name ?? "no Coordinator"}. Check it and try again.`,
        };
      }

      const previous = event.coordinator!.name;
      await tx.auditLog.create({
        data: {
          entityType: "Event",
          entityId: eventId,
          action: "REASSIGNED",
          actorId: lead.id,
          fieldName: "coordinatorId",
          oldValue: event.coordinatorId,
          newValue: coordinator.id,
          summary: `Reassigned by the Lead from ${previous} to ${coordinator.name} (SCRUM-21)`,
        },
      });

      // AC6 (SCRUM-45 AC10): the new and previous Coordinators and the
      // Organiser.
      await tx.notification.createMany({
        data: [
          {
            userId: coordinator.id,
            type: "COORDINATOR_REASSIGNED",
            title: "An event was reassigned to you",
            message: `"${event.name}" is now yours to coordinate.`,
            eventId,
          },
          {
            userId: event.coordinatorId!,
            type: "COORDINATOR_REASSIGNED",
            title: "An event was reassigned",
            message: `"${event.name}" was reassigned to ${coordinator.name}. You can still view it from All Events.`,
            eventId,
          },
          {
            userId: event.organiserId,
            type: "COORDINATOR_REASSIGNED",
            title: "Your event has a new coordinator",
            message: `"${event.name}" is now coordinated by ${coordinator.name}.`,
            eventId,
          },
        ],
      });

      return { coordinatorName: coordinator.name, changed: true };
    });

    if ("error" in result) return err(result.error);

    revalidatePath("/all-events");
    revalidatePath(`/all-events/${eventId}`);
    revalidatePath("/events");
    return ok(result);
  } catch (error) {
    if (error instanceof PermissionError) return err(error.message);
    throw error;
  }
}
