"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { can, type Resource } from "@/lib/auth/can";
import {
  getReadinessChecklist,
  withoutInternalReasons,
  type ReadinessChecklist,
} from "@/lib/event-readiness";
import { ok, err, type ActionResult } from "@/lib/action-result";

/**
 * SCRUM-110 AC 6 — the readiness checklist for the event page. The event's
 * Coordinator sees it in full; its Organiser sees the same items and states
 * without internal reasons. Anyone else gets the same "not found" as a missing
 * event, so the answer never reveals which event ids exist (SCRUM-68).
 */
export async function getEventReadiness(
  eventId: string,
): Promise<ActionResult<ReadinessChecklist>> {
  const session = await auth();
  const user = session?.user;
  if (!user) return err("Event not found.");

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { organiserId: true, coordinatorId: true, status: true },
  });
  const resource: Resource | null = event && { kind: "event", ...event };
  if (!resource || !can(user, "event:read", resource))
    return err("Event not found.");

  const checklist = await getReadinessChecklist(prisma, eventId);
  if (!checklist) return err("Event not found.");

  // Reviewing the event is the Coordinator's relationship to it; reading alone
  // is the Organiser's, who is not shown Venue Staff's internal reasons.
  return ok(
    can(user, "event:review", resource)
      ? checklist
      : withoutInternalReasons(checklist),
  );
}
