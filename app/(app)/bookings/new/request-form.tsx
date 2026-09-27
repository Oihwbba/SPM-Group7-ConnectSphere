"use client";

import { useState, useSyncExternalStore, useTransition } from "react";
import {
  AlertCircle,
  CalendarX,
  CheckCircle2,
  Info,
  Loader2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  formatDateTime,
  sgWallTimeToUtcIso,
  utcToSgWallTime,
} from "@/lib/datetime";
import { submitBookingRequest, type BookingSummary } from "../actions";
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

const emptySubscribe = () => () => {};

const selectClass =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

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
        start: utcToSgWallTime(event.startAt),
        end: utcToSgWallTime(event.endAt),
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
      const result = await submitBookingRequest({
        eventId: form.eventId,
        venueId: form.venueId,
        startAt: sgWallTimeToUtcIso(form.start) ?? "",
        endAt: sgWallTimeToUtcIso(form.end) ?? "",
        requestedAttendance: form.attendance,
        requiredFacilities: form.facilities,
        requestedLayout: form.layout,
        requestNotes: form.notes,
      });
      if (result.ok) {
        setFieldErrors({});
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

  const fieldError = (key: string) =>
    fieldErrors[key]?.[0] && (
      <p className="text-xs text-destructive">{fieldErrors[key][0]}</p>
    );

  return (
    <div className="space-y-4" data-hydrated={isHydrated}>
      {outcome && <OutcomePanel outcome={outcome} />}

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={submit} className="space-y-5" noValidate>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="eventId">Event</Label>
                <select
                  id="eventId"
                  className={selectClass}
                  value={form.eventId}
                  onChange={(e) => chooseEvent(e.target.value)}
                >
                  <option value="">Select an approved event</option>
                  {events.map((event) => (
                    <option key={event.id} value={event.id}>
                      {event.name}
                    </option>
                  ))}
                </select>
                {fieldError("eventId")}
              </div>

              <div className="space-y-2">
                <Label htmlFor="venueId">Venue</Label>
                <select
                  id="venueId"
                  className={selectClass}
                  value={form.venueId}
                  onChange={(e) => update("venueId", e.target.value)}
                >
                  <option value="">Select a venue</option>
                  {venues.map((venue) => (
                    <option key={venue.id} value={venue.id}>
                      {venue.name} (holds {venue.capacity})
                    </option>
                  ))}
                </select>
                {fieldError("venueId")}
              </div>

              <div className="space-y-2">
                <Label htmlFor="start">Start</Label>
                <Input
                  id="start"
                  type="datetime-local"
                  value={form.start}
                  onChange={(e) => update("start", e.target.value)}
                />
                {fieldError("startAt")}
              </div>

              <div className="space-y-2">
                <Label htmlFor="end">End</Label>
                <Input
                  id="end"
                  type="datetime-local"
                  value={form.end}
                  onChange={(e) => update("end", e.target.value)}
                />
                {fieldError("endAt")}
              </div>

              <div className="space-y-2">
                <Label htmlFor="attendance">Expected attendance</Label>
                <Input
                  id="attendance"
                  type="number"
                  min={1}
                  value={form.attendance}
                  onChange={(e) => update("attendance", e.target.value)}
                />
                {fieldError("requestedAttendance")}
              </div>

              <div className="space-y-2">
                <Label htmlFor="layout">Room layout</Label>
                <select
                  id="layout"
                  className={selectClass}
                  value={form.layout}
                  onChange={(e) => update("layout", e.target.value)}
                >
                  <option value="">No preference</option>
                  {layoutOptions.map((layout) => (
                    <option key={layout} value={layout}>
                      {layout}
                    </option>
                  ))}
                </select>
                {fieldError("requestedLayout")}
              </div>
            </div>

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">
                Required facilities
              </legend>
              <div className="flex flex-wrap gap-x-5 gap-y-2">
                {facilityOptions.map((facility) => (
                  <label
                    key={facility}
                    className="flex items-center gap-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={form.facilities.includes(facility)}
                      onChange={() => toggleFacility(facility)}
                    />
                    {facility}
                  </label>
                ))}
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
              <Button type="submit" disabled={isPending}>
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

function OutcomePanel({ outcome }: { outcome: Outcome }) {
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
  const created = outcome.kind === "created";
  const Icon = created ? CheckCircle2 : Info;
  return (
    <div
      role="status"
      data-testid="booking-outcome"
      className={
        created
          ? "flex gap-3 rounded-lg border border-success/30 bg-success/10 p-4 text-sm"
          : "flex gap-3 rounded-lg border border-info/30 bg-info/10 p-4 text-sm"
      }
    >
      <Icon className="mt-0.5 h-5 w-5 shrink-0" />
      <div>
        <p className="font-semibold">
          {created
            ? "Request submitted — pending a Venue Staff decision"
            : "You already have a pending request for this venue and period"}
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
