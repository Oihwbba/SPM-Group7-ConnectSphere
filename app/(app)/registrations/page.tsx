import { requireSession } from "@/lib/auth/guard";
import { can } from "@/lib/auth/can";
import { Forbidden } from "@/components/app/forbidden";
import { PagePlaceholder } from "@/components/app/page-placeholder";

// Access is decided by lib/auth/can.ts (the single gate), not a role list here
// (SCRUM-66 / SCRUM-67).
export default async function RegistrationsPage() {
  const session = await requireSession();
  if (!can(session.user, "registration:read")) {
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
