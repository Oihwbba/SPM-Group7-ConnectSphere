"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { can, requirePermission, PermissionError } from "@/lib/auth/can";
import { ok, err, type ActionResult } from "@/lib/action-result";
import { formatDateTime } from "@/lib/datetime";
import { flagArrangements, liveBookingWhere } from "@/lib/reconsideration";
import { SAFETY_CHECK_LABEL } from "@/lib/safety-checks";

const NOTE_REQUIRED = "A note is required for Changes requested or Rejected.";
const PICK_REQUIRED = "Pick at least one venue booking or equipment reservation the changes affect.";

const outcomeSchema = z
  .object({
    checkId: z.string().min(1),
    outcome: z.enum(["APPROVED", "CHANGES_REQUESTED", "REJECTED"]),
    note: z.string().trim().max(2000).optional(),
    bookingIds: z.array(z.string().min(1)).default([]),
    reservationIds: z.array(z.string().min(1)).default([]),
  })
  .superRefine((value, ctx) => {
    if (value.outcome !== "APPROVED" && !value.note) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["note"], message: NOTE_REQUIRED });
    }
    if (
      value.outcome === "CHANGES_REQUESTED" &&
      value.bookingIds.length + value.reservationIds.length === 0
    ) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["bookingIds"], message: PICK_REQUIRED });
    }
  });

type Recorded = { status: "APPROVED" | "CHANGES_REQUESTED" | "REJECTED" };

/**
 * SCRUM-166 — a Safety Officer records a check's outcome.
 *
 * - Changes requested and Rejected need a note; Changes requested also names
 *   at least one of the event's bookings or reservations (AC3).
 * - Who and when are kept on the check, and every check stays (AC5).
 * - Only a Safety Officer who doesn't organise or coordinate the event (AC6).
 * - The update is conditional on the check still awaiting review, so a second
 *   recording, or a second officer at the same moment, changes nothing and is
 *   shown the outcome that stands (AC7, AC8). An Outdated check can't be
 *   approved for the same reason (AC13).
 * - Changes requested flags the picked arrangements with the note (AC10);
 *   Rejected flags all of the event's arrangements (AC11). The event stays in
 *   Planning either way, and approval doesn't confirm it (AC14).
 * - The Coordinator is notified of the outcome and the note (AC4).
 */
export async function recordSafetyCheckOutcome(
  input: unknown,
): Promise<ActionResult<Recorded>> {
  const session = await auth();
  const user = session?.user;

  try {
    requirePermission(user, "safety-check:review");

    const parsed = outcomeSchema.safeParse(input);
    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      return err(
        fieldErrors.note?.[0] ?? fieldErrors.bookingIds?.[0] ?? "Please choose an outcome.",
        fieldErrors,
      );
    }
    const { checkId, outcome, note, bookingIds, reservationIds } = parsed.data;

    const check = await prisma.safetyCheck.findUnique({
      where: { id: checkId },
      select: {
        eventId: true,
        event: {
          select: { organiserId: true, coordinatorId: true, status: true, name: true },
        },
      },
    });
    if (!check || !can(user!, "safety-check:review", { kind: "event", ...check.event })) {
      return err("Safety check not found.");
    }
    const { eventId, event } = check;

    const result = await prisma.$transaction(async (tx) => {
      // A shared lock: a status change (confirm, cancel, reject) waits for
      // this to finish, while two officers recording at once still proceed
      // and the conditional update below decides between them.
      await tx.$queryRaw`SELECT "id" FROM "Event" WHERE "id" = ${eventId} FOR SHARE`;
      const status = await tx.event.findUniqueOrThrow({
        where: { id: eventId },
        select: { status: true },
      });
      if (status.status !== "PLANNING") return { refused: "not-planning" as const };

      const now = new Date();
      if (outcome === "CHANGES_REQUESTED") {
        // Only arrangements a flag can sit on: not a hold past its expiry.
        const [bookings, reservations] = await Promise.all([
          tx.booking.count({
            where: { id: { in: bookingIds }, eventId, ...liveBookingWhere(now) },
          }),
          tx.reservation.count({
            where: { id: { in: reservationIds }, eventId, status: "CONFIRMED" },
          }),
        ]);
        if (bookings !== bookingIds.length || reservations !== reservationIds.length) {
          return { refused: "bad-pick" as const };
        }
      }

      const updated = await tx.safetyCheck.updateMany({
        where: { id: checkId, status: "AWAITING_REVIEW" },
        data: {
          status: outcome,
          note: note || null,
          decidedById: user!.id,
          decidedAt: now,
        },
      });
      if (updated.count !== 1) {
        const current = await tx.safetyCheck.findUniqueOrThrow({
          where: { id: checkId },
          select: {
            status: true,
            decidedAt: true,
            decidedBy: { select: { name: true } },
          },
        });
        return { refused: "decided" as const, current };
      }

      const reason = `Safety check ${SAFETY_CHECK_LABEL[outcome].toLowerCase()}: ${note}`;
      if (outcome === "CHANGES_REQUESTED") {
        await tx.safetyCheckArrangement.createMany({
          data: [
            ...bookingIds.map((bookingId) => ({ checkId, bookingId })),
            ...reservationIds.map((reservationId) => ({ checkId, reservationId })),
          ],
        });
        await flagArrangements(tx, { bookingIds, reservationIds }, reason, now);
      }
      if (outcome === "REJECTED") {
        await flagArrangements(tx, { eventId }, reason, now);
      }

      if (event.coordinatorId) {
        await tx.notification.create({
          data: {
            userId: event.coordinatorId,
            type: "SAFETY_CHECK_OUTCOME",
            title: `Safety check ${SAFETY_CHECK_LABEL[outcome].toLowerCase()}`,
            message: note
              ? `"${event.name}": ${SAFETY_CHECK_LABEL[outcome]}. ${note}`
              : `"${event.name}": ${SAFETY_CHECK_LABEL[outcome]}.`,
            link: "/events",
            eventId,
          },
        });
      }
      await tx.auditLog.create({
        data: {
          entityType: "SafetyCheck",
          entityId: checkId,
          action: outcome,
          actorId: user!.id,
          fieldName: "status",
          oldValue: "AWAITING_REVIEW",
          newValue: outcome,
          summary: note || undefined,
        },
      });
      return { recorded: outcome };
    });

    if ("refused" in result) {
      switch (result.refused) {
        case "not-planning":
          return err("This event is no longer in Planning, so its safety check can't be recorded.");
        case "bad-pick":
          return err("Pick only this event's current venue bookings or equipment reservations.");
        case "decided": {
          const { current } = result;
          // AC13: Outdated says why, not who recorded the outcome it replaced.
          if (current.status === "OUTDATED") {
            return err(
              "This check is Outdated because the event's arrangements changed; nothing was changed. The Coordinator needs to request a new one.",
            );
          }
          // Any other outcome records who and when (safety_check_outcome_recorded).
          return err(
            `This check is already ${SAFETY_CHECK_LABEL[current.status]} by ${current.decidedBy!.name} on ${formatDateTime(current.decidedAt!)}; nothing was changed.`,
          );
        }
      }
    }

    revalidatePath("/safety-checks");
    revalidatePath("/events");
    return ok({ status: result.recorded });
  } catch (error) {
    if (error instanceof PermissionError) return err(error.message);
    throw error;
  }
}
