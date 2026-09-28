import type { CSSProperties } from "react";
import {
  CalendarCheck,
  CircleCheck,
  Wrench,
  type LucideIcon,
} from "lucide-react";

import {
  formatDate,
  formatDateTime,
  formatTime,
  formatWeekdayDate,
  parseSingaporeDateTime,
} from "@/lib/datetime";
import { cn } from "@/lib/utils";
import {
  addDays,
  startOfSgDay,
  type AvailabilityDay,
  type BlockerDetails,
  type DaySegment,
} from "@/lib/venue-availability";

/** Noon on a Singapore day, so a heading never slips to the day before. */
const noon = (day: string) => parseSingaporeDateTime(`${day}T12:00`)!;

const DAY_MS = 24 * 60 * 60 * 1000;
/** Height of one hour on the week grid, in pixels. */
const HOUR_PX = 24;

/**
 * How each kind of stretch looks and reads. "Visibly different" is never
 * colour alone (SCRUM-36 AC4): each kind also has its own icon and label, and
 * unavailability is striped where a booking is solid.
 */
const KIND: Record<
  DaySegment["kind"],
  {
    label: string;
    icon: LucideIcon;
    iconClass: string;
    bar: CSSProperties;
    text: string;
  }
> = {
  free: {
    label: "Available",
    icon: CircleCheck,
    iconClass: "text-success",
    bar: { backgroundColor: "hsl(var(--success) / 0.14)" },
    text: "text-foreground/70",
  },
  booking: {
    label: "Booked",
    icon: CalendarCheck,
    iconClass: "text-primary",
    bar: { backgroundColor: "hsl(var(--primary) / 0.8)" },
    text: "text-primary-foreground",
  },
  unavailability: {
    label: "Unavailable",
    icon: Wrench,
    iconClass: "text-warning-foreground",
    bar: {
      backgroundImage:
        "repeating-linear-gradient(135deg, hsl(var(--warning)) 0 6px, hsl(var(--warning) / 0.35) 6px 12px)",
    },
    text: "text-warning-foreground",
  },
};

const REASON: Record<string, string> = {
  MAINTENANCE: "Maintenance",
  DAMAGED: "Damaged",
  CLOSURE: "Closure",
  OTHER: "Other",
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

/** What a stretch says in words: "Booked 9:00 am to 1:00 pm". */
function summary(segment: DaySegment, day: string, wholeDay: boolean) {
  return `${labelFor(segment)} ${
    wholeDay
      ? "all day"
      : `${edge(segment.startAt, day)} to ${edge(segment.endAt, day)}`
  }`;
}

const segmentKey = (day: string, segment: DaySegment) =>
  `${day}-${segment.startAt.toISOString()}`;

/**
 * SCRUM-36 — one venue's availability for a week, Monday to Sunday.
 *
 * From tablet width up it is a seven-column week grid on a 24-hour timeline,
 * so stretches meeting at an endpoint sit flush. On a phone, where seven
 * columns do not fit, the same week is a list of days. Either way each day is
 * named by venue and date for a screen reader, each stretch is spoken as
 * words, and hovering, focusing or tapping a booking or unavailability shows
 * its details.
 */
export function AvailabilityCalendar({
  venueName,
  days,
  today,
}: {
  venueName: string;
  days: AvailabilityDay[];
  today: string;
}) {
  const from = days[0].day;
  const to = days[days.length - 1].day;
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
          {venueName} is available for the whole week, {range}.
        </p>
      )}

      <WeekGrid venueName={venueName} days={days} today={today} />
      <DayList venueName={venueName} days={days} />
    </section>
  );
}

/** Tablet and wider: seven columns on a shared 24-hour timeline. */
function WeekGrid({
  venueName,
  days,
  today,
}: {
  venueName: string;
  days: AvailabilityDay[];
  today: string;
}) {
  return (
    <div
      data-view="week"
      className="hidden rounded-xl border border-border/60 bg-card/50 p-3 md:flex"
    >
      {/* Hour marks down the side; decoration, not content. */}
      <div aria-hidden className="w-12 shrink-0 pt-12">
        <div className="relative" style={{ height: 24 * HOUR_PX }}>
          {[3, 6, 9, 12, 15, 18, 21].map((hour) => (
            <span
              key={hour}
              className="absolute right-2 -translate-y-1/2 text-[10px] text-muted-foreground"
              style={{ top: hour * HOUR_PX }}
            >
              {hour === 12
                ? "noon"
                : `${hour % 12}${hour < 12 ? " am" : " pm"}`}
            </span>
          ))}
        </div>
      </div>

      <ol className="grid min-w-0 flex-1 grid-cols-7">
        {days.map(({ day, segments }, column) => (
          <li
            key={day}
            data-day={day}
            aria-label={`${venueName}, ${formatWeekdayDate(noon(day))}`}
            className="min-w-0 border-l border-border/60"
          >
            <div
              className={cn(
                "flex h-12 flex-col items-center justify-center text-xs",
                day === today && "font-semibold text-primary",
              )}
            >
              <span>{formatWeekdayDate(noon(day)).split(",")[0]}</span>
              <span className="text-sm">{Number(day.slice(8))}</span>
            </div>
            <ul
              className="relative"
              style={{
                height: 24 * HOUR_PX,
                backgroundImage: `repeating-linear-gradient(to bottom, transparent 0 ${3 * HOUR_PX - 1}px, hsl(var(--border) / 0.7) ${3 * HOUR_PX - 1}px ${3 * HOUR_PX}px)`,
              }}
            >
              {segments.map((segment) => {
                const top =
                  segment.startAt.getTime() - startOfSgDay(day).getTime();
                const length =
                  segment.endAt.getTime() - segment.startAt.getTime();
                return (
                  <Stretch
                    key={segmentKey(day, segment)}
                    id={segmentKey(day, segment)}
                    day={day}
                    segment={segment}
                    wholeDay={segments.length === 1}
                    // Details open towards the middle, so they stay on screen.
                    opensLeft={column >= 4}
                    style={{
                      position: "absolute",
                      insetInline: segment.kind === "free" ? 0 : 2,
                      top: `${(top / DAY_MS) * 100}%`,
                      height: `${(length / DAY_MS) * 100}%`,
                    }}
                    tall={length >= 90 * 60 * 1000}
                  />
                );
              })}
            </ul>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** One stretch on the week grid; bookings and unavailability show details. */
function Stretch({
  id,
  day,
  segment,
  wholeDay,
  opensLeft,
  style,
  tall,
}: {
  id: string;
  day: string;
  segment: DaySegment;
  wholeDay: boolean;
  opensLeft: boolean;
  style: CSSProperties;
  tall: boolean;
}) {
  const { icon: Icon, bar, text } = KIND[segment.kind];
  const words = summary(segment, day, wholeDay);
  const label = (
    <>
      <span className="sr-only" data-summary>
        {words}
      </span>
      {tall && (
        <span
          aria-hidden
          className={cn(
            "flex items-start gap-1 overflow-hidden p-1 text-[11px] font-medium leading-tight",
            text,
            // Keep the words readable on top of the stripes.
            segment.kind === "unavailability" &&
              "m-0.5 self-start rounded bg-background/85",
          )}
        >
          <Icon className="mt-px h-3 w-3 shrink-0" />
          <span className="min-w-0">
            {segment.kind === "free" ? "Available" : labelFor(segment)}
          </span>
        </span>
      )}
    </>
  );

  if (segment.kind === "free" || !segment.details) {
    return (
      <li data-kind={segment.kind} style={style}>
        <div className="h-full" style={bar}>
          {label}
        </div>
      </li>
    );
  }

  return (
    <li data-kind={segment.kind} style={style} className="group">
      <button
        type="button"
        aria-describedby={`${id}-details`}
        className="flex h-full w-full flex-col items-stretch justify-start overflow-hidden rounded-sm text-left shadow-sm outline-none ring-offset-1 focus-visible:ring-2 focus-visible:ring-ring"
        style={bar}
      >
        {label}
      </button>
      <Details
        id={`${id}-details`}
        details={segment.details}
        reason={segment.kind === "unavailability" ? segment.reason : null}
        className={cn(
          "top-0 w-64",
          opensLeft ? "right-full mr-2" : "left-full ml-2",
        )}
      />
    </li>
  );
}

/** Phone width: the week as a list of days, each stretch in words. */
function DayList({
  venueName,
  days,
}: {
  venueName: string;
  days: AvailabilityDay[];
}) {
  return (
    <ol data-view="list" className="space-y-2 md:hidden">
      {days.map(({ day, segments }) => (
        <li
          key={day}
          data-day={day}
          aria-label={`${venueName}, ${formatWeekdayDate(noon(day))}`}
          className="rounded-xl border border-border/60 bg-card/50 p-3"
        >
          <p className="mb-2 text-sm font-semibold">
            {formatWeekdayDate(noon(day))}
          </p>
          <div
            aria-hidden
            className="mb-2 flex h-6 overflow-hidden rounded-md border border-border/60"
          >
            {segments.map((segment) => (
              <span
                key={segmentKey(day, segment)}
                style={{
                  ...KIND[segment.kind].bar,
                  flexGrow: segment.endAt.getTime() - segment.startAt.getTime(),
                  flexBasis: 0,
                }}
              />
            ))}
          </div>
          <ul className="space-y-1 text-xs">
            {segments.map((segment) => {
              const { icon: Icon, iconClass } = KIND[segment.kind];
              const words = summary(segment, day, segments.length === 1);
              const id = `list-${segmentKey(day, segment)}`;
              const line = (
                <>
                  <Icon
                    className={`h-3.5 w-3.5 shrink-0 ${iconClass}`}
                    aria-hidden
                  />
                  <span data-summary>{words}</span>
                </>
              );
              return (
                <li
                  key={id}
                  data-kind={segment.kind}
                  className="group relative"
                >
                  {segment.kind === "free" || !segment.details ? (
                    <span className="flex items-center gap-1.5">{line}</span>
                  ) : (
                    <>
                      <button
                        type="button"
                        aria-describedby={`${id}-details`}
                        className="flex items-center gap-1.5 rounded-sm text-left underline decoration-dotted underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {line}
                      </button>
                      <Details
                        id={`${id}-details`}
                        details={segment.details}
                        reason={
                          segment.kind === "unavailability"
                            ? segment.reason
                            : null
                        }
                        className="left-0 top-full mt-1 w-full max-w-xs"
                      />
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        </li>
      ))}
    </ol>
  );
}

/**
 * The details card for a booking or unavailability. Shown while its stretch
 * is hovered or focused (or tapped, on a phone); screen readers hear it as
 * the stretch's description.
 */
function Details({
  id,
  details,
  reason,
  className,
}: {
  id: string;
  details: BlockerDetails;
  reason: string | null;
  className?: string;
}) {
  const period = `${formatDateTime(details.startAt)} to ${formatDateTime(details.endAt)}`;
  return (
    <div
      id={id}
      role="tooltip"
      data-testid="stretch-details"
      className={cn(
        "pointer-events-none invisible absolute z-30 space-y-1 rounded-lg border border-border/60 bg-popover/95 p-3 text-xs text-popover-foreground opacity-0 shadow-glass backdrop-blur-glass transition-opacity",
        "group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100",
        className,
      )}
    >
      {details.kind === "booking" ? (
        <>
          <p className="text-sm font-semibold">{details.eventName}</p>
          <p className="font-medium text-primary">Booked</p>
          <p>{period}</p>
          <p>Requested by {details.requestedBy}</p>
          {details.attendance !== null && <p>{details.attendance} expected</p>}
          {details.layout && <p>Layout: {details.layout}</p>}
        </>
      ) : (
        <>
          <p className="text-sm font-semibold">
            {REASON[reason ?? "OTHER"] ?? "Unavailable"}
          </p>
          <p className="font-medium text-warning-foreground">Unavailable</p>
          <p>{period}</p>
          {details.note && <p>{details.note}</p>}
          <p>Recorded by {details.recordedBy}</p>
        </>
      )}
    </div>
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
