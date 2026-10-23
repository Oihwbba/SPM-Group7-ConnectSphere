import Form from "next/form";
import Link from "next/link";
import {
  AlertCircle,
  Building2,
  CalendarRange,
  CircleCheck,
  CircleX,
  Lock,
  MapPin,
  Pin,
  Scale,
  Search,
  SearchX,
  Users,
} from "lucide-react";

import { requireSession } from "@/lib/auth/guard";
import { can } from "@/lib/auth/can";
import { AppSelect } from "@/components/app/app-select";
import { DateTimePicker } from "@/components/app/date-time-picker";
import { Forbidden } from "@/components/app/forbidden";
import { OrganiserVenueAnswers } from "@/components/events/organiser-answers";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { prisma } from "@/lib/db";
import {
  formatDate,
  formatDateTime,
  formatTime,
  utcToSgWallTime,
} from "@/lib/datetime";
import type { Period } from "@/lib/period";
import {
  filtersOn,
  isArrivingFor,
  replacementToKeep,
  searchPeriod,
  venueSearchSchema,
  type VenueSearchQuery,
} from "@/lib/schemas/venue-search";
import { searchVenues, type VenueFilters } from "@/lib/venue-search";
import {
  getBookableEvents,
  getSuitabilityJudgements,
  type JudgementRow,
} from "@/app/(app)/bookings/queries";
import { EventPicker } from "./event-picker";
import { RequestVenueButton } from "./request-venue-button";
import { ResetLink } from "./reset-link";
import { TimeField } from "./time-field";
import {
  getFilterOptions,
  getSearchEvent,
  type FilterOptions,
  type SearchEvent,
} from "./queries";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Request this venue (AC9) submits this form to the request form. */
const SEARCH_FORM_ID = "venue-search-form";

/** A native select, so its value is sent with the GET form like the inputs. */

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
  const onlyFitting = filtersOn(query ?? {});

  const today = utcToSgWallTime(new Date()).slice(0, 10);
  const resolved = event
    ? { period: event.period, bookingPeriod: true }
    : query && searchPeriod(query, today);
  const periodError = resolved && "error" in resolved ? resolved.error : null;
  // Shared page conventions: results show once a search is run, not on
  // opening the page; a link that already says what to search runs it.
  const ran = Object.keys(params).some(
    (name) => !["event", "replace", "searchedFor"].includes(name),
  );
  const searched =
    ran && resolved && "period" in resolved ? resolved : null;

  const [results, judgements] = await Promise.all([
    searched
      ? searchVenues(prisma, {
          period: searched.period,
          bookingPeriod: searched.bookingPeriod,
          onlyFitting,
          location: query?.location,
          filters,
          eventId: event?.id,
        })
      : null,
    // SCRUM-40 AC8: for this event, the Coordinator's judgement is the result
    // that counts, so it shows beside the automatic one.
    event ? getSuitabilityJudgements([event.id]) : [],
  ]);

  return (
    <SearchShell>
      <SearchForm
        // A new address rebuilds the form, so each field shows what the
        // address says, not what was left typed in it (Reset, Back).
        key={formKey(params)}
        event={event}
        // Only events with dates can fix the search's period.
        events={bookableEvents.filter((e) => e.startAt && e.endAt)}
        query={query}
        filters={filters}
        onlyFitting={onlyFitting}
        options={options}
        fieldErrors={{
          ...fieldErrors,
          // Within one day, only an end time can come before the start.
          ...(periodError && { to: [periodError] }),
        }}
      />
      {results && (
        <Results
          results={results}
          event={event}
          period={searched?.period ?? null}
          judgements={judgements}
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

/** The address as one string, so the form is rebuilt when it changes. */
function formKey(params: Awaited<SearchParams>): string {
  return new URLSearchParams(
    Object.entries(params).flatMap(([name, value]) =>
      (Array.isArray(value) ? value : value === undefined ? [] : [value]).map(
        (v): [string, string] => [name, v],
      ),
    ),
  ).toString();
}

/** AC2 — the date searched, with its error beside it. */
function DateField({
  value,
  messages,
}: {
  value?: string;
  messages?: string[];
}) {
  const name = "date";
  const errorId = `${name}-error`;
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>Date</Label>
      <DateTimePicker
        id={name}
        mode="date"
        name={name}
        defaultValue={value ?? ""}
        placeholder="Any date"
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
  onlyFitting,
  options,
  fieldErrors,
}: {
  event: SearchEvent | null;
  events: { id: string; name: string }[];
  query: VenueSearchQuery | null;
  filters: VenueFilters;
  onlyFitting: boolean;
  options: FilterOptions;
  fieldErrors: Partial<Record<string, string[]>>;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <Form
          id={SEARCH_FORM_ID}
          action="/venues/search"
          // The address holds the search; a browser restoring what was typed
          // on reload would show fields that don't match the results.
          autoComplete="off"
          className="scroll-mt-24 space-y-5"
          noValidate
        >
          <input type="hidden" name="searched" value="1" />
          <input type="hidden" name="searchedFor" value={event?.id ?? ""} />
          {event?.replacing && (
            <input type="hidden" name="replace" value={event.replacing.id} />
          )}

          <EventPicker events={events} value={event?.id ?? ""} />

          {/* Change 9: for an event, its card on the left third and the
              search on the right two thirds. */}
          <div className={event ? "grid gap-6 lg:grid-cols-3" : "contents"}>
            {event && (
              <aside
                className="h-fit rounded-xl border bg-muted/40 p-4 text-sm lg:sticky lg:top-24"
                data-testid="search-event"
              >
                <p className="flex items-start gap-2 font-medium">
                  <Pin
                    className="mt-0.5 h-4 w-4 shrink-0 text-primary"
                    aria-hidden
                  />
                  {event.replacing
                    ? `Finding a replacement for ${event.replacing.venueName} — ${event.name}`
                    : `For ${event.name}`}
                </p>
                <p className="mt-1 text-muted-foreground">
                  {formatDateTime(event.period.startAt)} to{" "}
                  {formatDateTime(event.period.endAt)}: the event&apos;s date
                  and time, which can&apos;t be changed here. Change them on the
                  event if they are wrong.
                </p>
                {/* AC1 (SCRUM-170 AC6): what the Organiser asked for. */}
                <div className="mt-3 space-y-2 border-t pt-3">
                  <p className="text-xs font-medium">
                    What the Organiser asked for
                  </p>
                  <OrganiserVenueAnswers answers={event.answers} />
                  <p className="text-xs text-muted-foreground">
                    Set the attendance, layout, facilities and accessibility
                    features yourself; these answers aren&apos;t copied into the
                    search.
                  </p>
                </div>
              </aside>
            )}
            <div
              className={
                event ? "space-y-5 lg:col-span-2 lg:border-l lg:pl-6" : "contents"
              }
            >
              {event ? (
                <FixedPeriod period={event.period} />
              ) : (
                <div className="grid gap-4 sm:grid-cols-3">
                  <DateField value={query?.date} messages={fieldErrors.date} />
                  <TimeField
                    name="from"
                    label="Start time"
                    value={query?.from}
                    messages={fieldErrors.from}
                  />
                  <TimeField
                    name="to"
                    label="End time"
                    value={query?.to}
                    messages={fieldErrors.to}
                  />
                  <p className="text-xs text-muted-foreground sm:col-span-3">
                    Use a date, a time range on it, a location, or any of them
                    together. A search covers one day: a date alone means that
                    whole day, and times without a date are today. With a start
                    and an end time, venues closed at those times are left out;
                    without them, only venues closed that day are.
                  </p>
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="location">Location</Label>
                  <AppSelect
                    id="location"
                    name="location"
                    defaultValue={query?.location ?? ""}
                    options={[
                      { value: "", label: "Any location" },
                      ...options.locations.map((location) => ({
                        value: location,
                        label: location,
                      })),
                    ]}
                  />
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
                      Lower it when a room only needs to hold part of the
                      audience.
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="layout">Room layout</Label>
                  <AppSelect
                    id="layout"
                    name="layout"
                    defaultValue={filters.layout ?? ""}
                    options={[
                      { value: "", label: "Any layout" },
                      ...Array.from(
                        new Set([
                          ...options.layouts,
                          ...(filters.layout ? [filters.layout] : []),
                        ]),
                      ).map((layout) => ({ value: layout, label: layout })),
                    ]}
                  />
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

              {/* AC11: the needs above as filters, or only as suitability (AC8). */}
              <div className="flex items-start gap-2">
                <input
                  id="fit"
                  name="fit"
                  type="checkbox"
                  value="1"
                  defaultChecked={onlyFitting}
                  className="mt-0.5 h-4 w-4 rounded border-input accent-primary"
                  aria-describedby="fit-hint"
                />
                <div className="space-y-0.5">
                  <Label htmlFor="fit">Only show venues that fit</Label>
                  <p id="fit-hint" className="text-xs text-muted-foreground">
                    Untick to see every free venue, each marked Suitable or Not
                    suitable with the reasons.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-3 border-t pt-4">
                <ResetLink
                  formId={SEARCH_FORM_ID}
                  href={{
                    pathname: "/venues/search",
                    query: event
                      ? {
                          event: event.id,
                          ...(event.replacing && {
                            replace: event.replacing.id,
                          }),
                        }
                      : {},
                  }}
                  className="text-sm text-muted-foreground underline-offset-4 hover:underline"
                >
                  Reset
                </ResetLink>
                <Button type="submit">Search</Button>
              </div>
            </div>
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

type Result = Awaited<ReturnType<typeof searchVenues>>[number];

/**
 * AC8 — SCRUM-40's indicator and reasons (its AC5–AC7), and, for an event, the
 * Coordinator's judgement, which is the result that counts (its AC8).
 */
function SuitabilityLine({
  suitability,
  judgement,
}: {
  suitability: Result["suitability"];
  judgement?: JudgementRow;
}) {
  return (
    <div className="space-y-1 text-sm" data-testid="result-suitability">
      <p className="flex items-center gap-1.5">
        {suitability.suitable ? (
          <CircleCheck className="h-4 w-4 text-success" aria-hidden />
        ) : (
          <CircleX className="h-4 w-4 text-destructive" aria-hidden />
        )}
        <span className="font-medium" data-testid="suitability-result">
          {suitability.suitable ? "Suitable" : "Not suitable"}
        </span>
      </p>
      {suitability.reasons.length > 0 && (
        <ul className="list-disc space-y-0.5 pl-6 text-destructive">
          {suitability.reasons.map((reason) => (
            <li key={reason} data-testid="suitability-reason">
              {reason}
            </li>
          ))}
        </ul>
      )}
      {judgement && (
        <p
          className="flex items-center gap-1.5 text-muted-foreground"
          data-testid="result-judgement"
        >
          <Scale className="h-4 w-4 text-primary" aria-hidden />
          Coordinator&apos;s judgement:{" "}
          {judgement.suitable ? "Suitable" : "Not suitable"}, the result that
          counts for this event
        </p>
      )}
    </div>
  );
}

/** Back up to the form, to change the search and run it again. */
function SearchAgain() {
  return (
    <Button asChild size="sm" variant="outline">
      <a href={`#${SEARCH_FORM_ID}`}>
        <Search className="h-4 w-4" aria-hidden /> Search again
      </a>
    </Button>
  );
}

/** AC8–AC10 — what was found, or a message saying nothing was. */
function Results({
  results,
  event,
  period,
  judgements,
  showAvailability,
}: {
  results: Result[];
  event: SearchEvent | null;
  period: Period | null;
  judgements: JudgementRow[];
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
          <SearchAgain />
        </CardContent>
      </Card>
    );
  }

  return (
    <section aria-labelledby="results-heading" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="results-heading" className="text-sm font-medium">
          {results.length} {results.length === 1 ? "venue" : "venues"}
          {period &&
            ` free from ${formatDateTime(period.startAt)} to ${formatDateTime(period.endAt)}`}
        </h2>
        <SearchAgain />
      </div>
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
                  <SuitabilityLine
                    suitability={venue.suitability}
                    judgement={judgements.find((j) => j.venueId === venue.id)}
                  />
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
                      // AC9: sends the search form to the request form, so
                      // what is on screen comes across, searched or not.
                      <RequestVenueButton
                        formId={SEARCH_FORM_ID}
                        venueId={venue.id}
                      />
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

/**
 * Change 9 — for an event, the period searched is the event's own: shown in
 * the form, read-only, where the date and times would be (SCRUM-38 AC1).
 */
function FixedPeriod({ period }: { period: { startAt: Date; endAt: Date } }) {
  const fields = [
    {
      id: "event-date",
      label: "Event date",
      value: formatDate(period.startAt),
    },
    {
      id: "event-start",
      label: "Event start",
      value: formatTime(period.startAt),
    },
    {
      id: "event-end",
      label: "Event end",
      value: formatDateTime(period.endAt),
    },
  ];
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {fields.map((field) => (
        <div key={field.id} className="space-y-2">
          <Label htmlFor={field.id} className="flex items-center gap-1.5">
            <Lock className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
            {field.label}
          </Label>
          <Input
            id={field.id}
            value={field.value}
            readOnly
            className="bg-muted/50"
          />
        </div>
      ))}
    </div>
  );
}
