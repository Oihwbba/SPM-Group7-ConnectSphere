import Link from "next/link";
import { Bell } from "lucide-react";

/**
 * SCRUM-48 AC3 — the header's link to the notification list, with the unread
 * count. The layout reads the count on the server; reading a notification
 * revalidates the layout, so the count follows.
 */
export function NotificationBell({ unread }: { unread: number }) {
  const label =
    unread === 0
      ? "Notifications, none unread"
      : `Notifications, ${unread} unread`;

  return (
    <Link
      href="/notifications"
      aria-label={label}
      title={label}
      className="relative flex h-10 w-10 items-center justify-center rounded-md text-foreground transition-colors hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Bell className="h-5 w-5" aria-hidden="true" />
      {unread > 0 && (
        <span
          data-testid="unread-count"
          aria-hidden="true"
          className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-400 px-1 text-[10px] font-semibold leading-none text-white"
        >
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </Link>
  );
}
