import type { Role } from "@prisma/client";

import { requireSession } from "@/lib/auth/guard";
import { Forbidden } from "@/components/app/forbidden";
import { PagePlaceholder } from "@/components/app/page-placeholder";

const ALLOWED_ROLES: Role[] = ["ATTENDEE"];

export default async function AttendeeEventsPage() {
  const session = await requireSession();
  if (!ALLOWED_ROLES.includes(session.user.role)) {
    return <Forbidden />;
  }

  return (
    <PagePlaceholder
      title="Browse Events"
      description="Discover events open for registration and sign up to attend."
      scrumId="SCRUM-41"
      owner="Caylern"
    />
  );
}
