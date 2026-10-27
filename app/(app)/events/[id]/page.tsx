import { notFound } from "next/navigation";

import { requireSession } from "@/lib/auth/guard";
import { isEventTab } from "@/lib/event-next-step";
import { prisma } from "@/lib/db";
import { completeFinishedEvents } from "@/lib/event-closing";
import { getBrowsableEvent } from "../queries";
import { AttendeeEventDetail } from "../attendee-event-detail";
import { ReplanningEventDetail } from "../replanning-event-detail";
import { isBeingReplanned } from "@/lib/confirmed-details";
import { getEventPageData } from "./event-page-data";
import { EventPage } from "./event-page";

/**
 * One event's page, by direct URL.
 *
 * - SCRUM-208: the event's Organiser, or its assigned Coordinator, sees the
 *   event page, decided by `can(user, "event:read")` inside getEventPageData.
 * - SCRUM-72: otherwise an Attendee sees the attendee page, unchanged
 *   ("Direct event URLs do not bypass the same visibility and
 *   registration-state rules"), decided by `can(user, "event:browse")`.
 * - Anyone else, and an id that doesn't exist, gets the same 404 (SCRUM-68).
 *
 * No role check here: each loader is its own gate (ADR 0004).
 */
export default async function EventDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireSession();
  // SCRUM-82 AC7: a finished event reads as Completed, so it isn't shown here.
  await completeFinishedEvents(prisma);

  const { id } = await params;
  const page = await getEventPageData(session.user, id);
  if (page) {
    const { tab } = await searchParams;
    return <EventPage {...page} requestedTab={isEventTab(tab) ? tab : null} />;
  }

  const event = await getBrowsableEvent(id);
  if (!event) {
    notFound();
  }

  return isBeingReplanned(event) ? (
    <ReplanningEventDetail event={event} />
  ) : (
    <AttendeeEventDetail event={event} />
  );
}
