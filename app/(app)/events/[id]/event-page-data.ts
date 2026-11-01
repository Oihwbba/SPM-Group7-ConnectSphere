import type { Event, EventStatus } from "@prisma/client";

import { prisma } from "@/lib/db";
import { can, type SessionUser } from "@/lib/auth/can";
import { isOverdue } from "@/lib/event-closing";
import {
  getReadinessChecklist,
  withoutInternalReasons,
} from "@/lib/event-readiness";
import { nextStep, type NextStep } from "@/lib/event-next-step";
import { flaggedLiveBookingWhere } from "@/lib/reconsideration";

export type EventPageData = {
  event: Event;
  viewer: "organiser" | "coordinator";
  organiserName: string | null;
  coordinatorName: string | null;
  step: NextStep;
  /** For a Cancelled event, the status it was cancelled from. */
  cancelledFrom: EventStatus | null;
  /** What the tabs show as needing attention, and their empty states. */
  attention: {
    openClarification: boolean;
    pendingChangeRequests: number;
    flaggedArrangements: number;
    /**
     * Arrangements still flagged Needs Reconsideration, for any viewer, at
     * any status: the Changes tab lists them and never says nothing is flagged
     * while one is (SCRUM-208). Only the Coordinator's count asks for action.
     */
    unresolvedFlags: number;
  };
};

/**
 * SCRUM-208 — the event as its own page shows it, for its Organiser or its
 * assigned Coordinator (AC1, SCRUM-69). Anyone else, a discarded draft
 * (SCRUM-130) or an id that doesn't exist gets null, so the page answers
 * "not found" the same way for all of them (AC5, SCRUM-68). The role and the
 * relationship are checked by `can()` before anything else is read.
 */
export async function getEventPageData(
  user: SessionUser,
  eventId: string,
): Promise<EventPageData | null> {
  const row = await prisma.event.findFirst({
    where: { id: eventId, discardedAt: null },
    include: {
      organiser: { select: { name: true } },
      coordinator: { select: { name: true } },
    },
  });
  if (!row) return null;
  const resource = {
    kind: "event" as const,
    organiserId: row.organiserId,
    coordinatorId: row.coordinatorId,
    status: row.status,
  };
  if (!can(user, "event:read", resource)) return null;

  const { organiser, coordinator, ...event } = row;
  // Reviewing is the Coordinator's relationship to the event; reading alone
  // is the Organiser's (as getEventReadiness decides it).
  const viewer = can(user, "event:review", resource) ? "coordinator" : "organiser";
  const reconsiders = can(user, "arrangement:reconsider", resource);
  const now = new Date();

  const [
    openClarifications,
    pendingChangeRequests,
    flaggedBookings,
    flaggedReservations,
    checklist,
    cancellation,
  ] =
    await Promise.all([
      prisma.clarificationRequest.count({ where: { eventId, status: "OPEN" } }),
      prisma.eventChangeRequest.count({ where: { eventId, status: "PENDING_REVIEW" } }),
      prisma.booking.count({ where: { eventId, ...flaggedLiveBookingWhere(now) } }),
      prisma.reservation.count({
        where: { eventId, needsReconsideration: true, status: "CONFIRMED" },
      }),
      event.status === "PLANNING" || event.status === "APPROVED"
        ? getReadinessChecklist(prisma, eventId, now)
        : null,
      event.status === "CANCELLED"
        ? prisma.auditLog.findFirst({
            where: {
              entityType: "Event",
              entityId: eventId,
              fieldName: "status",
              newValue: "CANCELLED",
            },
            select: { oldValue: true },
            orderBy: { createdAt: "desc" },
          })
        : null,
    ]);

  const unresolvedFlags = flaggedBookings + flaggedReservations;
  // Only the Coordinator, who may resolve them, is asked to act on them.
  const flaggedArrangements = reconsiders ? unresolvedFlags : 0;
  const step = nextStep({
    status: event.status,
    viewer,
    coordinatorName: coordinator?.name ?? null,
    organiserName: organiser.name,
    openClarification: openClarifications > 0,
    pendingChangeRequests,
    flaggedArrangements,
    // The Organiser isn't shown Venue Staff's internal reasons (SCRUM-110 AC6).
    checklist:
      checklist && (viewer === "coordinator" ? checklist : withoutInternalReasons(checklist)),
    decisionReason: event.decisionReason,
    rejectionOutcome: event.rejectionOutcome,
    cancellationReason: event.cancellationReason,
    cancelledAt: event.cancelledAt?.toISOString() ?? null,
    overdue: isOverdue(event, now),
  });

  return {
    event,
    viewer,
    organiserName: organiser.name,
    coordinatorName: coordinator?.name ?? null,
    step,
    cancelledFrom: (cancellation?.oldValue as EventStatus | undefined) ?? null,
    attention: {
      openClarification: openClarifications > 0,
      pendingChangeRequests,
      flaggedArrangements,
      unresolvedFlags,
    },
  };
}
