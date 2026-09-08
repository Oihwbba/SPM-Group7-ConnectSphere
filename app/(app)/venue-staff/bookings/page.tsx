import type { Role } from "@prisma/client";

import { requireSession } from "@/lib/auth/guard";
import { Forbidden } from "@/components/app/forbidden";
import { PagePlaceholder } from "@/components/app/page-placeholder";

const ALLOWED_ROLES: Role[] = ["VENUE_STAFF"];

export default async function VenueStaffBookingsPage() {
  const session = await requireSession();
  if (!ALLOWED_ROLES.includes(session.user.role)) {
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
