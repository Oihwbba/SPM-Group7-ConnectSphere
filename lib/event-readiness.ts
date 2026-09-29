import type { Prisma, PrismaClient } from "@prisma/client";

/**
 * SCRUM-110 — the single definition of when a Planning event is ready to be
 * confirmed. SCRUM-81 owns the Planning → Confirmed transition and must call
 * this rather than restate any part of it (AC 8, AC 9). It only reads, so it
 * can run inside the caller's transaction.
 *
 * Every gap is reported, not just the first, so the Coordinator sees all
 * outstanding arrangements at once. Test cases: docs/testing/SCRUM-110.md.
 * Why each rule is the way it is: docs/adr/0011-event-confirmation-readiness-rule.md.
 */
export type ReadinessGap =
  | "EVENT_NOT_FOUND"
  | "NOT_IN_PLANNING"
  | "NO_APPROVED_VENUE_BOOKING"
  | "NO_CONFIRMED_EQUIPMENT_RESERVATION"
  | "UNRESOLVED_RECONSIDERATION";

export interface ConfirmationReadiness {
  ready: boolean;
  gaps: ReadinessGap[];
}

export async function getConfirmationReadiness(
  db: Prisma.TransactionClient | PrismaClient,
  eventId: string,
): Promise<ConfirmationReadiness> {
  const event = await db.event.findUnique({
    where: { id: eventId },
    select: {
      status: true,
      bookings: { select: { status: true, needsReconsideration: true } },
      equipmentRequests: { select: { status: true } },
      reservations: { select: { status: true, needsReconsideration: true } },
      // An event can have hundreds of registrations; only flagged ones matter.
      registrations: {
        where: { needsReconsideration: true },
        select: { status: true },
      },
    },
  });
  if (!event) return { ready: false, gaps: ["EVENT_NOT_FOUND"] };

  const gaps: ReadinessGap[] = [];

  if (event.status !== "PLANNING") gaps.push("NOT_IN_PLANNING");

  // AC 5: a venue booking is essential even when the Organiser gave no venue
  // requirement, so the requirement is deliberately not read.
  if (!event.bookings.some((b) => b.status === "APPROVED")) {
    gaps.push("NO_APPROVED_VENUE_BOOKING");
  }

  // A request Technical Support rejected still means the event needs equipment
  // it does not have; only a cancelled request stops equipment being required.
  // Reservations are not linked to a request when made (SCRUM-31), so any
  // confirmed reservation for the event satisfies AC 2.
  const needsEquipment = event.equipmentRequests.some(
    (r) => r.status !== "CANCELLED",
  );
  if (
    needsEquipment &&
    !event.reservations.some((r) => r.status === "CONFIRMED")
  ) {
    gaps.push("NO_CONFIRMED_EQUIPMENT_RESERVATION");
  }

  // A reconsideration flag (SCRUM-44) is resolved either by clearing it or by
  // the record leaving play: staff decide offline and the Coordinator records
  // the outcome, which may be a cancellation (customer ruling). So only records
  // still in play can hold confirmation back.
  const unresolved =
    event.bookings.some(
      (b) =>
        b.needsReconsideration &&
        (b.status === "PENDING" || b.status === "APPROVED"),
    ) ||
    event.reservations.some(
      (r) => r.needsReconsideration && r.status === "CONFIRMED",
    ) ||
    event.registrations.some((r) => r.status === "REGISTERED");
  if (unresolved) gaps.push("UNRESOLVED_RECONSIDERATION");

  return { ready: gaps.length === 0, gaps };
}
