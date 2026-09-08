import type { Role } from "@prisma/client";

import { requireSession } from "@/lib/auth/guard";
import { Forbidden } from "@/components/app/forbidden";
import { PagePlaceholder } from "@/components/app/page-placeholder";

// Only Event Coordinators review the queue of submitted events.
const ALLOWED_ROLES: Role[] = ["COORDINATOR"];

export default async function CoordinatorEventsPage() {
  const session = await requireSession();
  if (!ALLOWED_ROLES.includes(session.user.role)) {
    return <Forbidden />;
  }

  return (
    <PagePlaceholder
      title="Event Review"
      description="Review submitted event requests, request changes, approve or reject."
      scrumId="SCRUM-12"
      owner="Jin Hong"
    />
  );
}
