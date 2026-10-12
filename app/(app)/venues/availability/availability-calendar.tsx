import type { CSSProperties } from "react";
import {
  CalendarCheck,
  CircleCheck,
  Hourglass,
  TimerReset,
  Users,
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
import { UNAVAILABILITY_REASON_LABEL } from "@/lib/schemas/unavailability";
import { cn } from "@/lib/utils";
import {
  addDays,
  startOfSgDay,
  type AvailabilityDay,
  type BlockerDetails,
  type DaySegment,
} from "@/lib/venue-availability";
import { WeekScroll } from "./week-scroll";

/** Noon on a Singapore day, so a heading never slips to the day before. */
const noon = (day: string) => parseSingaporeDateTime(`${day}T12:00`)!;

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
/** Height of one hour on the week grid, in pixels. */
const HOUR_PX = 56;
/** The hour the grid opens scrolled to, unless something starts earlier. */
const DAY_STARTS = 7;

/**
 * How each kind of stretch looks and reads. "Visibly different" is never
 * colour alone (SCRUM-36 AC3): each kind also has its own icon and label, and
 * unavailability is striped where a booking is plain. A booking's setup and
 * turnaround (SCRUM-159 AC7) are hatched with a dashed edge, so they read as
 * part of the booking's time at the venue but not as the event itself.
 */
const SETUP_TURNAROUND_CARD: CSSProperties = {
  backgroundImage:
    "repeating-linear-gradient(45deg, hsl(var(--primary) / 0.16) 0 2px, hsl(var(--primary) / 0.04) 2px 8px)",
  borderLeftColor: "hsl(var(--primary) / 0.6)",
  borderLeftStyle: "dashed",
};

const KIND: Record<
  DaySegment["kind"],
  {
    label: string;
    icon: LucideIcon;
    iconClass: string;
    card: CSSProperties;
    accent: string;
  }
> = {
  free: {
    label: "Available",
    icon: CircleCheck,
    iconClass: "text-success",
    card: { backgroundColor: "hsl(var(--success) / 0.12)" },
    accent: "text-success",
  },
  booking: {
    label: "Booked",
    icon: CalendarCheck,
    iconClass: "text-primary",
    card: {
      backgroundColor: "hsl(var(--primary) / 0.12)",
      borderLeftColor: "hsl(var(--primary))",
    },
    accent: "text-primary",
  },
  setup: {
    label: "Setup",
    icon: Hourglass,
    iconClass: "text-primary",
    card: SETUP_TURNAROUND_CARD,
    accent: "text-primary",
  },
  turnaround: {
    label: "Turnaround",
    icon: TimerReset,
    iconClass: "text-primary",
    card: SETUP_TURNAROUND_CARD,
    accent: "text-primary",
  },
  unavailability: {
    label: "Unavailable",
    icon: Wrench,
    iconClass: "text-warning-foreground",
    card: {
      backgroundImage:
        "repeating-linear-gradient(135deg, hsl(var(--warning) / 0.24) 0 6px, hsl(var(--warning) / 0.1) 6px 12px)",
      borderLeftColor: "hsl(var(--warning))",
    },
    accent: "text-warning-foreground",
  },
};

const REASON: Record<string, string> = UNAVAILABILITY_REASON_LABEL;

function labelFor(segment: DaySegment): string {
  if (segment.kind === "unavailability") {
    return `${KIND.unavailability.label} (${REASON[segment.reason].toLowerCase()})`;
  }
  if (segment.kind === "setup" || segment.kind === "turnaround") {
    return `${KIND[segment.kind].label} for ${segment.eventName}`;
  }
  return KIND[segment.kind].label;
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

/** "Cody Coordinator" -> "CC". */
const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

/** A label for the hour marks down the side: "7 am", "noon", "3 pm". */
const hourLabel = (hour: number) =>
  hour === 12 ? "noon" : `${hour % 12 || 12} ${hour < 12 ? "am" : "pm"}`;

/**
 * SCRUM-36 — one venue's availability for a week, Monday to Sunday.
 *
 * From tablet width up it is a seven-column week grid on a 24-hour timeline,
 * opened at the start of the working day, so stretches meeting at an endpoint
 * sit flush. Bookings and unavailability are cards carrying their time and
 * key facts; hovering, focusing or tapping one shows the rest. On a phone,
 * where seven columns do not fit, the same week is a list of days. Either
 * way each day is named by venue and date for a screen reader, and each
 * stretch is spoken as words.
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

  return (
    <section aria-labelledby="calendar-heading" className="space-y-4">
      <h2 id="calendar-heading" className="sr-only">
        {venueName}, {range}
      </h2>
      <div className="flex justify-end">
        <Legend />
      </div>

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
  // Open at the working day, or earlier if something starts earlier.
  const earliest = Math.min(
    DAY_STARTS,
    ...days.flatMap(({ day, segments }) =>
      segments
        .filter((s) => s.kind !== "free")
        .map((s) =>
          Math.floor(
            (s.startAt.getTime() - startOfSgDay(day).getTime()) / HOUR_MS,
          ),
        ),
    ),
  );

  return (
    <div
      data-view="week"
      className="hidden overflow-hidden rounded-xl border border-border/60 bg-background md:block"
    >
      {/* Half an hour of headroom, so the first hour mark is not clipped. */}
      <WeekScroll top={Math.max(0, (earliest - 0.5) * HOUR_PX)}>
        <div className="flex">
          {/* Hour marks down the side; decoration, not content. */}
          <div aria-hidden className="w-14 shrink-0">
            <div className="sticky top-0 z-20 h-16 border-b border-border/60 bg-background" />
            <div className="relative" style={{ height: 24 * HOUR_PX }}>
              {Array.from({ length: 23 }, (_, i) => i + 1).map((hour) => (
                <span
                  key={hour}
                  className="absolute right-2 -translate-y-1/2 text-[11px] text-muted-foreground"
                  style={{ top: hour * HOUR_PX }}
                >
                  {hourLabel(hour)}
                </span>
              ))}
            </div>
          </div>

          <ol className="grid min-w-0 flex-1 grid-cols-7">
            {days.map(({ day, segments }, column) => {
              const isToday = day === today;
              return (
                <li
                  key={day}
                  data-day={day}
                  aria-label={`${venueName}, ${formatWeekdayDate(noon(day))}`}
                  className={cn(
                    "min-w-0 border-l border-border/60",
                    isToday && "bg-muted/60",
                  )}
                >
                  <div
                    className={cn(
                      "sticky top-0 z-20 flex h-16 flex-col justify-center border-b border-border/60 px-3",
                      isToday ? "bg-muted" : "bg-background",
                    )}
                  >
                    <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      {formatWeekdayDate(noon(day)).split(",")[0]}
                    </span>
                    <span
                      className={cn(
                        "text-xl font-semibold leading-tight",
                        isToday && "text-primary",
                      )}
                    >
                      {Number(day.slice(8))}
                    </span>
                  </div>
                  <ul
                    className="relative"
                    style={{
                      height: 24 * HOUR_PX,
                      backgroundImage: `repeating-linear-gradient(to bottom, transparent 0 ${HOUR_PX - 1}px, hsl(var(--border) / 0.6) ${HOUR_PX - 1}px ${HOUR_PX}px)`,
                    }}
                  >
                    {/* A day with nothing on it says so at the top of its
                        column, pinned under the date while the grid scrolls. */}
                    {/* One stretch is not enough: a closure can fill a day too. */}
                    {segments.length === 1 && segments[0].kind === "free" && (
                      <li
                        aria-hidden
                        data-free-all-day
                        className="sticky top-16 z-10 flex items-center gap-1 px-2 py-1.5 text-[11px] font-medium text-success"
                      >
                        <CircleCheck className="h-3 w-3 shrink-0" />
                        Available all day
                      </li>
                    )}
                    {segments.map((segment) => {
                      const offset =
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
                          hours={length / HOUR_MS}
                          style={{
                            position: "absolute",
                            insetInline: segment.kind === "free" ? 0 : 4,
                            top: `${(offset / DAY_MS) * 100}%`,
                            height: `${(length / DAY_MS) * 100}%`,
                          }}
                        />
                      );
                    })}
                  </ul>
                </li>
              );
            })}
          </ol>
        </div>
      </WeekScroll>
    </div>
  );
}

/**
 * One stretch on the week grid. Free time is plain, with a faint label; a
 * booking or unavailability is a card showing its time, what it is and one
 * key fact, with the rest on hover.
 */
function Stretch({
  id,
  day,
  segment,
  wholeDay,
  opensLeft,
  hours,
  style,
}: {
  id: string;
  day: string;
  segment: DaySegment;
  wholeDay: boolean;
  opensLeft: boolean;
  hours: number;
  style: CSSProperties;
}) {
  const words = summary(segment, day, wholeDay);

  // SCRUM-159 AC7: a booking's setup or turnaround, drawn beside the booking.
  if (segment.kind === "setup" || segment.kind === "turnaround") {
    const { card, accent, icon: Icon, label } = KIND[segment.kind];
    return (
      <li data-kind={segment.kind} style={style}>
        <div
          className="flex h-full w-full items-start overflow-hidden rounded-md border-l-[3px] px-2 py-0.5"
          style={card}
        >
          <span className="sr-only" data-summary>
            {words}
          </span>
          {hours >= 0.4 && (
            <span
              aria-hidden
              className={cn(
                "flex items-center gap-1 text-[11px] font-medium",
                accent,
              )}
            >
              <Icon className="h-3 w-3 shrink-0" />
              {label}
            </span>
          )}
        </div>
      </li>
    );
  }

  if (segment.kind === "free" || !segment.details) {
    return (
      <li data-kind={segment.kind} style={style}>
        <span className="sr-only" data-summary>
          {words}
        </span>
        {segment.kind === "free" && hours >= 2 && !wholeDay && (
          <span
            aria-hidden
            className="flex items-center gap-1 px-2 pt-1.5 text-[11px] text-muted-foreground/70"
          >
            <CircleCheck className="h-3 w-3 text-success/70" />
            Available
          </span>
        )}
      </li>
    );
  }

  const { details } = segment;
  const { card, accent, icon: Icon } = KIND[segment.kind];
  const time = `${edge(segment.startAt, day)} – ${edge(segment.endAt, day)}`;
  const title =
    details.kind === "booking"
      ? details.eventName
      : (REASON[segment.kind === "unavailability" ? segment.reason : ""] ??
        "Unavailable");

  return (
    <li data-kind={segment.kind} style={style} className="group">
      <button
        type="button"
        aria-label={words}
        aria-describedby={`${id}-details`}
        className="flex h-full w-full flex-col items-stretch justify-start gap-0.5 overflow-hidden rounded-md border-l-[3px] px-2 py-1.5 text-left shadow-sm outline-none transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring"
        style={card}
      >
        <span className="sr-only" data-summary>
          {words}
        </span>
        <span
          aria-hidden
          className={cn(
            "flex items-center gap-1 text-[11px] font-medium",
            accent,
          )}
        >
          <Icon className="h-3 w-3 shrink-0" />
          {time}
        </span>
        {hours >= 0.75 && (
          <span
            aria-hidden
            className="line-clamp-2 text-xs font-semibold leading-snug text-foreground"
          >
            {title}
          </span>
        )}
        {hours >= 1.5 &&
          (details.kind === "booking" ? (
            <span
              aria-hidden
              className="mt-auto flex items-center gap-2 text-[11px] text-muted-foreground"
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[9px] font-semibold text-primary-foreground">
                {initials(details.requestedBy)}
              </span>
              {details.attendance !== null && (
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {details.attendance}
                </span>
              )}
            </span>
          ) : (
            details.note && (
              <span
                aria-hidden
                className="line-clamp-2 text-[11px] text-muted-foreground"
              >
                {details.note}
              </span>
            )
          ))}
      </button>
      <Details
        id={`${id}-details`}
        details={details}
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
          <ul className="space-y-1.5 text-xs">
            {segments.map((segment) => {
              const { icon: Icon, iconClass, card } = KIND[segment.kind];
              const words = summary(segment, day, segments.length === 1);
              const id = `list-${segmentKey(day, segment)}`;
              if (
                segment.kind === "free" ||
                segment.kind === "setup" ||
                segment.kind === "turnaround" ||
                !segment.details
              ) {
                return (
                  <li
                    key={id}
                    data-kind={segment.kind}
                    className="flex items-center gap-1.5 px-2 text-muted-foreground"
                  >
                    <Icon
                      className={`h-3.5 w-3.5 shrink-0 ${iconClass}`}
                      aria-hidden
                    />
                    <span data-summary>{words}</span>
                  </li>
                );
              }
              return (
                <li
                  key={id}
                  data-kind={segment.kind}
                  className="group relative"
                >
                  <button
                    type="button"
                    aria-describedby={`${id}-details`}
                    className="flex w-full items-center gap-1.5 rounded-md border-l-[3px] px-2 py-1.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    style={card}
                  >
                    <Icon
                      className={`h-3.5 w-3.5 shrink-0 ${iconClass}`}
                      aria-hidden
                    />
                    <span data-summary>{words}</span>
                  </button>
                  <Details
                    id={`${id}-details`}
                    details={segment.details}
                    reason={
                      segment.kind === "unavailability" ? segment.reason : null
                    }
                    className="left-0 top-full mt-1 w-full max-w-xs"
                  />
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
        "pointer-events-none invisible absolute z-30 space-y-1 rounded-lg border border-border/60 bg-popover p-3 text-xs text-popover-foreground opacity-0 shadow-lg transition-opacity",
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
      {(
        ["free", "booking", "setup", "turnaround", "unavailability"] as const
      ).map((kind) => {
        const { label, icon: Icon, iconClass, card } = KIND[kind];
        return (
          <li key={kind} className="flex items-center gap-1.5">
            <span
              aria-hidden
              className="h-4 w-6 rounded-sm border-l-[3px] border-transparent"
              style={card}
            />
            <Icon className={`h-3.5 w-3.5 ${iconClass}`} aria-hidden />
            {label}
          </li>
        );
      })}
    </ul>
  );
}
