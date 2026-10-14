import { requireSession } from "@/lib/auth/guard";
import { can } from "@/lib/auth/can";
import { Forbidden } from "@/components/app/forbidden";
import { getMyRegistrations } from "./queries";
import { RegistrationsList } from "./registrations-list";

// SCRUM-76 — an Attendee's own registrations and the status of each. Access
// is decided by lib/auth/can.ts (the single gate), not a role list here
// (SCRUM-66 / SCRUM-67).
export default async function RegistrationsPage() {
  const session = await requireSession();
  if (!can(session.user, "registration:read")) {
    return <Forbidden />;
  }

  const registrations = await getMyRegistrations();

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          My Registrations
        </h1>
        <p className="text-sm text-muted-foreground">
          The events you&apos;ve registered for, and the status of each.
        </p>
      </div>
      <RegistrationsList registrations={registrations} />
    </div>
  );
}
