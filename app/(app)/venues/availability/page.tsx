import { requireSession } from "@/lib/auth/guard";
import { can } from "@/lib/auth/can";
import { Forbidden } from "@/components/app/forbidden";
import { prisma } from "@/lib/db";
import { utcToSgWallTime } from "@/lib/datetime";
import {
  addDays,
  availabilityByDay,
  closedHours,
  findVenueCalendar,
  startOfSgDay,
} from "@/lib/venue-availability";
import { AvailabilityCalendar } from "./availability-calendar";
import { formatWeekRange, parseWeek } from "./week";
import { GoToDate, VenuePicker, WeekNav } from "./week-controls";
import { RecordUnavailabilityForm } from "./record-unavailability-form";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const one = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

/**
 * SCRUM-36 — a venue's availability for a week, Monday to Sunday. One venue
 * at a time: seven days of one venue stay readable, where a grid of every
 * venue would not.
 *
 * Only approved bookings and recorded unavailability are shown as taken; a
 * pending request blocks nobody (lib/venue-availability.ts). Hours outside
 * the venue's opening hours are greyed out as closed (SCRUM-241).
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
  const { from, to } = parseWeek(one(params.week), today);

  const [blockers, openingHours] = venue
    ? await Promise.all([
        findVenueCalendar(prisma, venue.id, {
          startAt: startOfSgDay(from),
          endAt: startOfSgDay(addDays(to, 1)),
        }),
        // SCRUM-241: greyed out outside them.
        prisma.venueOpeningHours.findMany({
          where: { venueId: venue.id },
          select: { weekday: true, opensMinute: true, closesMinute: true },
        }),
      ])
    : [[], []];

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Venue availability
        </h1>
        <p className="text-sm text-muted-foreground">
          When a venue is free, booked, closed, or unavailable for another
          reason, a week at a time. Hover or tap a booking for more. A booking&apos;s
          setup and turnaround time are shown hatched on either side of it.
          Times are Singapore time.
        </p>
      </div>

      {venue ? (
        <div className="space-y-4">
          {/* Row 1 — Venue Staff record unavailability, on the right. */}
          {can(session.user, "unavailability:record") && (
            <div className="flex justify-end">
              <RecordUnavailabilityForm
                key={venue.id}
                venueId={venue.id}
                venueName={venue.name}
              />
            </div>
          )}
          {/* Row 2 — which venue, which week, or jump to a date. */}
          <div className="flex flex-wrap items-center gap-3">
            <VenuePicker venues={venues} venueId={venue.id} week={from} />
            <WeekNav
              venueId={venue.id}
              week={from}
              label={formatWeekRange(from, to)}
            />
            <GoToDate venueId={venue.id} week={from} />
          </div>
          {/* Row 3 (the legend) and the calendar itself. */}
          <AvailabilityCalendar
            venueName={venue.name}
            days={availabilityByDay(
              [...blockers, ...closedHours(openingHours, from, to)],
              from,
              to,
            )}
            today={today}
          />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          There are no venues in the catalogue yet.
        </p>
      )}
    </div>
  );
}
