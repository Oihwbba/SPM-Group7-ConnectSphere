import Form from "next/form";
import Link from "next/link";
import {
  AlertCircle,
  Building2,
  CalendarRange,
  MapPin,
  SearchX,
  Users,
} from "lucide-react";

import { requireSession } from "@/lib/auth/guard";
import { can } from "@/lib/auth/can";
import { Forbidden } from "@/components/app/forbidden";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { prisma } from "@/lib/db";
import { formatDateTime, utcToSgWallTime } from "@/lib/datetime";
import type { Period } from "@/lib/period";
import {
  isArrivingFor,
  replacementToKeep,
  searchPeriod,
  venueSearchSchema,
  type VenueSearchQuery,
} from "@/lib/schemas/venue-search";
import { searchVenues, type VenueFilters } from "@/lib/venue-search";
import { getBookableEvents } from "@/app/(app)/bookings/queries";
import { EventPicker } from "./event-picker";
import {
  getFilterOptions,
  getSearchEvent,
  type FilterOptions,
  type SearchEvent,
} from "./queries";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** A native select, so its value is sent with the GET form like the inputs. */
const SELECT_CLASS =
  "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

/**
 * SCRUM-38 — search venues by date, time and location, and filter them by
 * what the event needs. Opened from an event (`?event=`), the period is fixed
 * to the event's and each result can be requested straight away; opened from
 * a flagged booking (`&replace=`), it starts from that booking request.
 */
export default async function VenueSearchPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await requireSession();
  if (!can(session.user, "venue:search")) {
    return <Forbidden />;
  }

  const [params, options, bookableEvents] = await Promise.all([
    searchParams,
    getFilterOptions(),
    getBookableEvents(session.user.id),
  ]);
  const parsed = venueSearchSchema.safeParse(params);
  const query = parsed.success ? parsed.data : null;
  const fieldErrors = parsed.success ? {} : parsed.error.flatten().fieldErrors;

  // The event is read on its own, so a mistyped filter doesn't lose it.
  const context = venueSearchSchema
    .pick({ event: true, replace: true, searched: true, searchedFor: true })
    .safeParse(params);
  const chosen = context.success ? context.data : {};
  const opened = chosen.event
    ? await getSearchEvent(
        session.user,
        chosen.event,
        replacementToKeep(chosen),
      )
    : null;
  if (opened && !opened.ok) {
    return (
      <SearchShell>
        <Notice message={opened.error} />
        <Link href="/venues/search" className="text-sm underline">
          Search all venues instead
        </Link>
      </SearchShell>
    );
  }
  const event = opened?.event ?? null;

  // AC1: after arriving, what the Coordinator sent counts, including a filter
  // they cleared.
  const arriving = event !== null && isArrivingFor(event.id, query ?? {});
  const filters: VenueFilters = {
    attendance: arriving ? event.prefill.attendance : query?.attendance,
    facilities: arriving ? event.prefill.facilities : (query?.facility ?? []),
    accessibilityFeatures: query?.access ?? [],
    layout: arriving ? event.prefill.layout : query?.layout,
  };

  const today = utcToSgWallTime(new Date()).slice(0, 10);
  const resolved = event
    ? { period: event.period }
    : query && searchPeriod(query, today);
  const periodError = resolved && "error" in resolved ? resolved.error : null;
  const searched = resolved && "period" in resolved ? resolved : null;

  const results = searched
    ? await searchVenues(prisma, {
        period: searched.period,
        location: query?.location,
        filters,
        eventId: event?.id,
      })
    : null;

  return (
    <SearchShell>
      <SearchForm
        event={event}
        // Only events with dates can fix the search's period.
        events={bookableEvents.filter((e) => e.startAt && e.endAt)}
        query={query}
        filters={filters}
        options={options}
        fieldErrors={{
          ...fieldErrors,
          // Beside whichever end was entered: the end time, else the end date.
          ...(periodError && {
            [query?.to ? "to" : "endDate"]: [periodError],
          }),
        }}
      />
      {results && (
        <Results
          results={results}
          event={event}
          period={searched?.period ?? null}
          showAvailability={can(session.user, "venue:availability")}
        />
      )}
    </SearchShell>
  );
}

function SearchShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Venue search</h1>
        <p className="text-sm text-muted-foreground">
          Find venues that are free and fit. A venue is free when nothing booked
          or recorded there overlaps the period, counting its setup and
          turnaround time. Times are Singapore time.
        </p>
      </div>
      {children}
    </div>
  );
}

function Notice({ message }: { message: string }) {
  return (
    <div
      role="alert"
      data-testid="search-error"
      className="flex gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
    >
      <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
      <p>{message}</p>
    </div>
  );
}

function FieldMessage({ id, messages }: { id: string; messages?: string[] }) {
  return messages?.[0] ? (
    <p id={id} className="text-xs text-destructive">
      {messages[0]}
    </p>
  ) : null;
}

/** AC2, AC6 — one date or time of the period searched, with its error beside it. */
function PeriodField({
  name,
  label,
  type,
  value,
  messages,
}: {
  name: string;
  label: string;
  type: "date" | "time";
  value?: string;
  messages?: string[];
}) {
  const errorId = `${name}-error`;
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        type={type}
        defaultValue={value ?? ""}
        aria-invalid={messages ? true : undefined}
        aria-describedby={messages ? errorId : undefined}
      />
      <FieldMessage id={errorId} messages={messages} />
    </div>
  );
}

/** AC1, AC2, AC11–AC14 — the criteria and filters, sent together as one GET. */
function SearchForm({
  event,
  events,
  query,
  filters,
  options,
  fieldErrors,
}: {
  event: SearchEvent | null;
  events: { id: string; name: string }[];
  query: VenueSearchQuery | null;
  filters: VenueFilters;
  options: FilterOptions;
  fieldErrors: Partial<Record<string, string[]>>;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <Form action="/venues/search" className="space-y-5" noValidate>
          <input type="hidden" name="searched" value="1" />
          <input type="hidden" name="searchedFor" value={event?.id ?? ""} />
          {event?.replacing && (
            <input type="hidden" name="replace" value={event.replacing.id} />
          )}

          <EventPicker
            events={events}
            value={event?.id ?? ""}
            className={SELECT_CLASS}
          />

          {event ? (
            <div
              className="rounded-lg border bg-muted/40 p-3 text-sm"
              data-testid="search-event"
            >
              <p className="font-medium">
                {event.replacing
                  ? `Finding a replacement for ${event.replacing.venueName} — ${event.name}`
                  : `For ${event.name}`}
              </p>
              <p className="text-muted-foreground">
                {formatDateTime(event.period.startAt)} to{" "}
                {formatDateTime(event.period.endAt)}: the event&apos;s date and
                time, which can&apos;t be changed here. Change them on the event
                if they are wrong.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-4">
              <PeriodField
                name="date"
                label="Start date"
                type="date"
                value={query?.date}
                messages={fieldErrors.date}
              />
              <PeriodField
                name="from"
                label="Start time"
                type="time"
                value={query?.from}
                messages={fieldErrors.from}
              />
              <PeriodField
                name="endDate"
                label="End date"
                type="date"
                value={query?.endDate}
                messages={fieldErrors.endDate}
              />
              <PeriodField
                name="to"
                label="End time"
                type="time"
                value={query?.to}
                messages={fieldErrors.to}
              />
              <p className="text-xs text-muted-foreground sm:col-span-4">
                Use dates, times, a location, or any of them together. A start
                date alone means that whole day; leave the end date empty for a
                single day. Times without a date are today.
              </p>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <select
                id="location"
                name="location"
                defaultValue={query?.location ?? ""}
                className={SELECT_CLASS}
              >
                <option value="">Any location</option>
                {options.locations.map((location) => (
                  <option key={location} value={location}>
                    {location}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="attendance">Attendance</Label>
              <Input
                id="attendance"
                name="attendance"
                type="number"
                min={1}
                defaultValue={filters.attendance ?? ""}
                placeholder="Any"
                aria-describedby={
                  fieldErrors.attendance
                    ? "attendance-error"
                    : "attendance-hint"
                }
              />
              {fieldErrors.attendance ? (
                <FieldMessage
                  id="attendance-error"
                  messages={fieldErrors.attendance}
                />
              ) : (
                <p
                  id="attendance-hint"
                  className="text-xs text-muted-foreground"
                >
                  Lower it when a room only needs to hold part of the audience.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="layout">Room layout</Label>
              <select
                id="layout"
                name="layout"
                defaultValue={filters.layout ?? ""}
                className={SELECT_CLASS}
              >
                <option value="">Any layout</option>
                {Array.from(
                  new Set([
                    ...options.layouts,
                    ...(filters.layout ? [filters.layout] : []),
                  ]),
                ).map((layout) => (
                  <option key={layout} value={layout}>
                    {layout}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <CheckboxGroup
            legend="Required facilities"
            name="facility"
            values={options.facilities}
            checked={filters.facilities}
          />
          <CheckboxGroup
            legend="Accessibility features"
            name="access"
            values={options.accessibilityFeatures}
            checked={filters.accessibilityFeatures}
          />

          <div className="flex flex-wrap items-center justify-end gap-3 border-t pt-4">
            <Link
              href={{
                pathname: "/venues/search",
                query: event
                  ? {
                      event: event.id,
                      ...(event.replacing && { replace: event.replacing.id }),
                    }
                  : {},
              }}
              className="text-sm text-muted-foreground underline-offset-4 hover:underline"
            >
              Reset
            </Link>
            <Button type="submit">Search</Button>
          </div>
        </Form>
      </CardContent>
    </Card>
  );
}

/** AC13 — several values can be chosen; a venue must have all of them. */
function CheckboxGroup({
  legend,
  name,
  values,
  checked,
}: {
  legend: string;
  name: string;
  values: string[];
  checked: string[];
}) {
  // A value taken from a booking request (AC1) that no venue lists still
  // shows, so the Coordinator can see it and untick it.
  const all = Array.from(new Set([...values, ...checked])).sort();
  if (all.length === 0) return null;
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {all.map((value) => (
          <label
            key={value}
            className="inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm has-[:checked]:border-foreground has-[:checked]:bg-foreground has-[:checked]:text-background has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring"
          >
            <input
              type="checkbox"
              name={name}
              value={value}
              defaultChecked={checked.includes(value)}
              className="sr-only"
            />
            {value}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** AC8–AC10 — what was found, or a message saying nothing was. */
function Results({
  results,
  event,
  period,
  showAvailability,
}: {
  results: Awaited<ReturnType<typeof searchVenues>>;
  event: SearchEvent | null;
  period: Period | null;
  /** Whether this user may open the availability calendar (SCRUM-36). */
  showAvailability: boolean;
}) {
  // The calendar shows the week containing this Singapore day.
  const week = period ? utcToSgWallTime(period.startAt).slice(0, 10) : null;

  if (results.length === 0) {
    return (
      <Card data-testid="no-venues">
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <SearchX className="h-6 w-6" aria-hidden />
          </span>
          <p className="text-base font-medium">No venues match</p>
          <p className="max-w-md text-sm text-muted-foreground">
            Try another time or location, or turn off a filter.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <section aria-labelledby="results-heading" className="space-y-3">
      <h2 id="results-heading" className="text-sm font-medium">
        {results.length} {results.length === 1 ? "venue" : "venues"}
        {period &&
          ` free from ${formatDateTime(period.startAt)} to ${formatDateTime(period.endAt)}`}
      </h2>
      <ul className="space-y-2">
        {results.map((venue) => (
          <li key={venue.id} data-testid="venue-result" data-venue={venue.id}>
            <Card>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="space-y-1">
                  <p className="flex items-center gap-2 font-medium">
                    <Building2 className="h-4 w-4 text-primary" aria-hidden />
                    {venue.name}
                  </p>
                  <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" aria-hidden />
                      {venue.location}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" aria-hidden />
                      Capacity {venue.capacity}
                    </span>
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {/* The venue's calendar (SCRUM-36), on the week searched. */}
                  {showAvailability && (
                    <Button asChild size="sm" variant="outline">
                      <Link
                        href={{
                          pathname: "/venues/availability",
                          query: {
                            venue: venue.id,
                            ...(week && { week }),
                          },
                        }}
                      >
                        <CalendarRange className="h-4 w-4" aria-hidden /> See
                        availability
                      </Link>
                    </Button>
                  )}
                  {event &&
                    (venue.alreadyRequested ? (
                      <span
                        className="rounded-full border px-3 py-1 text-xs text-muted-foreground"
                        data-testid="already-requested"
                      >
                        Already requested for this event
                      </span>
                    ) : (
                      <Button asChild size="sm">
                        <Link
                          href={{
                            pathname: "/bookings/new",
                            query: { event: event.id, venue: venue.id },
                          }}
                        >
                          Request this venue
                        </Link>
                      </Button>
                    ))}
                </div>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    </section>
  );
}
