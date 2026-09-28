import { prisma } from "@/lib/db";
import { REQUESTABLE_EVENT_STATUSES } from "@/lib/equipment/requests";

/**
 * The reads behind the Equipment Requests page (SCRUM-27). They take the
 * signed-in user's id from the page, never from the client, which is why they
 * live here and not in a "use server" file: every export of one of those is a
 * public endpoint, and these must not be callable with someone else's id.
 */

/** Must mirror `can()`'s coordinator relationship with an event exactly. */
function coordinatorEventScope(coordinatorId: string) {
  return {
    OR: [
      { coordinatorId },
      { coordinatorId: null, status: { not: "DRAFT" as const } },
    ],
  };
}

/** AC 1 — the events a coordinator can link a request to, with their dates. */
export async function getRequestableEvents(coordinatorId: string) {
  return prisma.event.findMany({
    where: {
      AND: [
        coordinatorEventScope(coordinatorId),
        { status: { in: [...REQUESTABLE_EVENT_STATUSES] } },
      ],
    },
    select: { id: true, name: true, startAt: true, endAt: true },
    orderBy: { startAt: "asc" },
  });
}

/** AC 2 — the predefined system list of equipment types. */
export async function getEquipmentCatalogue() {
  return prisma.equipment.findMany({
    where: { isActive: true },
    select: { id: true, type: true, totalQuantity: true, technicalSpecs: true },
    orderBy: { type: "asc" },
  });
}

/** The requests raised for this coordinator's events, newest first. */
export async function getCoordinatorEquipmentRequests(coordinatorId: string) {
  return prisma.equipmentRequest.findMany({
    where: { event: coordinatorEventScope(coordinatorId) },
    select: {
      id: true,
      status: true,
      notes: true,
      createdAt: true,
      event: { select: { id: true, name: true, startAt: true, endAt: true } },
      lines: {
        select: {
          id: true,
          quantity: true,
          technicalRequirements: true,
          equipment: { select: { id: true, type: true } },
        },
        // Lines are inserted together and can share a timestamp; the id
        // (a cuid, which grows with each insert) keeps them in entry order.
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export type CoordinatorEquipmentRequest = Awaited<
  ReturnType<typeof getCoordinatorEquipmentRequests>
>[number];
