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
 * fixed, so equipment has to be arranged before then. Approved is not listed:
 * approval saves Planning, so no event stays in it (SCRUM-81 AC1, SCRUM-233).
 */
export const REQUESTABLE_EVENT_STATUSES = [
  "PLANNING",
] as const satisfies readonly EventStatus[];

/**
 * SCRUM-142 AC1 — the lines a request still asks for. A line the Coordinator
 * removed is kept with `removedAt` set, and every reader leaves it out.
 */
export const LIVE_LINE = { removedAt: null } as const;

/**
 * SCRUM-142 AC1, AC3 — a request the Coordinator can still change or
 * withdraw. A Rejected one is replaced by a new request (SCRUM-27).
 * SCRUM-186 AC1: these are also the event's active requests, and an event
 * gets no second one while it has one of them.
 */
export const CHANGEABLE_REQUEST_STATUSES = [
  "PENDING_REVIEW",
  "IN_REVIEW",
  "APPROVED",
] as const satisfies readonly EquipmentRequestStatus[];

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
 * SCRUM-28 AC 2, AC 3 — the moves Technical Support can make. A request is taken
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
 * SCRUM-28 AC 1 & 4 — one requested line against what is free for its event.
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
 * SCRUM-156 AC 5, refining SCRUM-155 AC 6 — how much of each line of an
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

/**
 * SCRUM-142, SCRUM-226 — an approved request as the reserve form loaded it:
 * when the request last changed, and what each line still had to reserve.
 * Reserving compares it under the event's lock, so a form opened before the
 * lines changed, or before someone else reserved part of the request, is
 * refused rather than reserving a line twice (SCRUM-155 AC5).
 */
export function reservationVersion(
  updatedAt: Date,
  missing: { equipmentId: string; outstanding: number }[],
): string {
  const left = missing
    .map((line) => `${line.equipmentId}:${line.outstanding}`)
    .sort()
    .join(",");
  return `${updatedAt.toISOString()}|${left}`;
}

type RequestedLine = {
  equipmentId: string;
  quantity: number;
  technicalRequirements?: string | null;
};

/**
 * SCRUM-142 AC1, AC8 — how the Coordinator's new list of lines differs from
 * the request's live lines: types added, lines whose quantity or technical
 * requirements changed, and lines removed. All three empty means the
 * request is unchanged, so nothing is written.
 */
export function lineChanges<L extends RequestedLine & { id: string }>(
  current: L[],
  next: RequestedLine[],
): { added: RequestedLine[]; changed: (RequestedLine & { id: string; from: L })[]; removed: L[] } {
  const text = (value: string | null | undefined) => value || null;
  const byType = new Map(current.map((line) => [line.equipmentId, line]));
  const kept = new Set(next.map((line) => line.equipmentId));
  const added: RequestedLine[] = [];
  const changed: (RequestedLine & { id: string; from: L })[] = [];
  for (const line of next) {
    const was = byType.get(line.equipmentId);
    if (!was) added.push(line);
    else if (
      was.quantity !== line.quantity ||
      text(was.technicalRequirements) !== text(line.technicalRequirements)
    ) {
      changed.push({ ...line, id: was.id, from: was });
    }
  }
  const removed = current.filter((line) => !kept.has(line.equipmentId));
  return { added, changed, removed };
}
