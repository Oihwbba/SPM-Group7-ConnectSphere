"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bell, ChevronRight } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent } from "@/components/ui/card";
import { formatDateTime } from "@/lib/datetime";
import { cn } from "@/lib/utils";
import { markNotificationRead } from "./actions";
import type { MyNotification } from "./queries";

/**
 * SCRUM-48 — the list itself. Opening a notification marks it read (AC2) and
 * then follows its link, if it has one (AC5).
 */
export function NotificationsList({
  notifications,
}: {
  notifications: MyNotification[];
}) {
  const router = useRouter();
  const [opening, setOpening] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  if (notifications.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
          <Bell className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">
            No notifications yet
          </p>
          <p className="text-xs text-muted-foreground">
            Updates about your events will appear here.
          </p>
        </CardContent>
      </Card>
    );
  }

  function open(notification: MyNotification) {
    setOpening(notification.id);
    startTransition(async () => {
      const result = await markNotificationRead({ id: notification.id });
      setOpening(null);
      if (!result.ok) {
        toast.error(result.error);
        router.refresh();
        return;
      }
      if (notification.href) {
        router.push(notification.href);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <ul className="space-y-2" aria-label="Notifications">
      {notifications.map((notification) => {
        const unread = notification.readAt === null;
        return (
          <li key={notification.id}>
            <button
              type="button"
              onClick={() => open(notification)}
              disabled={opening === notification.id}
              data-testid="notification"
              data-read={unread ? "false" : "true"}
              className={cn(
                "flex w-full items-start gap-3 rounded-lg border p-4 text-left transition-colors hover:bg-muted/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60",
                unread ? "border-primary/30 bg-primary/5" : "bg-card",
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                  unread ? "bg-primary" : "bg-transparent",
                )}
              />
              <span className="min-w-0 flex-1 space-y-1">
                <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <span
                    className={cn(
                      "text-sm",
                      unread ? "font-semibold" : "font-medium",
                    )}
                  >
                    {notification.title}
                    {unread && <span className="sr-only"> (unread)</span>}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatDateTime(notification.showFromAt)}
                  </span>
                </span>
                <span className="block break-words text-sm text-muted-foreground">
                  {notification.message}
                </span>
              </span>
              {notification.href && (
                <ChevronRight
                  aria-hidden="true"
                  className="mt-1 h-4 w-4 shrink-0 text-muted-foreground"
                />
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
