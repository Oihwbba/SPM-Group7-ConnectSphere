import { requireSession } from "@/lib/auth/guard";
import { Forbidden } from "@/components/app/forbidden";
import { PagePlaceholder } from "@/components/app/page-placeholder";
import { OrganiserEvents, CoordinatorEvents } from "./role-views";

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
      return (
        <PagePlaceholder
          title="Browse Events"
          description="Discover events open for registration and sign up to attend."
          scrumId="SCRUM-41"
          owner="Caylern"
        />
      );
    default:
      return <Forbidden />;
  }
}