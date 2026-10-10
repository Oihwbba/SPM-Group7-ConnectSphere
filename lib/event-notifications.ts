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
 * A reason typed by a user, ending as a sentence, so the words after it in a
 * notice don't run on: "No venue available" becomes "No venue available.".
 */
export function asSentence(text: string): string {
  const trimmed = text.trim();
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}
