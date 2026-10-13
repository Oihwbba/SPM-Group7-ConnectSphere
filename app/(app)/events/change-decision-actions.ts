"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ChangeRequestStatus, EventStatus } from "@prisma/client";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { can, requirePermission, PermissionError } from "@/lib/auth/can";
import { ok, err, type ActionResult } from "@/lib/action-result";
import { auditValue } from "@/lib/audit-value";
import {
  describeChanges,
  eventUpdateFrom,
  isImpactful,
  outdatesSafetyCheck,
} from "@/lib/change-application";
import { cancelInTransaction } from "@/lib/event-closing";
import { EQUIPMENT_REQUEST_STATUS_LABEL } from "@/lib/equipment/requests";
import { flagArrangements, flaggableArrangements } from "@/lib/reconsideration";
import { outdateSafetyChecks } from "@/lib/safety-check";
import { CHANGE_KEYS, CHANGE_REQUEST_STATUS_LABEL } from "@/lib/schemas/change-request";

const REASON_REQUIRED = "A reason is required to reject a change request.";

const decisionSchema = z.object({
  changeRequestId: z.string().min(1),
  decision: z.enum(["APPROVED", "REJECTED"]),
  reason: z.string().trim().max(2000).optional(),
});

/** The statuses a change request can be raised and applied in (SCRUM-41 AC1). */
const CHANGEABLE: EventStatus[] = ["UNDER_REVIEW", "PLANNING", "CONFIRMED"];

const CURRENT_VALUES = Object.fromEntries(CHANGE_KEYS.map((key) => [key, true])) as {
  [K in (typeof CHANGE_KEYS)[number]]: true;
};

export type ChangeDecisionView = {
  changeRequestId: string;
  requestsCancellation: boolean;
  impactful: boolean;
  /** AC1 — each changed field's value now, beside the requested one. */
  fields: { fieldName: string; current: string | null; requested: string | null }[];
  /** AC1 — the arrangements the change could affect. */
  affected: string[];
};

/**
 * SCRUM-128 AC1 — what the assigned Coordinator sees before deciding the
 * event's Submitted change request: each changed field's current and
 * requested value, and, for an impactful change or a cancellation, every
 * venue booking, hold, pending venue request, equipment request and
 * reservation it could affect. `null` when nothing awaits a decision; "not
 * found" for anyone who may not decide it.
 */
export async function getChangeDecision(
  eventId: string,
): Promise<ActionResult<ChangeDecisionView | null>> {
  const session = await auth();
  const user = session?.user;
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      ...CURRENT_VALUES,
      organiserId: true,
      coordinatorId: true,
      status: true,
      changeRequests: {
        where: { status: "PENDING_REVIEW" },
        select: {
          id: true,
          requestsCancellation: true,
          fields: { select: { fieldName: true, newValue: true, isMajor: true } },
        },
      },
      equipmentRequests: {
        where: { status: { in: ["PENDING_REVIEW", "IN_REVIEW", "APPROVED"] } },
        select: { status: true },
      },
    },
  });
  if (!user || !event || !can(user, "change-request:decide", { kind: "event", ...event })) {
    return err("Event not found.");
  }
  const pending = event.changeRequests[0];
  if (!pending) return ok(null);

  const impactful = isImpactful(pending.fields);
  const affected =
    impactful || pending.requestsCancellation
      ? [
          ...(await flaggableArrangements(prisma, eventId)).map((a) => a.label),
          ...event.equipmentRequests.map(
            (r) => `Equipment request (${EQUIPMENT_REQUEST_STATUS_LABEL[r.status]})`,
          ),
        ]
      : [];

  return ok({
    changeRequestId: pending.id,
    requestsCancellation: pending.requestsCancellation,
    impactful,
    fields: pending.fields.map(({ fieldName, newValue }) => ({
      fieldName,
      current: auditValue(event[fieldName as keyof typeof CURRENT_VALUES]),
      requested: newValue,
    })),
    affected,
  });
}

type Outcome =
  | { done: "APPROVED" | "REJECTED"; returnedToPlanning: boolean }
  | { refused: "reassigned" | "not-changeable" }
  | { refused: "decided"; status: ChangeRequestStatus }
  | { refused: "attendance"; registered: number };

/**
 * SCRUM-128 — the assigned Coordinator decides a Submitted change request.
 *
 * - **Reject** needs a non-blank reason and leaves the event as it is (AC3).
 * - **Approve** applies the requested values and marks the request Approved in
 *   one transaction (AC2), unless the expected attendance would drop below the
 *   active registrations (AC7). An impactful change flags the event's
 *   arrangements (SCRUM-26) and puts an approved or awaiting safety check out
 *   of date (AC4, SCRUM-166 AC13), and returns a Confirmed event to Planning,
 *   where registration pauses until it is confirmed again (AC5, SCRUM-75);
 *   otherwise the status stays (AC6). Approving a cancellation request cancels
 *   the event as SCRUM-82 does, with the Organiser's reason (AC8).
 * - Only the assigned Coordinator (AC9). Who and when are recorded, and the
 *   Organiser is notified (AC10).
 *
 * The event row is locked first, as raising a request does (SCRUM-41), so a
 * second decision, a new request or a confirm takes turns with this one.
 */
export async function decideChangeRequest(
  input: unknown,
): Promise<ActionResult<{ decision: "APPROVED" | "REJECTED"; returnedToPlanning: boolean }>> {
  const session = await auth();
  const user = session?.user;

  try {
    requirePermission(user, "change-request:decide");

    const parsed = decisionSchema.safeParse(input);
    if (!parsed.success) return err("Please choose Approve or Reject.");
    const { changeRequestId, decision, reason } = parsed.data;
    if (decision === "REJECTED" && !reason) {
      return err(REASON_REQUIRED, { reason: [REASON_REQUIRED] });
    }

    const found = await prisma.eventChangeRequest.findUnique({
      where: { id: changeRequestId },
      select: {
        eventId: true,
        event: { select: { organiserId: true, coordinatorId: true, status: true } },
      },
    });
    if (
      !found ||
      !can(user!, "change-request:decide", { kind: "event", ...found.event })
    ) {
      return err("Change request not found.");
    }
    const { eventId } = found;

    const outcome = await prisma.$transaction(async (tx): Promise<Outcome> => {
      await tx.$queryRaw`SELECT "id" FROM "Event" WHERE "id" = ${eventId} FOR UPDATE`;
      const event = await tx.event.findUniqueOrThrow({
        where: { id: eventId },
        select: { status: true, coordinatorId: true, organiserId: true, name: true },
      });
      if (event.coordinatorId !== user!.id) return { refused: "reassigned" };

      const request = await tx.eventChangeRequest.findUniqueOrThrow({
        where: { id: changeRequestId },
        select: {
          status: true,
          reason: true,
          requestsCancellation: true,
          fields: {
            select: { fieldName: true, oldValue: true, newValue: true, isMajor: true },
          },
        },
      });
      if (request.status !== "PENDING_REVIEW") {
        return { refused: "decided", status: request.status };
      }
      if (!CHANGEABLE.includes(event.status)) return { refused: "not-changeable" };

      const now = new Date();
      const decided = { decidedById: user!.id, decidedAt: now };
      const notify = (title: string, message: string) =>
        tx.notification.create({
          data: {
            userId: event.organiserId,
            type: "CHANGE_REQUEST_OUTCOME",
            title,
            message,
            link: "/events",
            eventId,
          },
        });

      if (decision === "REJECTED") {
        await tx.eventChangeRequest.update({
          where: { id: changeRequestId },
          data: { ...decided, status: "REJECTED", decisionReason: reason },
        });
        await tx.auditLog.create({
          data: {
            entityType: "EventChangeRequest",
            entityId: changeRequestId,
            action: "REJECTED",
            actorId: user!.id,
            fieldName: "status",
            oldValue: "PENDING_REVIEW",
            newValue: "REJECTED",
            summary: reason,
          },
        });
        await notify(
          "Change request rejected",
          `Your change request for "${event.name}" was rejected: ${reason}`,
        );
        return { done: "REJECTED", returnedToPlanning: false };
      }

      // AC7: the attendance can't fall below the places already taken.
      const attendance = request.fields.find((f) => f.fieldName === "expectedAttendance");
      if (attendance?.newValue) {
        const registered = await tx.registration.count({
          where: { eventId, status: "REGISTERED" },
        });
        if (Number(attendance.newValue) < registered) {
          return { refused: "attendance", registered };
        }
      }

      // Marked Approved before a cancellation releases the event's arrangements,
      // which rejects any change request still Submitted (SCRUM-82 AC3).
      await tx.eventChangeRequest.update({
        where: { id: changeRequestId },
        data: { ...decided, status: "APPROVED" },
      });
      await tx.auditLog.create({
        data: {
          entityType: "EventChangeRequest",
          entityId: changeRequestId,
          action: "APPROVED",
          actorId: user!.id,
          fieldName: "status",
          oldValue: "PENDING_REVIEW",
          newValue: "APPROVED",
        },
      });

      if (request.requestsCancellation) {
        // AC8: SCRUM-82's cancellation, which notifies the Organiser.
        await cancelInTransaction(tx, {
          eventId,
          name: event.name,
          organiserId: event.organiserId,
          fromStatus: event.status,
          actorId: user!.id,
          reason: request.reason!,
        });
        return { done: "APPROVED", returnedToPlanning: false };
      }

      const impactful = isImpactful(request.fields);
      const returnedToPlanning = impactful && event.status === "CONFIRMED";
      await tx.event.update({
        where: { id: eventId },
        data: {
          ...eventUpdateFrom(request.fields),
          ...(returnedToPlanning && { status: "PLANNING" as const }),
        },
      });
      // Who changed each value and when (AC10).
      await tx.auditLog.createMany({
        data: [
          ...request.fields.map((field) => ({
            entityType: "Event",
            entityId: eventId,
            action: "UPDATED",
            actorId: user!.id,
            fieldName: field.fieldName,
            oldValue: field.oldValue,
            newValue: field.newValue,
            summary: `Change request ${changeRequestId} approved (SCRUM-128)`,
          })),
          ...(returnedToPlanning
            ? [
                {
                  entityType: "Event",
                  entityId: eventId,
                  action: "STATUS_CHANGED",
                  actorId: user!.id,
                  fieldName: "status",
                  oldValue: "CONFIRMED",
                  newValue: "PLANNING",
                  summary: "An impactful change was approved (SCRUM-128)",
                },
              ]
            : []),
        ],
      });

      const changed = describeChanges(request.fields);
      if (impactful) {
        await flagArrangements(tx, { eventId }, `Change approved: ${changed}.`, now);
      }
      if (outdatesSafetyCheck(request.fields)) {
        await outdateSafetyChecks(tx, eventId, now);
      }
      await notify(
        "Change request approved",
        `Your change request for "${event.name}" was approved: ${changed}.`,
      );
      return { done: "APPROVED", returnedToPlanning };
    });

    if ("refused" in outcome) {
      switch (outcome.refused) {
        case "reassigned":
          return err("This event was updated by another user. Refresh and try again.");
        case "decided":
          return err(
            `This change request is already ${CHANGE_REQUEST_STATUS_LABEL[outcome.status]}; nothing was changed.`,
          );
        case "not-changeable":
          return err("This event can no longer be changed, so the request can't be applied.");
        case "attendance":
          return err(
            `The expected attendance can't be lower than the ${outcome.registered} active registrations, so this change can't be approved.`,
          );
      }
    }

    revalidatePath("/events");
    revalidatePath("/registrations");
    return ok({ decision: outcome.done, returnedToPlanning: outcome.returnedToPlanning });
  } catch (error) {
    if (error instanceof PermissionError) return err(error.message);
    throw error;
  }
}
