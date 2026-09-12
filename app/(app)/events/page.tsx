import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth/guard";
import { Forbidden } from "@/components/app/forbidden";
import { PagePlaceholder } from "@/components/app/page-placeholder";
import { EventsClient } from "./events-client";

// One route, three role views (the domain-first layout — see ADR 0001's
// addendum). Every role touches "events"; what differs is the view, so the
// role dispatch lives here and the authorisation itself stays in
// lib/auth/can.ts (ADR 0004).
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

/** The reference feature. Only Organisers reach it; the query below is scoped
 * to the signed-in organiser, so an Organiser can never see another's events. */
async function OrganiserEvents({ organiserId }: { organiserId: string }) {
  // RELATIONSHIP enforced in the query: an organiser only ever loads their own
  // rows. This is the read-side counterpart to `can()`'s relationship check.
  const events = await prisma.event.findMany({
    where: { organiserId },
    orderBy: { createdAt: "desc" },
  });

  return <EventsClient events={events} />;
}

/** Coordinator view: displays all submitted event requests available for review or assigned. */
async function CoordinatorEvents({ coordinatorId }: { coordinatorId: string }) {
  const events = await prisma.event.findMany({
    where: {
      OR: [
        { coordinatorId },
        { status: { not: "DRAFT" } },
      ],
    },
    orderBy: { createdAt: "desc" },
  });

  return <EventsClient events={events} isCoordinator />;
}
