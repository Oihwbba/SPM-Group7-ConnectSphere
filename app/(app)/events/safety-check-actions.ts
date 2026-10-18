"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { can, requirePermission, PermissionError } from "@/lib/auth/can";
import { ok, err, type ActionResult } from "@/lib/action-result";
import { getReadinessChecklist } from "@/lib/event-readiness";
import { SAFETY_CHECK_LABEL } from "@/lib/safety-checks";

const requestSchema = z.object({ eventId: z.string().min(1) });

/**
 * SCRUM-166 AC1, AC7, AC12 — the assigned Coordinator requests an operational
 * safety check for a Planning event whose venue and equipment are arranged.
 * The check joins the Safety Officers' queue and every Safety Officer is
 * notified. Requesting while a check is awaiting review returns that check
 * instead of a second one (AC7); the event row is locked first, so two
 * requests at the same moment take turns and the second finds the first.
 */
export async function requestSafetyCheck(
  input: unknown,
): Promise<ActionResult<{ checkId: string; existing: boolean }>> {
  const session = await auth();
  const user = session?.user;

  try {
    requirePermission(user, "safety-check:request");

    const parsed = requestSchema.safeParse(input);
    if (!parsed.success) return err("Please provide a valid event.");
    const { eventId } = parsed.data;

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { organiserId: true, coordinatorId: true, status: true, name: true },
    });
    if (!event || !can(user!, "safety-check:request", { kind: "event", ...event })) {
      return err("Event not found.");
    }

    const outcome = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Event" WHERE "id" = ${eventId} FOR UPDATE`;
      const current = await tx.event.findUniqueOrThrow({
        where: { id: eventId },
        select: { status: true, coordinatorId: true },
      });
      if (current.status !== "PLANNING") return { refused: "not-planning" as const };
      if (current.coordinatorId !== user!.id) return { refused: "reassigned" as const };

      const awaiting = await tx.safetyCheck.findFirst({
        where: { eventId, status: "AWAITING_REVIEW" },
        select: { id: true },
      });
      if (awaiting) return { checkId: awaiting.id, existing: true };

      const checklist = (await getReadinessChecklist(tx, eventId))!;
      const safety = checklist.items.find((item) => item.name === "Safety check")!;
      if (safety.state === SAFETY_CHECK_LABEL.APPROVED) {
        return { refused: "approved" as const };
      }
      const outstanding = checklist.items.filter(
        (item) => item.name !== "Safety check" && !item.complete,
      );
      if (outstanding.length > 0) {
        return {
          refused: "not-ready" as const,
          outstanding: outstanding.map((item) => `${item.name} (${item.state})`).join(", "),
        };
      }

      const check = await tx.safetyCheck.create({
        data: { eventId, requestedById: user!.id },
        select: { id: true },
      });
      // AC1: every Safety Officer, except one who organises or coordinates
      // this event and so may not review it (AC6).
      const officers = await tx.user.findMany({
        where: {
          // SCRUM-121 AC2: the role held besides another counts too.
          OR: [{ role: "SAFETY_OFFICER" }, { additionalRoles: { has: "SAFETY_OFFICER" } }],
          id: { notIn: [event.organiserId, user!.id] },
        },
        select: { id: true },
      });
      await tx.notification.createMany({
        data: officers.map((officer) => ({
          userId: officer.id,
          type: "SAFETY_CHECK_REQUESTED" as const,
          title: "Safety check requested",
          message: `"${event.name}" is waiting for an operational safety check.`,
          link: `/safety-checks/${check.id}`,
          eventId,
        })),
      });
      await tx.auditLog.create({
        data: {
          entityType: "SafetyCheck",
          entityId: check.id,
          action: "REQUESTED",
          actorId: user!.id,
          fieldName: "status",
          newValue: "AWAITING_REVIEW",
          summary: `Safety check requested for event ${eventId} (SCRUM-166)`,
        },
      });
      return { checkId: check.id, existing: false };
    });

    if ("refused" in outcome) {
      switch (outcome.refused) {
        case "not-planning":
          return err("Only an event in Planning can have a safety check.");
        case "reassigned":
          return err("This event was updated by another user. Refresh and try again.");
        case "approved":
          return err("This event's safety check is already approved.");
        case "not-ready":
          return err(
            `Arrange the venue and equipment before requesting a safety check. Outstanding: ${outcome.outstanding}.`,
          );
      }
    }

    revalidatePath("/events");
    revalidatePath("/safety-checks");
    return ok(outcome);
  } catch (error) {
    if (error instanceof PermissionError) return err(error.message);
    throw error;
  }
}
