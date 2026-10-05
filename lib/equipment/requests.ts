import type { EquipmentRequestStatus, EventStatus } from "@prisma/client";

import { formatDateTime } from "@/lib/datetime";

/** SCRUM-27 AC 1 — the event a request is for, identified by its dates. */
export function formatEventPeriod(event: {
  startAt: Date | null;
  endAt: Date | null;
}): string {
  if (!event.startAt || !event.endAt) return "Dates to be confirmed";
  return `${formatDateTime(event.startAt)} – ${formatDateTime(event.endAt)}`;
}

/**
 * SCRUM-27 AC 1 — an equipment request is raised for an event that is going
 * ahead but whose details can still change. Earlier statuses may still be
 * rejected, the later ones are finished, and a Confirmed event's details are
 * fixed, so equipment has to be arranged before then.
 */
export const REQUESTABLE_EVENT_STATUSES = [
  "APPROVED",
  "PLANNING",
] as const satisfies readonly EventStatus[];

/**
 * SCRUM-27 AC 7 — a request still waiting on Technical Support. Must match
 * the partial unique index "EquipmentRequest_one_open_per_event", which
 * allows at most one request in these statuses per event.
 */
export const OPEN_REQUEST_STATUSES = [
  "PENDING_REVIEW",
  "IN_REVIEW",
] as const satisfies readonly EquipmentRequestStatus[];

/** The words the stories use: "Pending Review", "In Review", "Approved"… */
export const EQUIPMENT_REQUEST_STATUS_LABEL: Record<
  EquipmentRequestStatus,
  string
> = {
  PENDING_REVIEW: "Pending Review",
  IN_REVIEW: "In Review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled",
};

/**
 * SCRUM-28 AC 2 — the moves Technical Support can make. A request is taken
 * into review first, so the coordinator can see someone is working on it, and
 * only a request in review is approved or rejected. Decided is final.
 */
const REVIEW_TRANSITIONS: Partial<
  Record<EquipmentRequestStatus, readonly EquipmentRequestStatus[]>
> = {
  PENDING_REVIEW: ["IN_REVIEW"],
  IN_REVIEW: ["APPROVED", "REJECTED"],
};

export function canMoveRequest(
  from: EquipmentRequestStatus,
  to: EquipmentRequestStatus,
): boolean {
  return REVIEW_TRANSITIONS[from]?.includes(to) ?? false;
}

export type PoolAvailability = Record<
  string,
  { available: number; total: number }
>;

/**
 * SCRUM-28 AC 1 & 3 — one requested line against what is free for its event.
 * A short line lists the other types that could cover the whole quantity,
 * which is what Technical Support may suggest instead.
 */
export function reviewLine(
  line: { equipmentId: string; quantity: number },
  pool: PoolAvailability,
  catalogue: { id: string; type: string }[],
) {
  const { available, total } = pool[line.equipmentId] ?? {
    available: 0,
    total: 0,
  };
  const shortfall = Math.max(0, line.quantity - available);
  const alternatives = shortfall
    ? catalogue
        .filter(
          (item) =>
            item.id !== line.equipmentId &&
            (pool[item.id]?.available ?? 0) >= line.quantity,
        )
        .map((item) => ({
          id: item.id,
          type: item.type,
          available: pool[item.id].available,
        }))
    : [];
  return { available, total, shortfall, alternatives };
}

type HeldForEvent = {
  requestId: string | null;
  equipmentId: string;
  quantity: number;
  startAt: Date;
  endAt: Date;
};

/**
 * SCRUM-155 AC 6, as revised for SCRUM-156 — how much of each line of an
 * approved request is still to reserve. A line is covered by confirmed
 * reservations made for this request, or made with the old one-type form
 * (no request linked), that span the whole event: the same "whole event" rule
 * as the SCRUM-110 checklist. Reservations for another request on the same
 * event don't count, so a second request is reserved in its own right, and a
 * line whose reservation was cancelled (SCRUM-32, SCRUM-142) is offered again.
 * Callers pass confirmed reservations only. Returns the lines with something
 * outstanding.
 */
export function outstandingLines<
  L extends { equipmentId: string; quantity: number },
>(
  requestId: string,
  lines: L[],
  event: { startAt: Date | null; endAt: Date | null },
  reservations: HeldForEvent[],
): (L & { outstanding: number })[] {
  const { startAt, endAt } = event;
  const covered = new Map<string, number>();
  if (startAt && endAt) {
    for (const held of reservations) {
      if (held.requestId !== null && held.requestId !== requestId) continue;
      if (held.startAt > startAt || held.endAt < endAt) continue;
      covered.set(
        held.equipmentId,
        (covered.get(held.equipmentId) ?? 0) + held.quantity,
      );
    }
  }
  return lines
    .map((line) => ({
      ...line,
      outstanding: Math.max(
        0,
        line.quantity - (covered.get(line.equipmentId) ?? 0),
      ),
    }))
    .filter((line) => line.outstanding > 0);
}
