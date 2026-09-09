import type { Role } from "@prisma/client";

import { requireSession } from "@/lib/auth/guard";
import { Forbidden } from "@/components/app/forbidden";
import { PagePlaceholder } from "@/components/app/page-placeholder";

const ALLOWED_ROLES: Role[] = ["ATTENDEE"];

export default async function RegistrationsPage() {
  const session = await requireSession();
  if (!ALLOWED_ROLES.includes(session.user.role)) {
    return <Forbidden />;
  }

  return (
    <PagePlaceholder
      title="My Registrations"
      description="View your event registrations and withdraw where needed."
      scrumId="SCRUM-42"
      owner="Caylern"
    />
  );
}
