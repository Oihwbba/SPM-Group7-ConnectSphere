import type { EventStatus, Prisma, PrismaClient } from "@prisma/client";

/**
 * SCRUM-82 — closing an event: cancelling one that won't go ahead, and
 * completing one that has finished. There is no scheduler (the graders run
 * the app themselves), so completion happens the first time events are read
 * after the end, as hold expiry does (SCRUM-163).
 *
 * Test cases: docs/testing/SCRUM-82.md. Why it works this way:
 * docs/adr/0019-closing-an-event.md.
 */

type Db = PrismaClient | Prisma.TransactionClient;

/** AC1: the statuses the assigned Coordinator can cancel from. */
export const CANCELLABLE: EventStatus[] = ["UNDER_REVIEW", "PLANNING", "CONFIRMED"];

/** AC10: still being decided or planned, so it can become overdue. */
const UNDECIDED: EventStatus[] = ["SUBMITTED", "UNDER_REVIEW", "PLANNING"];

/**
 * AC10 — an event whose start has passed while it was still Submitted, Under
 * Review or Planning. It is never completed automatically; the Coordinator
 * cancels or rejects it.
 */
export function isOverdue(
  event: { status: EventStatus; startAt: Date | null },
  now: Date = new Date(),
): boolean {
  return (
    UNDECIDED.includes(event.status) &&
    event.startAt !== null &&
    event.startAt.getTime() < now.getTime()
  );
}

/**
 * AC7–AC9 — every Confirmed event whose end has passed becomes Completed, with
 * a history entry. At exactly the end time it is still Confirmed, and nothing
 * but a Confirmed event is touched, so a Cancelled one never completes and a
 * Completed one isn't completed twice. One UPDATE … RETURNING decides which
 * rows changed, so two pages loading at the same moment complete each event
 * once and write one history entry for it.
 *
 * Times are stored as UTC without a time zone, hence the ISO string cast to
 * `timestamp`.
 */
export async function completeFinishedEvents(
  db: Db,
  now: Date = new Date(),
): Promise<string[]> {
  const at = now.toISOString();
  const completed = await db.$queryRaw<{ id: string }[]>`
    UPDATE "Event"
       SET "status" = 'COMPLETED',
           "completedAt" = ${at}::timestamp,
           "updatedAt" = ${at}::timestamp
     WHERE "status" = 'CONFIRMED'
       AND "endAt" < ${at}::timestamp
    RETURNING "id"`;
  if (completed.length > 0) {
    await db.auditLog.createMany({
      data: completed.map(({ id }) => ({
        entityType: "Event",
        entityId: id,
        action: "STATUS_CHANGED",
        actorId: null,
        fieldName: "status",
        oldValue: "CONFIRMED",
        newValue: "COMPLETED",
        summary: "Completed after its end time (SCRUM-82)",
      })),
    });
  }
  return completed.map(({ id }) => id);
}
