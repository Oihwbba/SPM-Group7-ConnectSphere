import type { CSSProperties } from "react";
import {
  CalendarCheck,
  CircleCheck,
  Wrench,
  type LucideIcon,
} from "lucide-react";

import {
  formatDate,
  formatTime,
  formatWeekdayDate,
  parseSingaporeDateTime,
} from "@/lib/datetime";
import {
  addDays,
  startOfSgDay,
  type AvailabilityDay,
  type DaySegment,
} from "@/lib/venue-availability";

/** Noon on a Singapore day, so a heading never slips to the day before. */
const noon = (day: string) => parseSingaporeDateTime(`${day}T12:00`)!;

/**
 * How each kind of stretch looks and reads. "Visibly different" is never
 * colour alone (SCRUM-36 AC4): each kind also has its own icon and label, and
 * unavailability is striped where a booking is solid.
 */
const KIND: Record<
  DaySegment["kind"],
  { label: string; icon: LucideIcon; iconClass: string; bar: CSSProperties }
> = {
  free: {
    label: "Available",
    icon: CircleCheck,
    iconClass: "text-success",
    bar: { backgroundColor: "hsl(var(--success) / 0.18)" },
  },
  booking: {
    label: "Booked",
    icon: CalendarCheck,
    iconClass: "text-primary",
    bar: { backgroundColor: "hsl(var(--primary) / 0.75)" },
  },
  unavailability: {
    label: "Unavailable",
    icon: Wrench,
    iconClass: "text-warning-foreground",
    bar: {
      backgroundImage:
        "repeating-linear-gradient(135deg, hsl(var(--warning)) 0 6px, hsl(var(--warning) / 0.35) 6px 12px)",
    },
  },
};

function labelFor(segment: DaySegment): string {
  return segment.kind === "unavailability"
    ? `${KIND.unavailability.label} (${segment.reason.toLowerCase()})`
    : KIND[segment.kind].label;
}

/** A stretch's edge as a time; the day's own two midnights read as "midnight". */
function edge(at: Date, day: string): string {
  const midnights = [startOfSgDay(day), startOfSgDay(addDays(day, 1))];
  return midnights.some((m) => m.getTime() === at.getTime())
    ? "midnight"
    : formatTime(at);
}

/**
 * SCRUM-36 — one venue's availability, a day per row. Each row has a bar for
 * the eye (hidden from screen readers) and the same stretches as text, so a
 * screen reader hears the venue, the date and what is free or taken.
 */
export function AvailabilityCalendar({
  venueName,
  days,
  from,
  to,
}: {
  venueName: string;
  days: AvailabilityDay[];
  from: string;
  to: string;
}) {
  const range = `${formatDate(noon(from))} to ${formatDate(noon(to))}`;
  const allFree = days.every(
    (d) => d.segments.length === 1 && d.segments[0].kind === "free",
  );

  return (
    <section aria-labelledby="calendar-heading" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 id="calendar-heading" className="text-lg font-semibold">
          {venueName}
          <span className="block text-sm font-normal text-muted-foreground">
            {range}
          </span>
        </h2>
        <Legend />
      </div>

      {allFree && (
        <p
          data-testid="range-free"
          className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/10 px-4 py-3 text-sm"
        >
          <CircleCheck className="h-5 w-5 shrink-0 text-success" aria-hidden />
          {venueName} is available for the whole range, {range}.
        </p>
      )}

      <ol className="space-y-2">
        {days.map(({ day, segments }) => (
          <li
            key={day}
            data-day={day}
            aria-label={`${venueName}, ${formatWeekdayDate(noon(day))}`}
            className="rounded-xl border border-border/60 bg-card/50 p-3 sm:grid sm:grid-cols-[9.5rem_1fr] sm:items-center sm:gap-4"
          >
            <p className="mb-2 text-sm font-semibold sm:mb-0">
              {formatWeekdayDate(noon(day))}
            </p>
            <div className="min-w-0 space-y-2">
              <div
                aria-hidden
                className="flex h-6 overflow-hidden rounded-md border border-border/60"
              >
                {segments.map((segment) => (
                  <span
                    key={segment.startAt.toISOString()}
                    data-kind={segment.kind}
                    style={{
                      ...KIND[segment.kind].bar,
                      flexGrow:
                        segment.endAt.getTime() - segment.startAt.getTime(),
                      flexBasis: 0,
                    }}
                  />
                ))}
              </div>
              <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                {segments.map((segment) => {
                  const { icon: Icon, iconClass } = KIND[segment.kind];
                  const wholeDay = segments.length === 1;
                  return (
                    <li
                      key={segment.startAt.toISOString()}
                      data-kind={segment.kind}
                      className="flex items-center gap-1.5"
                    >
                      <Icon
                        className={`h-3.5 w-3.5 shrink-0 ${iconClass}`}
                        aria-hidden
                      />
                      <span className="font-medium">{labelFor(segment)}</span>{" "}
                      <span className="text-muted-foreground">
                        {wholeDay
                          ? "all day"
                          : `${edge(segment.startAt, day)} to ${edge(segment.endAt, day)}`}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Legend() {
  return (
    <ul aria-label="Legend" className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
      {(["free", "booking", "unavailability"] as const).map((kind) => {
        const { label, icon: Icon, iconClass, bar } = KIND[kind];
        return (
          <li key={kind} className="flex items-center gap-1.5">
            <span
              aria-hidden
              className="h-3 w-5 rounded-sm border border-border/60"
              style={bar}
            />
            <Icon className={`h-3.5 w-3.5 ${iconClass}`} aria-hidden />
            {label}
          </li>
        );
      })}
    </ul>
  );
}
