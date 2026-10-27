import type { SafetyCheckStatus } from "@prisma/client";

import { prisma } from "@/lib/db";
import { can, type SessionUser } from "@/lib/auth/can";
import { reservingWhere } from "@/lib/booking-holds";

/** SCRUM-166 AC1 — one waiting check in the Safety Officers' queue. */
export interface QueuedSafetyCheck {
  id: string;
  requestedAt: Date;
  requestedBy: string;
  event: {
    name: string;
    startAt: Date | null;
    endAt: Date | null;
    expectedAttendance: number | null;
  };
}

/**
 * SCRUM-166 AC1 — checks awaiting review, oldest request first. A check for
 * an event the officer organises or coordinates is left out, since they may
 * not review it (AC6), and so is one for an event no longer in Planning,
 * since recording it would be refused.
 */
export async function getSafetyCheckQueue(
  user: SessionUser,
): Promise<QueuedSafetyCheck[]> {
  const checks = await prisma.safetyCheck.findMany({
    where: { status: "AWAITING_REVIEW", event: { status: "PLANNING" } },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      createdAt: true,
      requestedBy: { select: { name: true } },
      event: {
        select: {
          name: true,
          startAt: true,
          endAt: true,
          expectedAttendance: true,
          organiserId: true,
          coordinatorId: true,
          status: true,
        },
      },
    },
  });
  return checks
    .filter((c) => can(user, "safety-check:review", { kind: "event", ...c.event }))
    .map((c) => ({
      id: c.id,
      requestedAt: c.createdAt,
      requestedBy: c.requestedBy.name,
      event: {
        name: c.event.name,
        startAt: c.event.startAt,
        endAt: c.event.endAt,
        expectedAttendance: c.event.expectedAttendance,
      },
    }));
}

/**
 * SCRUM-211 AC2 — the queue's Decided filter: checks with an outcome
 * recorded, most recently decided first, for events this officer may review
 * (AC6). Read-only.
 */
export async function getDecidedSafetyChecks(
  user: SessionUser,
): Promise<(QueuedSafetyCheck & { status: SafetyCheckStatus })[]> {
  const checks = await prisma.safetyCheck.findMany({
    where: { status: { not: "AWAITING_REVIEW" } },
    orderBy: { decidedAt: "desc" },
    select: {
      id: true,
      status: true,
      createdAt: true,
      requestedBy: { select: { name: true } },
      event: {
        select: {
          name: true,
          startAt: true,
          endAt: true,
          expectedAttendance: true,
          organiserId: true,
          coordinatorId: true,
          status: true,
        },
      },
    },
  });
  return checks
    .filter((c) => can(user, "safety-check:review", { kind: "event", ...c.event }))
    .map((c) => ({
      id: c.id,
      status: c.status,
      requestedAt: c.createdAt,
      requestedBy: c.requestedBy.name,
      event: {
        name: c.event.name,
        startAt: c.event.startAt,
        endAt: c.event.endAt,
        expectedAttendance: c.event.expectedAttendance,
      },
    }));
}

export interface SafetyCheckReview {
  id: string;
  status: SafetyCheckStatus;
  note: string | null;
  requestedAt: Date;
  requestedBy: string;
  decidedAt: Date | null;
  decidedBy: string | null;
  event: {
    name: string;
    status: string;
    startAt: Date | null;
    endAt: Date | null;
    expectedAttendance: number | null;
    preferredLayout: string | null;
    accessibilityNeeds: string | null;
  };
  venues: {
    bookingId: string;
    name: string;
    status: string;
    capacity: number;
    bookedAttendance: number | null;
    requestedLayout: string | null;
    supportedLayouts: string[];
    accessibilityFeatures: string[];
    setupMinutes: number;
    turnaroundMinutes: number;
    knownRestrictions: string | null;
  }[];
  equipment: {
    reservationId: string;
    type: string;
    quantity: number;
    technicalSpecs: string | null;
    technicalRequirements: string | null;
  }[];
  /** AC2 — the event's operational notes (SCRUM-25 AC6), oldest first. */
  operationalNotes: { body: string; author: string; createdAt: Date }[];
  /** AC5 — the event's earlier checks, newest first. */
  history: {
    id: string;
    status: SafetyCheckStatus;
    note: string | null;
    decidedBy: string | null;
    decidedAt: Date | null;
    requestedAt: Date;
  }[];
}

/**
 * SCRUM-166 AC2, AC5 — everything a Safety Officer reviews, read-only: the
 * expected attendance; for each booked venue its capacity, the attendance
 * booked for it, the requested and supported layouts, the accessibility needs
 * and features, its setup and turnaround times and known restrictions; the
 * reserved equipment with each line's technical requirements, where placement
 * is noted; and the operational notes. Only bookings that reserve the venue
 * now count: Approved ones and holds not yet expired (SCRUM-163 AC4). Null
 * when the check doesn't exist or the officer may not review this event (AC6),
 * so neither case reveals which checks exist.
 */
export async function getSafetyCheckReview(
  user: SessionUser,
  checkId: string,
): Promise<SafetyCheckReview | null> {
  const check = await prisma.safetyCheck.findUnique({
    where: { id: checkId },
    select: {
      id: true,
      status: true,
      note: true,
      createdAt: true,
      decidedAt: true,
      requestedBy: { select: { name: true } },
      decidedBy: { select: { name: true } },
      event: {
        select: {
          id: true,
          name: true,
          status: true,
          organiserId: true,
          coordinatorId: true,
          startAt: true,
          endAt: true,
          expectedAttendance: true,
          preferredLayout: true,
          accessibilityNeeds: true,
          bookings: {
            where: reservingWhere(new Date()),
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              status: true,
              requestedAttendance: true,
              requestedLayout: true,
              setupMinutes: true,
              turnaroundMinutes: true,
              venue: {
                select: {
                  name: true,
                  capacity: true,
                  supportedLayouts: true,
                  accessibilityFeatures: true,
                  knownRestrictions: true,
                },
              },
            },
          },
          reservations: {
            where: { status: "CONFIRMED" },
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              equipmentId: true,
              quantity: true,
              equipment: { select: { type: true, technicalSpecs: true } },
              request: {
                select: {
                  lines: { select: { equipmentId: true, technicalRequirements: true } },
                },
              },
            },
          },
          operationalNotes: {
            orderBy: { createdAt: "asc" },
            select: { body: true, createdAt: true, author: { select: { name: true } } },
          },
          safetyChecks: {
            where: { id: { not: checkId } },
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              status: true,
              note: true,
              createdAt: true,
              decidedAt: true,
              decidedBy: { select: { name: true } },
            },
          },
        },
      },
    },
  });
  if (!check || !can(user, "safety-check:review", { kind: "event", ...check.event })) {
    return null;
  }

  const { event } = check;
  return {
    id: check.id,
    status: check.status,
    note: check.note,
    requestedAt: check.createdAt,
    requestedBy: check.requestedBy.name,
    decidedAt: check.decidedAt,
    decidedBy: check.decidedBy?.name ?? null,
    event: {
      name: event.name,
      status: event.status,
      startAt: event.startAt,
      endAt: event.endAt,
      expectedAttendance: event.expectedAttendance,
      preferredLayout: event.preferredLayout,
      accessibilityNeeds: event.accessibilityNeeds,
    },
    venues: event.bookings.map((b) => ({
      bookingId: b.id,
      name: b.venue.name,
      status: b.status,
      capacity: b.venue.capacity,
      bookedAttendance: b.requestedAttendance,
      requestedLayout: b.requestedLayout,
      supportedLayouts: b.venue.supportedLayouts,
      accessibilityFeatures: b.venue.accessibilityFeatures,
      setupMinutes: b.setupMinutes,
      turnaroundMinutes: b.turnaroundMinutes,
      knownRestrictions: b.venue.knownRestrictions,
    })),
    equipment: event.reservations.map((r) => ({
      reservationId: r.id,
      type: r.equipment.type,
      quantity: r.quantity,
      technicalSpecs: r.equipment.technicalSpecs,
      technicalRequirements:
        r.request?.lines.find((l) => l.equipmentId === r.equipmentId)
          ?.technicalRequirements ?? null,
    })),
    operationalNotes: event.operationalNotes.map((n) => ({
      body: n.body,
      author: n.author.name,
      createdAt: n.createdAt,
    })),
    history: event.safetyChecks.map((c) => ({
      id: c.id,
      status: c.status,
      note: c.note,
      decidedBy: c.decidedBy?.name ?? null,
      decidedAt: c.decidedAt,
      requestedAt: c.createdAt,
    })),
  };
}
