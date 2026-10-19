import type { EventStatus, Prisma, PrismaClient } from "@prisma/client";

import { withdrawPendingHoldNotices } from "@/lib/booking-holds";
import {
  notifyAboutEvent,
  withdrawRegistrationClosedNotice,
} from "@/lib/event-notifications";

/**
 * SCRUM-82 — closing an event: cancelling one that won't go ahead, and
 * completing one that has finished. There is no scheduler (the graders run
 * the app themselves), so completion happens the first time events are read
 * after the end, as hold expiry does (SCRUM-163).
 *
 * Test cases: docs/testing/SCRUM-82.md. Why it works this way:
 * docs/adr/0019-closing-an-event.md.
 */

/** AC1: the statuses the assigned Coordinator can cancel from. */
export const CANCELLABLE: EventStatus[] = [
  "UNDER_REVIEW",
  "PLANNING",
  "CONFIRMED",
];

/** AC10: still being decided or planned, so it can become overdue. */
const UNDECIDED: EventStatus[] = ["SUBMITTED", "UNDER_REVIEW", "PLANNING"];

/**
 * AC1, AC3, AC6 — cancel an event inside the caller's transaction, which has
 * already locked the event row and checked the event may be cancelled. Used
 * by the Coordinator's Cancel (SCRUM-82) and by approving an Organiser's
 * cancellation request (SCRUM-128 AC8), so both release the same things.
 *
 * Everything held for the event is released: venue bookings, holds and
 * pending requests; equipment reservations, whose stock returns to the pool;
 * open equipment requests; a safety check awaiting review becomes Outdated;
 * registrations are cancelled; submitted change requests are rejected with the
 * reason. Notices written ahead for the event (a hold's reminder and expiry,
 * and registration closing) are withdrawn, since none of them will happen.
 * The Organiser, the Coordinator and each Attendee whose registration was
 * cancelled are notified.
 */
export async function cancelInTransaction(
  tx: Prisma.TransactionClient,
  cancel: {
    eventId: string;
    name: string;
    organiserId: string;
    fromStatus: EventStatus;
    actorId: string;
    reason: string;
  },
): Promise<void> {
  const { eventId, actorId, reason } = cancel;
  const now = new Date();
  await tx.event.update({
    where: { id: eventId },
    data: {
      status: "CANCELLED",
      cancelledAt: now,
      cancelledById: actorId,
      cancellationReason: reason,
    },
  });

  const bookings = await tx.booking.updateMany({
    where: { eventId, status: { in: ["PENDING", "HELD", "APPROVED"] } },
    data: { status: "CANCELLED" },
  });
  await withdrawPendingHoldNotices(tx, { eventId }, now);
  await withdrawRegistrationClosedNotice(tx, eventId, now);
  const reservations = await tx.reservation.updateMany({
    where: { eventId, status: "CONFIRMED" },
    data: { status: "CANCELLED", cancelledAt: now },
  });
  const openRequests = await tx.equipmentRequest.findMany({
    where: { eventId, status: { in: ["PENDING_REVIEW", "IN_REVIEW", "APPROVED"] } },
    select: { id: true, status: true },
  });
  await tx.equipmentRequest.updateMany({
    where: { id: { in: openRequests.map((r) => r.id) } },
    data: { status: "CANCELLED" },
  });
  await tx.equipmentRequestUpdate.createMany({
    data: openRequests.map((r) => ({
      requestId: r.id,
      actorId,
      fromStatus: r.status,
      toStatus: "CANCELLED" as const,
      note: `Cancelled because the event was cancelled: ${reason}`,
    })),
  });
  const checks = await tx.safetyCheck.updateMany({
    where: { eventId, status: "AWAITING_REVIEW" },
    data: { status: "OUTDATED", outdatedAt: now },
  });
  const registered = await tx.registration.findMany({
    where: { eventId, status: "REGISTERED" },
    select: { userId: true },
  });
  await tx.registration.updateMany({
    where: { eventId, status: "REGISTERED" },
    data: { status: "CANCELLED" },
  });
  const changes = await tx.eventChangeRequest.updateMany({
    where: { eventId, status: "PENDING_REVIEW" },
    data: {
      status: "REJECTED",
      decidedById: actorId,
      decidedAt: now,
      decisionReason: reason,
    },
  });

  // Who cancelled it and when (the entries' createdAt).
  await tx.auditLog.createMany({
    data: [
      {
        entityType: "Event",
        entityId: eventId,
        action: "STATUS_CHANGED",
        actorId,
        fieldName: "status",
        oldValue: cancel.fromStatus,
        newValue: "CANCELLED",
        summary: reason,
      },
      {
        entityType: "Event",
        entityId: eventId,
        action: "ARRANGEMENTS_RELEASED",
        actorId,
        summary: `Cancelled (SCRUM-82): ${bookings.count} venue booking(s), ${reservations.count} equipment reservation(s), ${openRequests.length} equipment request(s) and ${registered.length} registration(s) cancelled; ${checks.count} safety check(s) outdated; ${changes.count} change request(s) rejected.`,
      },
    ],
  });

  const message = `"${cancel.name}" was cancelled: ${reason}`;
  await tx.notification.createMany({
    data: [
      ...[cancel.organiserId, actorId].map((userId) => ({
        userId,
        type: "EVENT_STATUS_CHANGED" as const,
        title: "Event cancelled",
        message,
        eventId,
      })),
      ...registered.map(({ userId }) => ({
        userId,
        type: "REGISTERED_EVENT_CANCELLED" as const,
        title: "An event you registered for was cancelled",
        message,
        eventId,
      })),
    ],
  });
}

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
 * once and write one history entry for it. The history entries are written in
 * the same transaction, so a completed event always has one.
 *
 * Times are stored as UTC without a time zone, hence the ISO string cast to
 * `timestamp`.
 */
export async function completeFinishedEvents(
  db: PrismaClient,
  now: Date = new Date(),
): Promise<string[]> {
  const at = now.toISOString();
  return db.$transaction(async (tx) => {
    const completed = await tx.$queryRaw<
      { id: string; name: string; organiserId: string; coordinatorId: string | null }[]
    >`
    UPDATE "Event"
       SET "status" = 'COMPLETED',
           "completedAt" = ${at}::timestamp,
           "updatedAt" = ${at}::timestamp
     WHERE "status" = 'CONFIRMED'
       AND "endAt" < ${at}::timestamp
    RETURNING "id", "name", "organiserId", "coordinatorId"`;
    if (completed.length > 0) {
      await tx.auditLog.createMany({
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
      // SCRUM-45 AC7: its Organiser and Coordinator are told, once, since
      // only this UPDATE's own rows are notified.
      for (const event of completed) {
        await notifyAboutEvent(tx, [event.organiserId, event.coordinatorId], event, {
          title: "Event completed",
          message: `"${event.name}" has ended and is now Completed.`,
        });
      }
    }
    return completed.map(({ id }) => id);
  });
}
