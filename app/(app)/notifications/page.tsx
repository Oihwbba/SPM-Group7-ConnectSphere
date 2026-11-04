import { requireSession } from "@/lib/auth/guard";
import { can } from "@/lib/auth/can";
import { Forbidden } from "@/components/app/forbidden";
import { PageHeader } from "@/components/app/page-header";
import { LANDING_ROUTE_BY_ROLE, NAV_BY_ROLE } from "@/lib/nav";
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
  // SCRUM-207 AC1: reached from the bell, not the menu, so it leads back to
  // the page the user lands on.
  const home = LANDING_ROUTE_BY_ROLE[session.user.role];
  const homeLabel =
    NAV_BY_ROLE[session.user.role].find((item) => item.href === home)?.label ??
    "your work";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        description="Updates about your events, bookings, registrations and changes, newest first."
        back={{ href: home, to: homeLabel }}
      />
      <NotificationsList notifications={notifications} />
    </div>
  );
}
