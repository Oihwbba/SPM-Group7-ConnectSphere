import { prisma } from "@/lib/db";
import { EventsClient } from "./events-client";

/** The reference feature. Only Organisers reach it; the query below is scoped
 * to the signed-in organiser, so an Organiser can never see another's events. */
export async function OrganiserEvents({
  organiserId,
}: {
  organiserId: string;
}) {
  // RELATIONSHIP enforced in the query: an organiser only ever loads their own
  // rows. This is the read-side counterpart to `can()`'s relationship check.
  const events = await prisma.event.findMany({
    where: { organiserId },
    orderBy: { createdAt: "desc" },
  });

  return <EventsClient events={events} />;
}

/** Coordinator view: requests assigned to this coordinator, plus submitted
 * requests no coordinator has picked up yet. Lives in its own file (not
 * page.tsx) so it can be imported directly by
 * tests/unit/coordinator-events-access.test.ts — a page.tsx file may only
 * export the specific names Next.js recognises (default, metadata, etc.),
 * so an extra named export here would break the build's page-type check. */
export async function CoordinatorEvents({
  coordinatorId,
}: {
  coordinatorId: string;
}) {
  // Must mirror `can()`'s coordinator relationship exactly — a looser query
  // here would list events assigned to OTHER coordinators.
  const events = await prisma.event.findMany({
    where: {
      OR: [
        { coordinatorId },
        { coordinatorId: null, status: { not: "DRAFT" } },
      ],
    },
    orderBy: { createdAt: "desc" },
  });

  return <EventsClient events={events} isCoordinator />;
}