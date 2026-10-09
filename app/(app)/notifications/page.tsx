import { requireSession } from "@/lib/auth/guard";
import { can } from "@/lib/auth/can";
import { Forbidden } from "@/components/app/forbidden";
import { getMyNotifications } from "./queries";
import { NotificationsList } from "./notifications-list";

// SCRUM-48 — every role has a notification list, so `notification:read` is
// granted to all of them; the query scopes it to the signed-in user.
export default async function NotificationsPage() {
  const session = await requireSession();
  if (!can(session.user, "notification:read")) {
    return <Forbidden />;
  }

  const notifications = await getMyNotifications();

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Notifications</h1>
        <p className="text-sm text-muted-foreground">
          Updates about your events, bookings, registrations and changes,
          newest first.
        </p>
      </div>
      <NotificationsList notifications={notifications} />
    </div>
  );
}
