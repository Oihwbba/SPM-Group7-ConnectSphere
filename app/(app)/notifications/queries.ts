import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { can } from "@/lib/auth/can";
import {
  notificationHref,
  visibleNotificationsWhere,
} from "@/lib/notifications";

/**
 * SCRUM-48 — the signed-in user's notification list.
 *
 * Filtered by the session's user id, never by an id passed in (AC6), and by
 * nothing else, so every source writes into this one list (AC7). Newest first
 * by when each became visible (AC1): a reminder written days ago for a hold
 * (SCRUM-163) is new when it shows, not when it was written. `now` is a
 * parameter only so the show-from boundary can be tested exactly (AC8).
 */
export async function getMyNotifications(now = new Date()) {
  const session = await auth();
  if (!session?.user || !can(session.user, "notification:read")) {
    return [];
  }
  const user = session.user;

  const rows = await prisma.notification.findMany({
    where: visibleNotificationsWhere(user.id, now),
    select: {
      id: true,
      title: true,
      message: true,
      link: true,
      readAt: true,
      showFromAt: true,
      event: { select: { id: true, status: true } },
    },
    orderBy: [{ showFromAt: "desc" }, { createdAt: "desc" }, { id: "desc" }],
  });

  return rows.map(({ link, event, ...notification }) => ({
    ...notification,
    href: notificationHref(user, { link, event }),
  }));
}

export type MyNotification = Awaited<
  ReturnType<typeof getMyNotifications>
>[number];

/** SCRUM-48 AC3 — the header's unread count, under the same visibility rule. */
export async function getMyUnreadCount(now = new Date()) {
  const session = await auth();
  if (!session?.user || !can(session.user, "notification:read")) {
    return 0;
  }

  return prisma.notification.count({
    where: { ...visibleNotificationsWhere(session.user.id, now), readAt: null },
  });
}
