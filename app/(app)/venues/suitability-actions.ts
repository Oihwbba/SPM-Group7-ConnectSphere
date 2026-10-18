"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { can, requirePermission, PermissionError } from "@/lib/auth/can";
import { err, ok, type ActionResult } from "@/lib/action-result";
import { BOOKABLE_EVENT_STATUSES } from "@/lib/schemas/booking";
import { suitabilityJudgementSchema } from "@/lib/schemas/suitability";

/**
 * SCRUM-40 AC8 — the event's assigned Coordinator records whether a venue is
 * suitable for it, with a note. Recording it again replaces it: one judgement
 * per event and venue. It is shown beside the automatic result and is the
 * result that counts for this event, but it is advisory: nothing reads it to
 * refuse a request or a confirmation (AC9). Venue Staff see it on the
 * request they review (AC10).
 *
 * Judging belongs to planning, so the event must be Approved or in Planning,
 * the statuses a venue can be requested in (SCRUM-50).
 */
export async function recordSuitabilityJudgement(
  input: unknown,
): Promise<ActionResult<{ suitable: boolean }>> {
  const session = await auth();
  const user = session?.user;

  try {
    requirePermission(user, "venue:judge");

    const parsed = suitabilityJudgementSchema.safeParse(input);
    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      return err(
        fieldErrors.note?.[0] ??
          fieldErrors.suitable?.[0] ??
          "Please fix the highlighted fields.",
        fieldErrors,
      );
    }
    const { eventId, venueId, suitable, note } = parsed.data;

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: {
        organiserId: true,
        coordinatorId: true,
        status: true,
      },
    });
    // Someone else's event reads exactly like one that doesn't exist
    // (SCRUM-68 not-found parity).
    if (!event || !can(user!, "venue:judge", { kind: "event", ...event })) {
      return err("Event not found.");
    }
    if (!BOOKABLE_EVENT_STATUSES.includes(event.status)) {
      return err(
        "Suitability can only be judged while the event is being planned.",
      );
    }

    const venue = await prisma.venue.findFirst({
      where: { id: venueId, isActive: true },
      select: { id: true },
    });
    if (!venue) return err("Venue not found.");

    await prisma.$transaction(async (tx) => {
      const judgement = await tx.venueSuitabilityJudgement.upsert({
        where: { eventId_venueId: { eventId, venueId } },
        update: { suitable, note, recordedById: user!.id, recordedAt: new Date() },
        create: { eventId, venueId, suitable, note, recordedById: user!.id },
        select: { id: true },
      });
      // SCRUM-71: who judged, what and when.
      await tx.auditLog.create({
        data: {
          entityType: "VenueSuitabilityJudgement",
          entityId: judgement.id,
          action: "RECORDED",
          actorId: user!.id,
          fieldName: "suitable",
          newValue: suitable ? "SUITABLE" : "NOT_SUITABLE",
          summary: note,
        },
      });
    });

    revalidatePath("/bookings/new");
    revalidatePath("/bookings");
    return ok({ suitable });
  } catch (error) {
    if (error instanceof PermissionError) return err(error.message);
    throw error;
  }
}
