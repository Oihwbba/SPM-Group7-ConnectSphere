import { Suspense } from "react";

import { requireSession } from "@/lib/auth/guard";
import { Forbidden } from "@/components/app/forbidden";
import {
  OrganiserEvents,
  CoordinatorEvents,
  AttendeeEvents,
} from "./role-views";
import { EventsListLoading } from "./events-list-skeleton";

// One route, three role views (the domain-first layout — see ADR 0001's
// addendum). Every role touches "events"; what differs is the view, so the
// role dispatch lives here and the authorisation itself stays in
// lib/auth/can.ts (ADR 0004). OrganiserEvents and CoordinatorEvents live in
// role-views.tsx, not here — a page.tsx file may only export the specific
// names Next.js recognises (default, metadata, generateStaticParams, ...),
// so anything else must live elsewhere to be testable or reused.
//
// The loading skeleton is an explicit <Suspense> around just this dispatch,
// not a folder-level loading.tsx. A loading.tsx here would also wrap every
// nested route under events/ — including events/[id] (SCRUM-72) — in the
// same Suspense boundary, which forces Next.js to stream a 200 shell before
// that route's notFound() can resolve, so a genuinely-missing or -forbidden
// event would 200 with a not-found body instead of a real 404.
export default async function EventsPage() {
  const session = await requireSession();

  return (
    <Suspense fallback={<EventsListLoading />}>
      <EventsRoleView role={session.user.role} userId={session.user.id} />
    </Suspense>
  );
}

async function EventsRoleView({
  role,
  userId,
}: {
  role: string;
  userId: string;
}) {
  switch (role) {
    case "ORGANISER":
      return <OrganiserEvents organiserId={userId} />;
    case "COORDINATOR":
      return <CoordinatorEvents coordinatorId={userId} />;
    case "ATTENDEE":
      return <AttendeeEvents />;
    default:
      return <Forbidden />;
  }
}
