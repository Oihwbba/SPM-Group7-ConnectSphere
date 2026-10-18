import { notFound } from "next/navigation";

import { requireSession } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";
import { completeFinishedEvents } from "@/lib/event-closing";
import { getBrowsableEvent } from "../queries";
import { AttendeeEventDetail } from "../attendee-event-detail";

/**
 * SCRUM-72 — the attendee-facing event detail page, reachable by direct URL
 * ("Direct event URLs do not bypass the same visibility and registration-
 * state rules").
 *
 * No role check here: `getBrowsableEvent`'s own `can(user, "event:browse")`
 * gate already returns null for every role that doesn't hold that action
 * (ADR 0004 — one authorisation gate, not a second inline check that could
 * drift from ROLE_ACTIONS). Today only ATTENDEE holds it, so a non-Attendee
 * hitting any `/events/:id` still 404s regardless of whether the id exists —
 * this preserves the pre-existing behaviour e2e/access-control.spec.ts pins
 * for Organiser/Coordinator (SCRUM-68's not-found parity, extended here).
 */
export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireSession();
  // SCRUM-82 AC7: a finished event reads as Completed, so it isn't shown here.
  await completeFinishedEvents(prisma);

  const { id } = await params;
  const event = await getBrowsableEvent(id);
  if (!event) {
    notFound();
  }

  return <AttendeeEventDetail event={event} />;
}
