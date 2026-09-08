import type { Role } from "@prisma/client";

import { requireSession } from "@/lib/auth/guard";
import { Forbidden } from "@/components/app/forbidden";
import { PagePlaceholder } from "@/components/app/page-placeholder";

const ALLOWED_ROLES: Role[] = ["TECH_SUPPORT"];

export default async function TechSupportEquipmentPage() {
  const session = await requireSession();
  if (!ALLOWED_ROLES.includes(session.user.role)) {
    return <Forbidden />;
  }

  return (
    <PagePlaceholder
      title="Equipment"
      description="Review equipment requests, check availability and manage reservations."
      scrumId="SCRUM-31"
      owner="Felicia"
    />
  );
}
