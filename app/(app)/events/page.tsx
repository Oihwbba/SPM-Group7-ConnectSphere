import { Suspense } from "react";

import { requireSession } from "@/lib/auth/guard";
import { Forbidden } from "@/components/app/forbidden";
import {
  OrganiserEvents,
  CoordinatorEvents,
  AttendeeEvents,
} from "./role-views";
import { EventsListLoading } from "./events-list-skeleton";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

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
export default async function EventsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await requireSession();
  // SCRUM-48 AC5: a notification links here with the event to open.
  const { event } = await searchParams;
  const openEventId = Array.isArray(event) ? event[0] : event;

  return (
    <Suspense fallback={<EventsListLoading />}>
      <EventsRoleView
        role={session.user.role}
        userId={session.user.id}
        openEventId={openEventId}
      />
    </Suspense>
  );
}

async function EventsRoleView({
  role,
  userId,
  openEventId,
}: {
  role: string;
  userId: string;
  openEventId?: string;
}) {
  switch (role) {
    case "ORGANISER":
      return (
        <OrganiserEvents organiserId={userId} openEventId={openEventId} />
      );
    case "COORDINATOR":
      return (
        <CoordinatorEvents coordinatorId={userId} openEventId={openEventId} />
      );
    case "ATTENDEE":
      return <AttendeeEvents attendeeId={userId} />;
    default:
      return <Forbidden />;
  }
}
