import { requireSession } from "@/lib/auth/guard";
import { PagePlaceholder } from "@/components/app/page-placeholder";

// Every role has a notifications inbox, so no role allow-list here — being
// signed in is enough. Which notifications a user sees is scoped by ownership
// (Notification.userId) once this feature is built.
export default async function NotificationsPage() {
  await requireSession();

  return (
    <PagePlaceholder
      title="Notifications"
      description="Your notifications about events, bookings, registrations and changes."
      scrumId="SCRUM-51"
      owner="Hann Qian"
    />
  );
}
