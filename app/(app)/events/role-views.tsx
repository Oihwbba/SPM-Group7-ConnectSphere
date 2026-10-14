import { prisma } from "@/lib/db";
import { EventsClient } from "./events-client";
import { AttendeeEventsClient } from "./attendee-events-client";

/** Events owned by one organiser, newest first. Exported so the scoping rule
 * is testable on its own (tests/unit/events.test.ts, SCRUM-16/84). A discarded
 * draft is left out (SCRUM-130 AC1); nothing else is, however old, because
 * drafts never expire (AC5). */
export async function getOrganiserEvents(organiserId: string) {
  return prisma.event.findMany({
    where: { organiserId, discardedAt: null },
    orderBy: { updatedAt: "desc" },
  });
}

/** Requests assigned to one coordinator, plus submitted requests nobody has
 * picked up yet. Must mirror `can()`'s coordinator relationship exactly. */
export async function getCoordinatorEvents(coordinatorId: string) {
  return prisma.event.findMany({
    where: {
      OR: [
        { coordinatorId },
        { coordinatorId: null, status: { not: "DRAFT" } },
      ],
    },
    orderBy: { createdAt: "desc" },
  });
}

/** One event, scoped to its organiser: another organiser's id returns null,
 * the same result a missing id gives (SCRUM-68 not-found parity), and so does
 * a discarded draft (SCRUM-130 AC1). */
export async function getEventForUser(eventId: string, organiserId: string) {
  return prisma.event.findFirst({
    where: { id: eventId, organiserId, discardedAt: null },
  });
}

/** The reference feature. Only Organisers reach it; the query below is scoped
 * to the signed-in organiser, so an Organiser can never see another's events. */
export async function OrganiserEvents({
  organiserId,
  openEventId,
}: {
  organiserId: string;
  openEventId?: string;
}) {
  // RELATIONSHIP enforced in the query: an organiser only ever loads their own
  // rows. This is the read-side counterpart to `can()`'s relationship check.
  const events = await getOrganiserEvents(organiserId);

  return <EventsClient events={events} openEventId={openEventId} />;
}

/** Coordinator view: requests assigned to this coordinator, plus submitted
 * requests no coordinator has picked up yet. Lives in its own file (not
 * page.tsx) so it can be imported directly by
 * tests/unit/coordinator-events-access.test.ts — a page.tsx file may only
 * export the specific names Next.js recognises (default, metadata, etc.),
 * so an extra named export here would break the build's page-type check. */
export async function CoordinatorEvents({
  coordinatorId,
  openEventId,
}: {
  coordinatorId: string;
  openEventId?: string;
}) {
  // Must mirror `can()`'s coordinator relationship exactly — a looser query
  // here would list events assigned to OTHER coordinators.
  const events = await getCoordinatorEvents(coordinatorId);

  return (
    <EventsClient events={events} isCoordinator openEventId={openEventId} />
  );
}

/** SCRUM-72 — Confirmed events not Cancelled, newest-starting first, each
 * with its approved venue booking (if any), its active-registration count so
 * the client can show remaining capacity without a second round trip, and
 * this caller's OWN registration row (SCRUM-73: "immediately visible ... with
 * a status of registered" applies to the list too, not just the detail page). */
export async function getBrowsableEvents(attendeeId: string) {
  return prisma.event.findMany({
    where: { status: "CONFIRMED" },
    include: {
      bookings: {
        where: { status: "APPROVED" },
        take: 1,
        include: { venue: { select: { name: true, location: true } } },
      },
      registrations: {
        where: { userId: attendeeId },
        select: { id: true, status: true },
        take: 1,
      },
      _count: {
        select: { registrations: { where: { status: "REGISTERED" } } },
      },
    },
    orderBy: { startAt: "asc" },
  });
}

/** Attendee view: SCRUM-72's browse list. `status: "CONFIRMED"` in the query
 * above already excludes Cancelled (and every other) status, so nothing
 * further is filtered here. */
export async function AttendeeEvents({ attendeeId }: { attendeeId: string }) {
  const events = await getBrowsableEvents(attendeeId);

  return <AttendeeEventsClient events={events} />;
}
