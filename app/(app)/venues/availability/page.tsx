import { requireSession } from "@/lib/auth/guard";
import { can } from "@/lib/auth/can";
import { Forbidden } from "@/components/app/forbidden";
import { prisma } from "@/lib/db";
import { utcToSgWallTime } from "@/lib/datetime";
import {
  addDays,
  availabilityByDay,
  findVenueBlockers,
  startOfSgDay,
} from "@/lib/venue-availability";
import { AvailabilityCalendar } from "./availability-calendar";
import { parseRange } from "./range";
import { RangeControls } from "./range-controls";
import { RecordUnavailabilityForm } from "./record-unavailability-form";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const one = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

/**
 * SCRUM-36 — a venue's availability across a range of dates. One venue at a
 * time: a single venue across a fortnight reads clearly on a phone and to a
 * screen reader, where a grid of every venue would not.
 *
 * Only approved bookings and recorded unavailability are shown as taken; a
 * pending request blocks nobody (lib/venue-availability.ts).
 */
export default async function AvailabilityPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await requireSession();
  if (!can(session.user, "venue:availability")) {
    return <Forbidden />;
  }

  const params = await searchParams;
  const venues = await prisma.venue.findMany({
    where: { isActive: true },
    select: { id: true, name: true, capacity: true },
    orderBy: { name: "asc" },
  });
  const venue = venues.find((v) => v.id === one(params.venue)) ?? venues[0];

  const today = utcToSgWallTime(new Date()).slice(0, 10);
  const { from, to } = parseRange(one(params.from), one(params.to), today);

  const blockers = venue
    ? await findVenueBlockers(prisma, venue.id, {
        startAt: startOfSgDay(from),
        endAt: startOfSgDay(addDays(to, 1)),
      })
    : [];

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Venue availability
        </h1>
        <p className="text-sm text-muted-foreground">
          When a venue is free, booked, or unavailable for another reason. Times
          are Singapore time.
        </p>
      </div>

      {venue ? (
        <>
          <RangeControls
            venues={venues}
            venueId={venue.id}
            from={from}
            to={to}
          />
          {can(session.user, "unavailability:record") && (
            <RecordUnavailabilityForm
              key={venue.id}
              venueId={venue.id}
              venueName={venue.name}
            />
          )}
          <AvailabilityCalendar
            venueName={venue.name}
            days={availabilityByDay(blockers, from, to)}
            from={from}
            to={to}
          />
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          There are no venues in the catalogue yet.
        </p>
      )}
    </div>
  );
}
