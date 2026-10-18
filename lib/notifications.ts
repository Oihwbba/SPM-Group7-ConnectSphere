import type { EventStatus, Prisma } from "@prisma/client";

import { can, type SessionUser } from "@/lib/auth/can";

/**
 * SCRUM-48 AC6 and AC8 — the notifications a user can see at `now`: only
 * their own, not withdrawn, and not before their show-from time. The list,
 * the unread count and marking one read all use this, so a reminder written
 * ahead for a hold (SCRUM-163) is invisible everywhere until it is due.
 */
export function visibleNotificationsWhere(
  userId: string,
  now: Date,
): Prisma.NotificationWhereInput {
  return { userId, withdrawnAt: null, showFromAt: { lte: now } };
}

/**
 * SCRUM-48 AC5 — where a notification takes this user: a page they are
 * allowed to open, or nowhere.
 *
 * - An Attendee goes to the event's Attendee page: a Confirmed event
 *   (SCRUM-72), or one back in Planning to be re-planned, where a registered
 *   Attendee sees what was last confirmed (SCRUM-85 AC7, AC9).
 * - An Organiser or Coordinator goes to their events list with that event
 *   open. The list is scoped to what they may see, so a link to an event
 *   they've lost access to opens nothing.
 * - Anyone else follows the link the notification was written with (Venue
 *   Staff and Technical Support pages), or has none. A Safety Officer's link
 *   to the safety check comes with SCRUM-166.
 */
export function notificationHref(
  user: SessionUser,
  notification: {
    link: string | null;
    event: { id: string; status: EventStatus } | null;
  },
): string | null {
  const { event } = notification;
  if (event && can(user, "event:browse")) {
    return event.status === "CONFIRMED" || event.status === "PLANNING"
      ? `/events/${event.id}`
      : null;
  }
  if (event && can(user, "event:list")) {
    return `/events?event=${event.id}`;
  }
  return notification.link;
}
