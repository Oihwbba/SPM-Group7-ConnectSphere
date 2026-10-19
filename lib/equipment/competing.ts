import type { EquipmentRequestStatus, Prisma, PrismaClient } from "@prisma/client";

import { overlaps, type Period } from "@/lib/period";
import { LIVE_LINE, outstandingLines } from "@/lib/equipment/requests";

/**
 * SCRUM-134 — equipment requests competing for the same stock, settled first
 * come, first served when stock is reserved (SCRUM-31, SCRUM-155).
 */

type Db = PrismaClient | Prisma.TransactionClient;

/** AC4 — a request still competes until it is reserved in full, rejected or cancelled. */
export const COMPETING_REQUEST_STATUSES = [
  "PENDING_REVIEW",
  "IN_REVIEW",
  "APPROVED",
] as const satisfies readonly EquipmentRequestStatus[];

/** One line of an open request: what it asks for, and how much is reserved for it. */
export type OpenRequestLine = {
  requestId: string;
  submittedAt: Date;
  eventName: string;
  /** The event's period: requests compete where their events overlap. */
  event: Period;
  equipmentId: string;
  quantity: number;
  /** Reserved for it so far (SCRUM-155's rule, `outstandingLines`). */
  reserved: number;
};

/** Every line of every open request whose event has a period. */
export async function openRequestLines(db: Db): Promise<OpenRequestLine[]> {
  const requests = await db.equipmentRequest.findMany({
    where: {
      status: { in: [...COMPETING_REQUEST_STATUSES] },
      event: { startAt: { not: null }, endAt: { not: null } },
    },
    select: {
      id: true,
      createdAt: true,
      event: {
        select: {
          name: true,
          startAt: true,
          endAt: true,
          reservations: {
            where: { status: "CONFIRMED" },
            select: {
              requestId: true,
              equipmentId: true,
              quantity: true,
              startAt: true,
              endAt: true,
            },
          },
        },
      },
      lines: { where: LIVE_LINE, select: { equipmentId: true, quantity: true } },
    },
  });
  return requests.flatMap((request) => {
    const { event } = request;
    const outstanding = new Map(
      outstandingLines(request.id, request.lines, event, event.reservations).map((line) => [
        line.equipmentId,
        line.outstanding,
      ]),
    );
    return request.lines.map((line) => ({
      requestId: request.id,
      submittedAt: request.createdAt,
      eventName: event.name,
      event: { startAt: event.startAt!, endAt: event.endAt! },
      equipmentId: line.equipmentId,
      quantity: line.quantity,
      reserved: line.quantity - (outstanding.get(line.equipmentId) ?? 0),
    }));
  });
}

/** AC3 — `a` was submitted before `b`; the id breaks a tie. */
export function submittedFirst(
  a: { requestId: string; submittedAt: Date },
  b: { requestId: string; submittedAt: Date },
): boolean {
  const diff = a.submittedAt.getTime() - b.submittedAt.getTime();
  return diff < 0 || (diff === 0 && a.requestId < b.requestId);
}

/**
 * AC4 — the other open requests for this type whose events overlap `period`,
 * earliest submitted first. Events that only touch don't compete.
 */
export function competingLines(
  lines: OpenRequestLine[],
  requestId: string,
  equipmentId: string,
  period: Period,
): OpenRequestLine[] {
  return lines
    .filter(
      (line) =>
        line.requestId !== requestId &&
        line.equipmentId === equipmentId &&
        overlaps(line.event, period),
    )
    .sort((a, b) => (submittedFirst(a, b) ? -1 : 1));
}
