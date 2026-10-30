import { requireSession } from "@/lib/auth/guard";
import { can } from "@/lib/auth/can";
import { Forbidden } from "@/components/app/forbidden";
import {
  getBookableEvents,
  getRequestableVenues,
  getSuitabilityJudgements,
} from "../queries";
import { RequestForm } from "./request-form";
import { PageHeader } from "@/components/app/page-header";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const one = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;
const many = (value: string | string[] | undefined) =>
  value === undefined ? [] : Array.isArray(value) ? value : [value];

// SCRUM-50 — an Event Coordinator asks for a venue. Who may see this page is
// decided by lib/auth/can.ts, not a role list here. SCRUM-38 AC9: venue
// search opens it with the event and venue chosen (`?event=&venue=`); an id
// this Coordinator can't request for is ignored, as if it weren't given.
// Request this venue sends the whole search form, so the attendance,
// facilities, accessibility features and layout on screen come too
// (`&attendance=&facility=&access=&layout=`), searched or not; ones the form
// doesn't take are dropped (searchedAttendance, neededInSearch), and the
// search's other fields ignored.
export default async function RequestVenuePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await requireSession();
  if (!can(session.user, "booking:request")) {
    return <Forbidden />;
  }

  const [events, venues, params] = await Promise.all([
    getBookableEvents(session.user.id),
    getRequestableVenues(),
    searchParams,
  ]);
  const initialEventId = events.find((e) => e.id === one(params.event))?.id;
  const initialVenueId = venues.find((v) => v.id === one(params.venue))?.id;
  const judgements = await getSuitabilityJudgements(events.map((e) => e.id));
  // SCRUM-40 AC8: only the assigned Coordinator records a judgement.
  const judgeableEventIds = events
    .filter((event) =>
      can(session.user, "venue:judge", { kind: "event", ...event }),
    )
    .map((event) => event.id);

  // SCRUM-209 AC1: from the event's page, the request leads back there.
  const fromEvent = one(params.return) === "event" && Boolean(initialEventId);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Request a venue"
        description="Ask Venue Staff to book a venue for one of your approved events."
        back={
          fromEvent
            ? { href: `/events/${initialEventId}?tab=arrangements`, to: "the event" }
            : undefined
        }
      />
      <RequestForm
        events={events}
        venues={venues}
        initialEventId={initialEventId}
        initialVenueId={initialVenueId}
        initialNeeds={{
          facilities: many(params.facility),
          accessibility: many(params.access),
          layout: one(params.layout),
          attendance: one(params.attendance),
        }}
        judgements={judgements}
        judgeableEventIds={judgeableEventIds}
        returnToEvent={fromEvent}
      />
    </div>
  );
}
