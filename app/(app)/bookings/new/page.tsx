import { requireSession } from "@/lib/auth/guard";
import { can } from "@/lib/auth/can";
import { Forbidden } from "@/components/app/forbidden";
import {
  getBookableEvents,
  getRequestableVenues,
  getSuitabilityJudgements,
} from "../queries";
import { RequestForm } from "./request-form";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const one = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

// SCRUM-50 — an Event Coordinator asks for a venue. Who may see this page is
// decided by lib/auth/can.ts, not a role list here. SCRUM-38 AC9: venue
// search opens it with the event and venue chosen (`?event=&venue=`); an id
// this Coordinator can't request for is ignored, as if it weren't given.
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

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Request a venue
        </h1>
        <p className="text-sm text-muted-foreground">
          Ask Venue Staff to book a venue for one of your approved events. Times
          are Singapore time.
        </p>
      </div>
      <RequestForm
        events={events}
        venues={venues}
        initialEventId={initialEventId}
        initialVenueId={initialVenueId}
        judgements={judgements}
        judgeableEventIds={judgeableEventIds}
      />
    </div>
  );
}
