import type { Role } from "@prisma/client";

import { requireSession } from "@/lib/auth/guard";
import { Forbidden } from "@/components/app/forbidden";
import { PagePlaceholder } from "@/components/app/page-placeholder";

const ALLOWED_ROLES: Role[] = ["COORDINATOR"];

export default async function VenuesPage() {
  const session = await requireSession();
  if (!ALLOWED_ROLES.includes(session.user.role)) {
    return <Forbidden />;
  }

  return (
    <PagePlaceholder
      title="Venue Catalogue"
      description="Browse, search and check availability of ConnectSphere venues."
      scrumId="SCRUM-21"
      owner="Jun Bin"
    />
  );
}
