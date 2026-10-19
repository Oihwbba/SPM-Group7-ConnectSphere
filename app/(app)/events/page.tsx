import { Suspense } from "react";
import Link from "next/link";
import type { Role } from "@prisma/client";

import { requireSession } from "@/lib/auth/guard";
import { rolesOf } from "@/lib/auth/can";
import { ROLE_LABEL } from "@/lib/nav";
import { prisma } from "@/lib/db";
import { completeFinishedEvents } from "@/lib/event-closing";
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
  // SCRUM-82 AC7: finished Confirmed events read as Completed, with no job.
  await completeFinishedEvents(prisma);
  // SCRUM-48 AC5: a notification links here with the event to open.
  const { event, as } = await searchParams;
  const openEventId = Array.isArray(event) ? event[0] : event;

  // SCRUM-121 AC2: someone with more than one role that has an events view
  // switches between them, starting with their primary role's. Only a view of
  // a role they hold can be asked for.
  const views = rolesOf(session.user).filter((role) => EVENT_VIEWS.includes(role));
  const asked = Array.isArray(as) ? as[0] : as;
  const role = views.find((view) => view === asked) ?? views[0] ?? session.user.role;

  return (
    <>
      {views.length > 1 && (
        <nav aria-label="View events as" className="mb-4 flex flex-wrap gap-2 text-sm">
          {views.map((view) => (
            <Link
              key={view}
              href={`/events?as=${view}`}
              aria-current={view === role ? "page" : undefined}
              className={
                view === role
                  ? "rounded-full bg-primary px-3 py-1 text-primary-foreground"
                  : "rounded-full border px-3 py-1 text-muted-foreground hover:bg-muted"
              }
            >
              {ROLE_LABEL[view]}
            </Link>
          ))}
        </nav>
      )}
      <Suspense fallback={<EventsListLoading />}>
        <EventsRoleView role={role} userId={session.user.id} openEventId={openEventId} />
      </Suspense>
    </>
  );
}

/** The roles with an events view, in the order the switch offers them. */
const EVENT_VIEWS: Role[] = ["ORGANISER", "COORDINATOR", "ATTENDEE"];

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
