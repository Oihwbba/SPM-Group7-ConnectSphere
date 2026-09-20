import { requireSession } from "@/lib/auth/guard";
import { can } from "@/lib/auth/can";
import { Forbidden } from "@/components/app/forbidden";
import { PagePlaceholder } from "@/components/app/page-placeholder";

// Who may see this page is decided by lib/auth/can.ts (the single gate), not by
// a role list held here — so changing a role never means editing this page
// (SCRUM-66 / SCRUM-67).
export default async function VenuesPage() {
  const session = await requireSession();
  if (!can(session.user, "venue:read")) {
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
