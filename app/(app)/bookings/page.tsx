import { requireSession } from "@/lib/auth/guard";
import { can } from "@/lib/auth/can";
import { Forbidden } from "@/components/app/forbidden";
import { PagePlaceholder } from "@/components/app/page-placeholder";

// Access is decided by lib/auth/can.ts (the single gate), not a role list here
// (SCRUM-66 / SCRUM-67).
export default async function BookingsPage() {
  const session = await requireSession();
  if (!can(session.user, "booking:review")) {
    return <Forbidden />;
  }

  return (
    <PagePlaceholder
      title="Venue Bookings"
      description="Review pending booking requests and approve or reject them."
      scrumId="SCRUM-22"
      owner="Jun Bin"
    />
  );
}
