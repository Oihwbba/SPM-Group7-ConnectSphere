import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { can } from "@/lib/auth/can";
import {
  getCoordinatorLoads,
  suggestCoordinator,
} from "@/lib/coordinator-assignment";
// SCRUM-165 AC2: Overdue is SCRUM-82 AC10's rule, the same in the
// Coordinator's list and here: the start has passed.
import { isOverdue } from "@/lib/event-closing";

const UNASSIGNED = { status: "SUBMITTED", coordinatorId: null } as const;

/**
 * SCRUM-165 AC2, AC10 — every request waiting for a Coordinator, oldest
 * submission first. Only Leads can see it; every Lead sees all of it (W9:
 * "multiple leads … should be able to see all unassigned events").
 */
export async function getUnassignedQueue() {
  const session = await auth();
  if (!session?.user || !can(session.user, "event:assign")) return [];

  const requests = await prisma.event.findMany({
    where: UNASSIGNED,
    select: {
      id: true,
      name: true,
      startAt: true,
      endAt: true,
      expectedAttendance: true,
      submittedAt: true,
      organiser: { select: { name: true } },
    },
    orderBy: { submittedAt: "asc" },
  });

  const now = new Date();
  return requests.map((request) => ({
    ...request,
    overdue: isOverdue({ status: "SUBMITTED", startAt: request.startAt }, now),
  }));
}

export type QueueEntry = Awaited<ReturnType<typeof getUnassignedQueue>>[number];

/**
 * SCRUM-165 AC3, AC4 — one queued request's basic information, read-only,
 * with every Coordinator's active-event count and the least-loaded one
 * suggested. Null for anyone who isn't a Lead, a missing id, or a request
 * that is no longer unassigned, so it can't be used to probe other events.
 */
export async function getQueueRequest(id: string) {
  const session = await auth();
  if (!session?.user || !can(session.user, "event:assign")) return null;

  const request = await prisma.event.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      purpose: true,
      description: true,
      status: true,
      coordinatorId: true,
      organiserId: true,
      startAt: true,
      endAt: true,
      expectedAttendance: true,
      venueRequirements: true,
      accessibilityNeeds: true,
      preferredLayout: true,
      equipmentRequirements: true,
      submittedAt: true,
      organiser: { select: { name: true } },
    },
  });
  if (
    !request ||
    !can(session.user, "event:assign", {
      kind: "event",
      organiserId: request.organiserId,
      coordinatorId: request.coordinatorId,
      status: request.status,
    })
  ) {
    return null;
  }

  // SCRUM-165 AC7: the event's own Organiser is never offered.
  const coordinators = (await getCoordinatorLoads(prisma)).filter(
    (coordinator) => coordinator.id !== request.organiserId,
  );

  return {
    request: { ...request, overdue: isOverdue(request) },
    coordinators,
    suggestedId: suggestCoordinator(coordinators),
  };
}

/**
 * SCRUM-211 AC2 — the queue's Decided filter: requests a Lead has assigned
 * from it (they carry the supervising Lead, SCRUM-165 AC11), with who now
 * coordinates them. Read-only, and only for Leads, as the queue itself.
 */
export async function getAssignedFromQueue() {
  const session = await auth();
  if (!session?.user || !can(session.user, "event:assign")) return [];

  return prisma.event.findMany({
    where: { supervisingLeadId: { not: null }, NOT: UNASSIGNED },
    select: {
      id: true,
      name: true,
      purpose: true,
      description: true,
      startAt: true,
      endAt: true,
      expectedAttendance: true,
      venueRequirements: true,
      accessibilityNeeds: true,
      preferredLayout: true,
      equipmentRequirements: true,
      submittedAt: true,
      organiser: { select: { name: true } },
      coordinator: { select: { name: true } },
    },
    orderBy: { submittedAt: "asc" },
  });
}

export type AssignedEntry = Awaited<ReturnType<typeof getAssignedFromQueue>>[number];
