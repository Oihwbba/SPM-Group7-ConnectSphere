import { notFound } from "next/navigation";

import { requireSession } from "@/lib/auth/guard";
import { getBrowsableEvent } from "../queries";
import { AttendeeEventDetail } from "../attendee-event-detail";

/**
 * SCRUM-72 — the attendee-facing event detail page, reachable by direct URL
 * ("Direct event URLs do not bypass the same visibility and registration-
 * state rules").
 *
 * Every other role 404s here, unconditionally — this deliberately preserves
 * the pre-existing behaviour that e2e/access-control.spec.ts pins for
 * Organiser/Coordinator ("no event detail route is exposed by identifier"):
 * this route exists now, but only an Attendee can ever get past the role
 * check, so a non-Attendee hitting any `/events/:id` still 404s regardless of
 * whether the id exists (SCRUM-68's not-found parity, extended to this role).
 */
export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  if (session.user.role !== "ATTENDEE") {
    notFound();
  }

  const { id } = await params;
  const event = await getBrowsableEvent(id);
  if (!event) {
    notFound();
  }

  return <AttendeeEventDetail event={event} />;
}
