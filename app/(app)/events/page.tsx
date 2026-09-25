import { requireSession } from "@/lib/auth/guard";
import { Forbidden } from "@/components/app/forbidden";
import {
  OrganiserEvents,
  CoordinatorEvents,
  AttendeeEvents,
} from "./role-views";

// One route, three role views (the domain-first layout — see ADR 0001's
// addendum). Every role touches "events"; what differs is the view, so the
// role dispatch lives here and the authorisation itself stays in
// lib/auth/can.ts (ADR 0004). OrganiserEvents and CoordinatorEvents live in
// role-views.tsx, not here — a page.tsx file may only export the specific
// names Next.js recognises (default, metadata, generateStaticParams, ...),
// so anything else must live elsewhere to be testable or reused.
export default async function EventsPage() {
  const session = await requireSession();

  switch (session.user.role) {
    case "ORGANISER":
      return <OrganiserEvents organiserId={session.user.id} />;
    case "COORDINATOR":
      return <CoordinatorEvents coordinatorId={session.user.id} />;
    case "ATTENDEE":
      return <AttendeeEvents />;
    default:
      return <Forbidden />;
  }
}
