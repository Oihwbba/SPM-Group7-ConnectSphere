"use client";

import {
  useEffect,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";
import {
  AlertCircle,
  CalendarX,
  Check,
  CircleCheck,
  Info,
  Loader2,
  User,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  formatDateTime,
  sgWallTimeToUtcIso,
  utcToSgWallTime,
} from "@/lib/datetime";
import type { ActionResult } from "@/lib/action-result";
import { cn } from "@/lib/utils";
import { isValidPeriod } from "@/lib/period";
import {
  eventBookingPeriod,
  INVALID_PERIOD_MESSAGE,
  overCapacityMessage,
} from "@/lib/schemas/booking";
import {
  checkVenueAvailability,
  submitBookingRequest,
  type BookingSummary,
} from "../actions";
import type {
  BookableEvent,
  JudgementRow,
  RequestableVenue,
} from "../queries";
import { SuitabilityPanel } from "./suitability-panel";
import { OrganiserVenueAnswers } from "@/components/events/organiser-answers";

type Outcome =
  | { kind: "created" | "existing"; booking: BookingSummary }
  | { kind: "refused"; message: string };

const emptyForm = {
  eventId: "",
  venueId: "",
  start: "",
  end: "",
  attendance: "",
  facilities: [] as string[],
  accessibility: [] as string[],
  layout: "",
  notes: "",
};

/** What venue search had entered, carried to the form by Request this venue. */
export type SearchNeeds = {
  facilities: string[];
  accessibility: string[];
  layout?: string;
};

/**
 * SCRUM-38 AC9 — the facilities, accessibility features and layout entered in
 * venue search, as the form starts with them: only values the form offers,
 * and the layout only if the venue chosen in search supports it, so that
 * venue is never dropped. Attendance isn't carried: the booking takes the
 * event's (SCRUM-50 AC1) until SCRUM-162 lets it change.
 */
export function neededInSearch<
  T extends {
    id: string;
    facilities: string[];
    accessibilityFeatures: string[];
    supportedLayouts: string[];
  },
>(venues: T[], venueId: string | undefined, needs: SearchNeeds) {
  const offered = (pick: (v: T) => string[]) =>
    new Set(venues.flatMap(pick));
  const facilities = offered((v) => v.facilities);
  const accessibility = offered((v) => v.accessibilityFeatures);
  const fits = (layout: string) =>
    venueId
      ? venues.some(
          (v) => v.id === venueId && v.supportedLayouts.includes(layout),
        )
      : offered((v) => v.supportedLayouts).has(layout);
  return {
    facilities: needs.facilities.filter((f) => facilities.has(f)),
    accessibility: needs.accessibility.filter((a) => accessibility.has(a)),
    layout: needs.layout && fits(needs.layout) ? needs.layout : "",
  };
}

/** Radix Select cannot use "" as an item value, so "no preference" has its own. */
const NO_LAYOUT = "none";

/**
 * SCRUM-50 — the venues that support `layout`: the layout is chosen first,
 * then only rooms that can be set up that way are offered. With no layout
 * chosen, every venue is offered.
 */
export function venuesForLayout<T extends { supportedLayouts: string[] }>(
  venues: T[],
  layout: string,
): T[] {
  return layout
    ? venues.filter((venue) => venue.supportedLayouts.includes(layout))
    : venues;
}

/** What the live availability check knows about the venue and period chosen. */
export type Live =
  | { state: "checking" }
  | { state: "free" }
  | { state: "taken"; clashes: string[] }
  // The period itself cannot be booked (AC5): Submit is disabled.
  | { state: "invalid"; message: string }
  // The check could not answer; submitting will still check.
  | { state: "error"; message: string };

export const LIVE_CHECK_FAILED_MESSAGE =
  "Availability could not be checked right now; it will be checked again when you submit.";

/**
 * SCRUM-50 — the live check's answer as the form shows it. Only a problem
 * with the period itself blocks Submit; a check that failed (`null`) or was
 * refused for any other reason does not, because submitting checks again.
 * The server owns the clock, so a start that has already passed is found
 * there and reported against the period.
 */
export function liveAnswer(
  result: ActionResult<{ available: boolean; clashes: string[] }> | null,
): Live {
  if (!result) return { state: "error", message: LIVE_CHECK_FAILED_MESSAGE };
  if (!result.ok) {
    const aboutPeriod =
      result.fieldErrors?.startAt || result.fieldErrors?.endAt;
    return { state: aboutPeriod ? "invalid" : "error", message: result.error };
  }
  return result.data.available
    ? { state: "free" }
    : { state: "taken", clashes: result.data.clashes };
}

/** How long typing pauses before the venue is checked. */
const LIVE_CHECK_DELAY_MS = 300;

const emptySubscribe = () => () => {};

/**
 * SCRUM-50 — the Coordinator's request form. Choosing an event fills in its
 * period and expected attendance, which cannot be changed here (AC1), and
 * shows the Organiser's venue and accessibility answers read-only; the
 * Coordinator enters the layout and facilities (SCRUM-170 AC2). The room
 * layout comes before the venue and narrows the venues offered. Once a venue
 * and period are chosen, the server is asked whether the venue is free and the
 * answer is shown before submitting; a taken venue disables Submit. The
 * submission still checks again, so the server stays the one that decides.
 */
export function RequestForm({
  events,
  venues,
  initialEventId,
  initialVenueId,
  initialNeeds,
  judgements = [],
  judgeableEventIds = [],
}: {
  events: BookableEvent[];
  venues: RequestableVenue[];
  /** SCRUM-38 AC9: chosen in venue search, so the form opens with them. */
  initialEventId?: string;
  initialVenueId?: string;
  /** SCRUM-38 AC9: what was entered in venue search (neededInSearch). */
  initialNeeds?: SearchNeeds;
  /** SCRUM-40 AC8 — the Coordinator's judgements for these events. */
  judgements?: JudgementRow[];
  /** SCRUM-40 AC8 — the events this Coordinator may record a judgement for. */
  judgeableEventIds?: string[];
}) {
  const facilityOptions = Array.from(
    new Set(venues.flatMap((v) => v.facilities)),
  ).sort();
  const layoutOptions = Array.from(
    new Set(venues.flatMap((v) => v.supportedLayouts)),
  ).sort();
  // SCRUM-40 AC3 — the accessibility features any venue offers.
  const accessibilityOptions = Array.from(
    new Set(venues.flatMap((v) => v.accessibilityFeatures)),
  ).sort();

  /** A venue chosen earlier is dropped if it cannot take the new layout. */
  const venueFor = (venueId: string, layout: string) =>
    venuesForLayout(venues, layout).some((v) => v.id === venueId)
      ? venueId
      : "";

  // SCRUM-170 AC2: the Organiser's answers are free text, shown beside the
  // form; the layout and facilities are the Coordinator's to enter.
  function withEvent(prev: typeof emptyForm, eventId: string) {
    const event = events.find((e) => e.id === eventId);
    const period = event && eventBookingPeriod(event);
    return {
      ...prev,
      eventId,
      ...(event && {
        start: utcToSgWallTime(period?.startAt),
        end: utcToSgWallTime(period?.endAt),
        attendance: event.expectedAttendance?.toString() ?? "",
      }),
    };
  }

  // SCRUM-38 AC9: the event and venue picked in search are chosen already,
  // with the facilities, accessibility features and layout entered there.
  const [form, setForm] = useState(() => {
    const withChosenEvent = initialEventId
      ? withEvent(emptyForm, initialEventId)
      : emptyForm;
    return {
      ...withChosenEvent,
      ...(initialNeeds &&
        neededInSearch(venues, initialVenueId, initialNeeds)),
      ...(initialVenueId && { venueId: initialVenueId }),
    };
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [isPending, startTransition] = useTransition();
  // True once React has hydrated, so e2e tests wait before typing.
  const isHydrated = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );

  function update<K extends keyof typeof emptyForm>(
    key: K,
    value: (typeof emptyForm)[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function chooseEvent(eventId: string) {
    setForm((prev) => withEvent(prev, eventId));
  }
  const chosenEvent = events.find((e) => e.id === form.eventId);

  function chooseLayout(layout: string) {
    setForm((prev) => ({
      ...prev,
      layout,
      venueId: venueFor(prev.venueId, layout),
    }));
  }

  function toggleFacility(facility: string) {
    update(
      "facilities",
      form.facilities.includes(facility)
        ? form.facilities.filter((f) => f !== facility)
        : [...form.facilities, facility],
    );
  }

  function toggleAccessibility(feature: string) {
    update(
      "accessibility",
      form.accessibility.includes(feature)
        ? form.accessibility.filter((f) => f !== feature)
        : [...form.accessibility, feature],
    );
  }

  // SCRUM-50 AC3 — tell the Coordinator whether the venue is free before
  // they submit. An end at or before the start is caught here without asking
  // the server; otherwise the server is asked once typing pauses, and an
  // answer is shown only for the venue and period it was asked about.
  const startIso = sgWallTimeToUtcIso(form.start);
  const endIso = sgWallTimeToUtcIso(form.end);
  const periodInvalid =
    !!startIso &&
    !!endIso &&
    !isValidPeriod({ startAt: new Date(startIso), endAt: new Date(endIso) });
  const liveKey =
    form.venueId && startIso && endIso && !periodInvalid
      ? `${form.venueId}|${startIso}|${endIso}`
      : "";
  const [live, setLive] = useState<{ key: string; result: Live } | null>(null);

  useEffect(() => {
    if (!liveKey) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const [venueId, startAt, endAt] = liveKey.split("|");
      const result = await checkVenueAvailability({
        venueId,
        startAt,
        endAt,
      }).catch(() => null);
      if (cancelled) return;
      setLive({ key: liveKey, result: liveAnswer(result) });
    }, LIVE_CHECK_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [liveKey]);

  const liveNow: Live | null = periodInvalid
    ? { state: "invalid", message: INVALID_PERIOD_MESSAGE }
    : !liveKey
      ? null
      : live?.key === liveKey
        ? live.result
        : { state: "checking" };
  const blockedLive =
    liveNow?.state === "invalid" || liveNow?.state === "taken";

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await submitBookingRequest({
        eventId: form.eventId,
        venueId: form.venueId,
        startAt: sgWallTimeToUtcIso(form.start) ?? "",
        endAt: sgWallTimeToUtcIso(form.end) ?? "",
        requestedAttendance: form.attendance,
        requiredFacilities: form.facilities,
        requiredAccessibilityFeatures: form.accessibility,
        requestedLayout: form.layout,
        requestNotes: form.notes,
      });
      if (result.ok) {
        setFieldErrors({});
        if (result.data.created) setForm(emptyForm);
        setOutcome({
          kind: result.data.created ? "created" : "existing",
          booking: result.data.booking,
        });
      } else {
        setFieldErrors(result.fieldErrors ?? {});
        setOutcome({ kind: "refused", message: result.error });
      }
    });
  }

  // Nothing to request a venue for yet: say why, rather than show a form
  // that can never succeed.
  if (events.length === 0) {
    return (
      <Card data-hydrated={isHydrated}>
        <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <CalendarX className="h-6 w-6" />
          </span>
          <p className="text-base font-medium">No approved events yet</p>
          <p className="max-w-md text-sm text-muted-foreground">
            A venue can be requested once one of your events has been approved.
            Events still in draft or under review will appear here after
            approval.
          </p>
        </CardContent>
      </Card>
    );
  }

  const layoutVenues = venuesForLayout(venues, form.layout);

  // Caught as it is typed; the server refuses the same thing (actions.ts).
  const selectedVenue = venues.find((v) => v.id === form.venueId);
  const attendance = Number(form.attendance);
  const overCapacity =
    selectedVenue && attendance > selectedVenue.capacity
      ? overCapacityMessage(
          selectedVenue.name,
          selectedVenue.capacity,
          attendance,
        )
      : null;

  const fieldError = (key: string) =>
    fieldErrors[key]?.[0] && (
      <p className="text-xs text-destructive">{fieldErrors[key][0]}</p>
    );

  return (
    <div className="space-y-4" data-hydrated={isHydrated}>
      {outcome && outcome.kind !== "created" && (
        <OutcomePanel outcome={outcome} />
      )}
      <SuccessDialog
        booking={outcome?.kind === "created" ? outcome.booking : null}
        onClose={() => setOutcome(null)}
      />

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={submit} className="space-y-5" noValidate>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="eventId">Event</Label>
                <Select value={form.eventId} onValueChange={chooseEvent}>
                  <SelectTrigger id="eventId">
                    <SelectValue placeholder="Select an approved event" />
                  </SelectTrigger>
                  <SelectContent>
                    {events.map((event) => (
                      <SelectItem key={event.id} value={event.id}>
                        {event.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {fieldError("eventId")}
              </div>

              {chosenEvent && (
                <div className="space-y-2 rounded-md border bg-muted/30 p-3 sm:col-span-2">
                  <p className="text-xs font-medium">
                    What the Organiser asked for
                  </p>
                  <OrganiserVenueAnswers answers={chosenEvent} />
                  <p className="text-xs text-muted-foreground">
                    Choose the layout and facilities yourself; these answers
                    aren&apos;t copied into the request.
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="layout">Room layout</Label>
                <Select
                  value={form.layout || NO_LAYOUT}
                  onValueChange={(value) =>
                    chooseLayout(value === NO_LAYOUT ? "" : value)
                  }
                >
                  <SelectTrigger id="layout">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_LAYOUT}>No preference</SelectItem>
                    {layoutOptions.map((layout) => (
                      <SelectItem key={layout} value={layout}>
                        {layout}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {fieldError("requestedLayout")}
              </div>

              <div className="space-y-2">
                <Label htmlFor="venueId">Venue</Label>
                <Select
                  value={form.venueId}
                  onValueChange={(value) => update("venueId", value)}
                >
                  <SelectTrigger id="venueId">
                    <SelectValue
                      placeholder={
                        layoutVenues.length === 0
                          ? "No venue supports this layout"
                          : "Select a venue"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {layoutVenues.map((venue) => (
                      <SelectItem key={venue.id} value={venue.id}>
                        <span className="flex items-center gap-2">
                          {venue.name}
                          <span
                            className="inline-flex items-center gap-1 text-muted-foreground"
                            title={`Holds up to ${venue.capacity} people`}
                          >
                            <User className="h-3.5 w-3.5" aria-hidden />
                            <span className="sr-only">max capacity</span>
                            {venue.capacity}
                          </span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.layout && layoutVenues.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Showing venues that support the {form.layout} layout.
                  </p>
                )}
                {fieldError("venueId")}
              </div>

              <div className="space-y-2">
                <Label htmlFor="attendance">Expected attendance</Label>
                <Input
                  id="attendance"
                  readOnly
                  value={form.attendance}
                  placeholder="Taken from the event"
                  aria-invalid={overCapacity ? true : undefined}
                  aria-describedby={
                    overCapacity ? "attendance-capacity" : undefined
                  }
                  className={cn(
                    "bg-muted/40",
                    overCapacity &&
                      "border-destructive focus-visible:ring-destructive",
                  )}
                />
                {overCapacity ? (
                  <p
                    id="attendance-capacity"
                    className="text-xs text-destructive"
                  >
                    {overCapacity}
                  </p>
                ) : (
                  fieldError("requestedAttendance")
                )}
              </div>

              {(["start", "end"] as const).map((which) => {
                const iso = sgWallTimeToUtcIso(form[which]);
                const label = which === "start" ? "Start" : "End";
                return (
                  <div key={which} className="space-y-2">
                    <Label htmlFor={which}>{label}</Label>
                    <Input
                      id={which}
                      readOnly
                      value={iso ? formatDateTime(iso) : ""}
                      placeholder="Taken from the event"
                      className="bg-muted/40"
                    />
                    {fieldError(which === "start" ? "startAt" : "endAt")}
                  </div>
                );
              })}
              {form.eventId && (
                <p className="text-xs text-muted-foreground sm:col-span-2">
                  The period and attendance are the event&apos;s, with the
                  period rounded out to the half hour. Change them on the event
                  if they are wrong.
                </p>
              )}

              {liveNow && (
                <LiveAvailability
                  live={liveNow}
                  venueName={selectedVenue?.name ?? "The venue"}
                />
              )}

              {form.eventId && selectedVenue && (
                <SuitabilityPanel
                  eventId={form.eventId}
                  venueId={selectedVenue.id}
                  venue={selectedVenue}
                  needs={{
                    attendance: form.attendance ? attendance : null,
                    facilities: form.facilities,
                    accessibilityFeatures: form.accessibility,
                    layout: form.layout || null,
                  }}
                  judgement={
                    judgements.find(
                      (j) =>
                        j.eventId === form.eventId &&
                        j.venueId === selectedVenue.id,
                    ) ?? null
                  }
                  canJudge={judgeableEventIds.includes(form.eventId)}
                />
              )}
            </div>

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">
                Required facilities
              </legend>
              <div className="flex flex-wrap gap-2">
                {facilityOptions.map((facility) => {
                  const selected = form.facilities.includes(facility);
                  return (
                    <button
                      key={facility}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => toggleFacility(facility)}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        selected
                          ? "border-foreground bg-foreground text-background"
                          : "border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground",
                      )}
                    >
                      {selected && <Check className="h-3.5 w-3.5" />}
                      {facility}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            {accessibilityOptions.length > 0 && (
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">
                  Accessibility needs
                </legend>
                <div className="flex flex-wrap gap-2">
                  {accessibilityOptions.map((feature) => {
                    const selected = form.accessibility.includes(feature);
                    return (
                      <button
                        key={feature}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => toggleAccessibility(feature)}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          selected
                            ? "border-foreground bg-foreground text-background"
                            : "border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground",
                        )}
                      >
                        {selected && <Check className="h-3.5 w-3.5" />}
                        {feature}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            )}

            <div className="space-y-2">
              <Label htmlFor="notes">Other details for Venue Staff</Label>
              <Textarea
                id="notes"
                value={form.notes}
                onChange={(e) => update("notes", e.target.value)}
                placeholder="Setup time, access needs, anything else they should know"
              />
              {fieldError("requestNotes")}
            </div>

            <div className="flex justify-end border-t pt-4">
              <Button
                type="submit"
                disabled={isPending || overCapacity !== null || blockedLive}
              >
                {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Submit request
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * SCRUM-50 AC3/AC5 — the live answer under the period: checking, free, taken
 * (with what it clashes with), or an invalid period. Announced to screen
 * readers as it changes.
 */
function LiveAvailability({
  live,
  venueName,
}: {
  live: Live;
  venueName: string;
}) {
  const tone = {
    checking: "border-border bg-muted/40 text-muted-foreground",
    free: "border-success/30 bg-success/10 text-success",
    taken: "border-destructive/30 bg-destructive/10 text-destructive",
    invalid: "border-destructive/30 bg-destructive/10 text-destructive",
    error: "border-destructive/30 bg-destructive/10 text-destructive",
  }[live.state];

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="live-availability"
      data-state={live.state}
      className={cn(
        "flex items-start gap-2 rounded-lg border px-3 py-2 text-sm sm:col-span-2",
        tone,
      )}
    >
      {live.state === "checking" && (
        <>
          <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" />
          Checking whether {venueName} is free…
        </>
      )}
      {live.state === "free" && (
        <>
          <CircleCheck className="mt-0.5 h-4 w-4 shrink-0" />
          {venueName} is available for this period.
        </>
      )}
      {live.state === "taken" && (
        <>
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            {venueName} is unavailable for this period:{" "}
            {live.clashes.join("; ")}. Choose another time or venue.
          </span>
        </>
      )}
      {(live.state === "invalid" || live.state === "error") && (
        <>
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {live.message}
        </>
      )}
    </div>
  );
}

/** SCRUM-50 AC2 — the confirmation that the request went through. */
function SuccessDialog({
  booking,
  onClose,
}: {
  booking: BookingSummary | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={booking !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        data-testid="booking-success"
        className="max-w-sm text-center sm:text-center"
      >
        <div className="mx-auto mt-2 flex h-20 w-20 items-center justify-center">
          <span className="absolute h-20 w-20 animate-ping rounded-full bg-success/20 [animation-iteration-count:2]" />
          <span className="relative flex h-20 w-20 items-center justify-center rounded-full bg-success text-success-foreground shadow-lg duration-500 animate-in zoom-in-50">
            <Check
              className="h-10 w-10 delay-200 duration-500 animate-in fade-in-0 zoom-in-0 fill-mode-both"
              strokeWidth={3}
            />
          </span>
        </div>
        <DialogTitle className="text-xl">Request submitted</DialogTitle>
        <DialogDescription>
          {booking && (
            <>
              {booking.venueName}, {formatDateTime(booking.startAt)} to{" "}
              {formatDateTime(booking.endAt)}. It is pending Venue Staff
              approval.
            </>
          )}
        </DialogDescription>
        <DialogFooter className="sm:justify-center">
          <Button onClick={onClose} className="w-full sm:w-auto">
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * The event's existing request (SCRUM-50 AC8), or a refusal, stays on the
 * page beside the form.
 */
function OutcomePanel({
  outcome,
}: {
  outcome: Exclude<Outcome, { kind: "created" }>;
}) {
  if (outcome.kind === "refused") {
    return (
      <div
        role="alert"
        data-testid="booking-outcome"
        className="flex gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
      >
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <p className="font-semibold">Request not submitted</p>
          <p>{outcome.message}</p>
        </div>
      </div>
    );
  }

  const { booking } = outcome;
  return (
    <div
      role="status"
      data-testid="booking-outcome"
      className="flex gap-3 rounded-lg border border-info/30 bg-info/10 p-4 text-sm"
    >
      <Info className="mt-0.5 h-5 w-5 shrink-0" />
      <div>
        <p className="font-semibold">
          This event already has a venue request. Each event has one venue.
        </p>
        <p>
          {booking.venueName}, {formatDateTime(booking.startAt)} to{" "}
          {formatDateTime(booking.endAt)} · status{" "}
          {booking.status.toLowerCase()}
        </p>
      </div>
    </div>
  );
}
