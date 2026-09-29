"use client";

import { useState, useSyncExternalStore, useTransition } from "react";
import {
  AlertCircle,
  CalendarX,
  Check,
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
  parseSingaporeDateTime,
  sgWallTimeToUtcIso,
  utcToSgWallTime,
} from "@/lib/datetime";
import { cn } from "@/lib/utils";
import { runAction } from "@/lib/action-result";
import { overCapacityMessage } from "@/lib/schemas/booking";
import { submitBookingRequest, type BookingSummary } from "../actions";
import { DateTimeField } from "@/components/app/date-time-field";
import type { BookableEvent, RequestableVenue } from "../queries";

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
  layout: "",
  notes: "",
};

/** Radix Select cannot use "" as an item value, so "no preference" has its own. */
const NO_LAYOUT = "none";

/**
 * Snap a "YYYY-MM-DDTHH:mm" wall time onto the half-hour grid: a start rounds
 * down and an end rounds up, so a pre-filled event period is never shortened.
 */
export function snapToHalfHour(
  wallTime: string,
  direction: "down" | "up",
): string {
  if (!wallTime.includes("T")) return wallTime;
  const date = parseSingaporeDateTime(wallTime);
  if (!date) return wallTime;
  const step = 30 * 60 * 1000;
  const snapped =
    direction === "down"
      ? Math.floor(date.getTime() / step) * step
      : Math.ceil(date.getTime() / step) * step;
  return utcToSgWallTime(snapped);
}

const emptySubscribe = () => () => {};

/**
 * SCRUM-50 — the Coordinator's request form. Choosing an event pre-fills its
 * times, attendance and needs, which the Coordinator can then adjust. Whether
 * the venue is free is decided by the server action, never here.
 */
export function RequestForm({
  events,
  venues,
}: {
  events: BookableEvent[];
  venues: RequestableVenue[];
}) {
  const [form, setForm] = useState(emptyForm);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [isPending, startTransition] = useTransition();
  // True once React has hydrated, so e2e tests wait before typing.
  const isHydrated = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );

  const facilityOptions = Array.from(
    new Set([
      ...venues.flatMap((v) => v.facilities),
      ...events.flatMap((e) => e.requiredFacilities),
    ]),
  ).sort();
  const layoutOptions = Array.from(
    new Set(venues.flatMap((v) => v.supportedLayouts)),
  ).sort();

  function update<K extends keyof typeof emptyForm>(
    key: K,
    value: (typeof emptyForm)[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function chooseEvent(eventId: string) {
    const event = events.find((e) => e.id === eventId);
    setForm((prev) => ({
      ...prev,
      eventId,
      ...(event && {
        start: snapToHalfHour(utcToSgWallTime(event.startAt), "down"),
        end: snapToHalfHour(utcToSgWallTime(event.endAt), "up"),
        attendance: event.expectedAttendance?.toString() ?? "",
        facilities: event.requiredFacilities,
        layout: event.preferredLayout ?? "",
      }),
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

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await runAction(() =>
        submitBookingRequest({
          eventId: form.eventId,
          venueId: form.venueId,
          startAt: sgWallTimeToUtcIso(form.start) ?? "",
          endAt: sgWallTimeToUtcIso(form.end) ?? "",
          requestedAttendance: form.attendance,
          requiredFacilities: form.facilities,
          requestedLayout: form.layout,
          requestNotes: form.notes,
        }),
      );
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

              <div className="space-y-2">
                <Label htmlFor="venueId">Venue</Label>
                <Select
                  value={form.venueId}
                  onValueChange={(value) => update("venueId", value)}
                >
                  <SelectTrigger id="venueId">
                    <SelectValue placeholder="Select a venue" />
                  </SelectTrigger>
                  <SelectContent>
                    {venues.map((venue) => (
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
                {fieldError("venueId")}
              </div>

              <DateTimeField
                name="Start"
                value={form.start}
                onChange={(value) => update("start", value)}
                error={fieldError("startAt")}
              />
              <DateTimeField
                name="End"
                value={form.end}
                openOn={form.start.split("T")[0]}
                onChange={(value) => update("end", value)}
                error={fieldError("endAt")}
              />

              <div className="space-y-2">
                <Label htmlFor="attendance">Expected attendance</Label>
                <Input
                  id="attendance"
                  type="number"
                  min={1}
                  value={form.attendance}
                  onChange={(e) => update("attendance", e.target.value)}
                  aria-invalid={overCapacity ? true : undefined}
                  aria-describedby={
                    overCapacity ? "attendance-capacity" : undefined
                  }
                  className={cn(
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

              <div className="space-y-2">
                <Label htmlFor="layout">Room layout</Label>
                <Select
                  value={form.layout || NO_LAYOUT}
                  onValueChange={(value) =>
                    update("layout", value === NO_LAYOUT ? "" : value)
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
                disabled={isPending || overCapacity !== null}
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

/** A duplicate or a refusal stays on the page beside the form. */
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
          You already have a pending request for this venue and period
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
