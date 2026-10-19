import type { Prisma } from "@prisma/client";

/**
 * SCRUM-45 — one workflow notice about an event, to each of its recipients.
 *
 * - AC12: it names the event, says what happened, and is about the event, so
 *   the notification list links to it (SCRUM-48 AC5).
 * - AC13: each recipient gets exactly one, even when the same person is
 *   named twice; a missing recipient (an event with no Coordinator yet) is
 *   skipped. Callers write it in the same transaction as the change it
 *   reports, after that change's conditional write, so a retried or refused
 *   action writes none.
 * - `showFromAt` writes it ahead for a known future time (SCRUM-48 AC8), such
 *   as registration closing.
 */
export function notifyAboutEvent(
  tx: Prisma.TransactionClient,
  recipients: (string | null)[],
  event: { id: string; name: string },
  notice: { title: string; message: string; showFromAt?: Date },
) {
  const userIds = [
    ...new Set(recipients.filter((id): id is string => id !== null)),
  ];
  return tx.notification.createMany({
    data: userIds.map((userId) => ({
      userId,
      type: "EVENT_STATUS_CHANGED" as const,
      eventId: event.id,
      title: notice.title,
      message: notice.message,
      ...(notice.showFromAt ? { showFromAt: notice.showFromAt } : {}),
    })),
  });
}

/**
 * SCRUM-45 AC5 — a Confirmed event back in Planning tells its Organiser why:
 * an approved change that affects its arrangements (SCRUM-128 AC5), or a
 * flagged arrangement its Coordinator cancelled (SCRUM-26 AC10).
 */
export function notifyBackInPlanning(
  tx: Prisma.TransactionClient,
  event: { id: string; name: string; organiserId: string },
  reason: string,
) {
  return notifyAboutEvent(tx, [event.organiserId], event, {
    title: "Your event is back in Planning",
    message: `"${event.name}" is back in Planning: ${asSentence(reason)} It needs confirming again before new registrations open.`,
  });
}

/**
 * SCRUM-45 AC11 — confirming an event writes its "Registration closed" notice
 * ahead, to show at the closing time. Once that time no longer holds (the
 * event back in Planning, its registration closed or reopened by hand, or the
 * event cancelled), the notice that hasn't shown yet never will.
 */
export function withdrawRegistrationClosedNotice(
  tx: Prisma.TransactionClient,
  eventId: string,
  now: Date,
) {
  return tx.notification.updateMany({
    where: {
      eventId,
      title: "Registration closed",
      withdrawnAt: null,
      showFromAt: { gt: now },
    },
    data: { withdrawnAt: now },
  });
}

/**
 * A reason typed by a user, ending as a sentence, so the words after it in a
 * notice don't run on: "No venue available" becomes "No venue available.".
 */
export function asSentence(text: string): string {
  const trimmed = text.trim();
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}
