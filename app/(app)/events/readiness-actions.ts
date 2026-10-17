"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { can, type Resource, type SessionUser } from "@/lib/auth/can";
import {
  getConfirmedArrangements,
  getReadinessChecklist,
  withoutInternalReasons,
  type ConfirmedArrangements,
  type ReadinessChecklist,
} from "@/lib/event-readiness";
import { ok, err, type ActionResult } from "@/lib/action-result";

/**
 * The event, if the signed-in user is its Organiser or its Coordinator.
 * Anyone else gets the same "not found" as a missing event, so the answer never
 * reveals which event ids exist (SCRUM-68).
 */
async function relatedEvent(
  eventId: string,
): Promise<{ user: SessionUser; resource: Resource } | null> {
  const session = await auth();
  const user = session?.user;
  if (!user) return null;

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { organiserId: true, coordinatorId: true, status: true },
  });
  const resource: Resource | null = event && { kind: "event", ...event };
  if (!resource || !can(user, "event:read", resource)) return null;
  return { user, resource };
}

/**
 * SCRUM-110 AC 6 — the readiness checklist for the event page. The event's
 * Coordinator sees it in full; its Organiser sees the same items and states
 * without internal reasons. `canConfirm` tells the page whether to offer
 * SCRUM-81's Confirm action, which only the assigned Coordinator may take;
 * `canReject` whether to offer SCRUM-117's Reject, which the same Coordinator
 * may take unless the event was ever Confirmed (AC 4). `canSettleHold` whether
 * to offer confirming or releasing a venue hold (SCRUM-163 AC3), which only the
 * assigned Coordinator may do, `canWithdrawBooking` whether to offer
 * withdrawing a pending venue request (SCRUM-142 AC4), and
 * `canRecordNoEquipment` whether to offer No equipment needed (SCRUM-170 AC4).
 */
export async function getEventReadiness(
  eventId: string,
): Promise<
  ActionResult<
    ReadinessChecklist & {
      canConfirm: boolean;
      canReject: boolean;
      canSettleHold: boolean;
      canWithdrawBooking: boolean;
      canRecordNoEquipment: boolean;
    }
  >
> {
  const related = await relatedEvent(eventId);
  if (!related) return err("Event not found.");
  const { user, resource } = related;

  const checklist = await getReadinessChecklist(prisma, eventId);
  if (!checklist) return err("Event not found.");

  // Reviewing the event is the Coordinator's relationship to it; reading alone
  // is the Organiser's, who is not shown Venue Staff's internal reasons.
  const visible = can(user, "event:review", resource)
    ? checklist
    : withoutInternalReasons(checklist);
  const canReject =
    can(user, "event:reject", resource) &&
    (await prisma.auditLog.count({
      where: {
        entityType: "Event",
        entityId: eventId,
        fieldName: "status",
        newValue: "CONFIRMED",
      },
    })) === 0;
  return ok({
    ...visible,
    canConfirm: can(user, "event:confirm", resource),
    canReject,
    canSettleHold: can(user, "booking:settle-hold", resource),
    canWithdrawBooking: can(user, "booking:withdraw", resource),
    canRecordNoEquipment: can(user, "event:no-equipment", resource),
  });
}

/**
 * SCRUM-81 AC 6 — a Confirmed event's secured venue, date/time and equipment,
 * for its Organiser and Coordinator.
 */
export async function getEventArrangements(
  eventId: string,
): Promise<ActionResult<ConfirmedArrangements>> {
  if (!(await relatedEvent(eventId))) return err("Event not found.");

  const arrangements = await getConfirmedArrangements(prisma, eventId);
  if (!arrangements) return err("Event not found.");
  return ok(arrangements);
}
