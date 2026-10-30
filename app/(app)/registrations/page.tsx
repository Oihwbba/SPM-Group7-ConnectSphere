import { requireSession } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";
import { completeFinishedEvents } from "@/lib/event-closing";
import { can } from "@/lib/auth/can";
import { Forbidden } from "@/components/app/forbidden";
import { getMyRegistrations } from "./queries";
import { RegistrationsList } from "./registrations-list";
import { PageHeader } from "@/components/app/page-header";

// SCRUM-76 — an Attendee's own registrations and the status of each. Access
// is decided by lib/auth/can.ts (the single gate), not a role list here
// (SCRUM-66 / SCRUM-67).
export default async function RegistrationsPage() {
  const session = await requireSession();
  if (!can(session.user, "registration:read")) {
    return <Forbidden />;
  }

  // SCRUM-82 AC7: finished Confirmed events read as Completed, with no job.
  await completeFinishedEvents(prisma);
  const registrations = await getMyRegistrations();

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Registrations"
        description="The events you've registered for, and the status of each."
      />
      <RegistrationsList registrations={registrations} />
    </div>
  );
}
