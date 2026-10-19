import type { EventStatus } from "@prisma/client";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { can } from "@/lib/auth/can";
import { getCoordinatorLoads } from "@/lib/coordinator-assignment";
import { parseSingaporeDateTime } from "@/lib/datetime";

/** Every status the list can show: all but Draft (SCRUM-141 AC1). */
export const LISTED_STATUSES = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "APPROVED",
  "PLANNING",
  "CONFIRMED",
  "COMPLETED",
  "CANCELLED",
  "REJECTED",
] as const satisfies readonly EventStatus[];

export type AllEventsFilters = {
  status?: (typeof LISTED_STATUSES)[number];
  from?: string;
  to?: string;
  coordinatorId?: string;
  unassigned: boolean;
};

type Params = Record<string, string | string[] | undefined>;

const one = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;
const isDay = (value: string | undefined): value is string =>
  !!value && /^\d{4}-\d{2}-\d{2}$/.test(value);

/** SCRUM-141 AC2 — the filters from the page's URL; anything malformed is
 * ignored rather than refused, so a bad link still shows the list. */
export function parseAllEventsFilters(params: Params): AllEventsFilters {
  const status = one(params.status);
  const from = one(params.from);
  const to = one(params.to);
  const coordinatorId = one(params.coordinator);
  return {
    status: (LISTED_STATUSES as readonly string[]).includes(status ?? "")
      ? (status as AllEventsFilters["status"])
      : undefined,
    from: isDay(from) ? from : undefined,
    to: isDay(to) ? to : undefined,
    coordinatorId: coordinatorId || undefined,
    unassigned: one(params.unassigned) === "1",
  };
}

/** The start of a day in Singapore time (SCRUM-129), as a UTC instant. */
function startOfDay(day: string): Date {
  return parseSingaporeDateTime(`${day}T00:00`)!;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * SCRUM-141 AC1, AC2, AC5 — every event except Drafts, soonest first, with
 * its status, every booked venue and its Coordinator. Coordinators, Venue
 * Staff, Technical Support and the Lead may see it (AC6). The Lead's own
 * filters (by Coordinator, Unassigned only) and each Coordinator's active
 * events are given to the Lead alone.
 */
export async function getAllEvents(filters: AllEventsFilters) {
  const session = await auth();
  if (!session?.user || !can(session.user, "event:view-all")) return null;
  // The Lead's tools follow the permission to assign (SCRUM-165), never the role name.
  const isLead = can(session.user, "event:assign");

  const startAt =
    filters.from || filters.to
      ? {
          ...(filters.from ? { gte: startOfDay(filters.from) } : {}),
          // Inclusive of the whole "to" day.
          ...(filters.to
            ? { lt: new Date(startOfDay(filters.to).getTime() + DAY_MS) }
            : {}),
        }
      : undefined;

  const coordinatorId = !isLead
    ? undefined
    : filters.unassigned
      ? null
      : filters.coordinatorId;

  const events = await prisma.event.findMany({
    where: {
      status: filters.status ?? { not: "DRAFT" },
      ...(startAt ? { startAt } : {}),
      ...(coordinatorId !== undefined ? { coordinatorId } : {}),
    },
    select: {
      id: true,
      name: true,
      status: true,
      startAt: true,
      endAt: true,
      coordinatorId: true,
      coordinator: { select: { name: true } },
      bookings: {
        where: { status: "APPROVED" },
        orderBy: { startAt: "asc" },
        select: { venue: { select: { name: true } } },
      },
    },
    orderBy: [{ startAt: "asc" }, { name: "asc" }],
  });

  return {
    events,
    isLead,
    coordinators: isLead ? await getCoordinatorLoads(prisma) : [],
  };
}

export type ListedEvent = NonNullable<
  Awaited<ReturnType<typeof getAllEvents>>
>["events"][number];

/**
 * SCRUM-141 AC3, AC4 — one event's details, read-only, for anyone who may see
 * the list. Drafts and missing ids look the same (not found). Whether the
 * viewer may edit it, or as the Lead assign it, is said alongside, so the
 * page offers only those links.
 */
export async function getEventForPlanning(id: string) {
  const session = await auth();
  if (!session?.user || !can(session.user, "event:view-all")) return null;

  const event = await prisma.event.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      purpose: true,
      description: true,
      status: true,
      startAt: true,
      endAt: true,
      expectedAttendance: true,
      venueRequirements: true,
      accessibilityNeeds: true,
      preferredLayout: true,
      equipmentRequirements: true,
      organiserId: true,
      coordinatorId: true,
      organiser: { select: { name: true } },
      coordinator: { select: { name: true } },
      bookings: {
        where: { status: "APPROVED" },
        orderBy: { startAt: "asc" },
        select: { venue: { select: { name: true, location: true } } },
      },
    },
  });
  if (!event || event.status === "DRAFT") return null;

  const resource = {
    kind: "event" as const,
    organiserId: event.organiserId,
    coordinatorId: event.coordinatorId,
    status: event.status,
  };
  // SCRUM-21: the Lead reassigns, choosing from every Coordinator except
  // the event's own Organiser (AC3).
  const canReassign = can(session.user, "event:reassign", resource);
  return {
    event,
    canEdit: can(session.user, "event:edit", resource),
    canAssign: can(session.user, "event:assign", resource),
    canReassign,
    coordinators: canReassign
      ? (await getCoordinatorLoads(prisma)).filter(
          (c) => c.id !== event.organiserId,
        )
      : [],
  };
}
