import { requireSession } from "@/lib/auth/guard";
import { can } from "@/lib/auth/can";
import { Forbidden } from "@/components/app/forbidden";
import { getBookableEvents, getRequestableVenues } from "../queries";
import { RequestForm } from "./request-form";

// SCRUM-50 — an Event Coordinator asks for a venue. Who may see this page is
// decided by lib/auth/can.ts, not a role list here.
export default async function RequestVenuePage() {
  const session = await requireSession();
  if (!can(session.user, "booking:request")) {
    return <Forbidden />;
  }

  const [events, venues] = await Promise.all([
    getBookableEvents(session.user.id),
    getRequestableVenues(),
  ]);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Request a venue
        </h1>
        <p className="text-sm text-muted-foreground">
          Ask Venue Staff to book a venue for one of your approved events. Times
          are Singapore time.
        </p>
      </div>
      <RequestForm events={events} venues={venues} />
    </div>
  );
}
