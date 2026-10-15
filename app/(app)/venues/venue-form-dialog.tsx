"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { venueSchema, venueUpdateSchema } from "@/lib/schemas/venue";
import { minutesToTime, WEEKDAYS } from "@/lib/venue-hours";
import type { VenueOptions } from "@/lib/venue-options";
import { AffectedBookings } from "./affected-bookings";
import { createVenue, updateVenue } from "./actions";
import { OptionPicker } from "./option-picker";
import type { VenueDetail } from "./queries";

type Day = { weekday: number; closed: boolean; opensAt: string; closesAt: string };
type Errors = Record<string, string[] | undefined>;

function formFrom(venue?: VenueDetail) {
  const hours: Day[] = WEEKDAYS.map((_, i) => {
    const weekday = i + 1;
    const saved = venue?.openingHours.find((d) => d.weekday === weekday);
    if (!venue || !saved) {
      return { weekday, closed: false, opensAt: "09:00", closesAt: "18:00" };
    }
    return saved.opensMinute === null || saved.closesMinute === null
      ? { weekday, closed: true, opensAt: "", closesAt: "" }
      : {
          weekday,
          closed: false,
          opensAt: minutesToTime(saved.opensMinute),
          closesAt: minutesToTime(saved.closesMinute),
        };
  });
  return {
    name: venue?.name ?? "",
    location: venue?.location ?? "",
    capacity: venue ? String(venue.capacity) : "",
    facilities: venue?.facilities ?? [],
    accessibilityFeatures: venue?.accessibilityFeatures ?? [],
    supportedLayouts: venue?.supportedLayouts ?? [],
    setupMinutes: venue ? String(venue.setupMinutes) : "0",
    turnaroundMinutes: venue ? String(venue.turnaroundMinutes) : "0",
    knownRestrictions: venue?.knownRestrictions ?? "",
    hours,
  };
}

/**
 * SCRUM-34 AC3–AC6, AC10 — Venue Staff add a venue, or edit one. Each error
 * shows next to its field, a day's hours next to that day (AC5); an edit
 * refused because it would stop future bookings fitting lists them (AC10).
 * Facilities, accessibility features and layouts are chosen from `options`,
 * or added when none fits.
 */
export function VenueFormDialog({
  venue,
  options,
}: {
  venue?: VenueDetail;
  options: VenueOptions;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(() => formFrom(venue));
  const [errors, setErrors] = useState<Errors>({});
  const [affected, setAffected] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();
  const editing = Boolean(venue);
  const idPrefix = editing ? "edit-venue" : "new-venue";

  function changeOpen(next: boolean) {
    setOpen(next);
    if (next) {
      setForm(formFrom(venue));
      setErrors({});
      setAffected([]);
    }
  }

  function set<K extends keyof ReturnType<typeof formFrom>>(
    key: K,
    value: ReturnType<typeof formFrom>[K],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  }

  function setDay(weekday: number, change: Partial<Day>) {
    set(
      "hours",
      form.hours.map((d) => (d.weekday === weekday ? { ...d, ...change } : d)),
    );
    setErrors((current) => ({ ...current, [`hours-${weekday}`]: undefined }));
  }

  function submit() {
    const { hours, ...fields } = form;
    const payload = {
      ...fields,
      openingHours: hours.map(({ weekday, closed, opensAt, closesAt }) =>
        closed ? { weekday, closed } : { weekday, closed, opensAt, closesAt },
      ),
      ...(venue && { venueId: venue.id }),
    };
    const checked = (venue ? venueUpdateSchema : venueSchema).safeParse(payload);
    if (!checked.success) {
      setErrors(checked.error.flatten().fieldErrors);
      toast.error("Please fix the highlighted fields.");
      return;
    }

    startTransition(async () => {
      try {
        const result = venue ? await updateVenue(payload) : await createVenue(payload);
        if (!result.ok) {
          const { affectedBookings, ...fieldErrors } = result.fieldErrors ?? {};
          setErrors(fieldErrors);
          setAffected(affectedBookings ?? []);
          toast.error(result.error);
          return;
        }
        toast.success(venue ? "Venue saved." : "Venue added.");
        setOpen(false);
        if (venue) router.refresh();
        else router.push(`/venues/${result.data.id}`);
      } catch {
        toast.error("Couldn't save the venue. Check your connection and try again.");
      }
    });
  }

  const text = (
    key: "name" | "location" | "capacity" | "setupMinutes" | "turnaroundMinutes",
    label: string,
    props: React.ComponentProps<typeof Input> = {},
    hint?: string,
  ) => {
    const id = `${idPrefix}-${key}`;
    return (
      <div className="space-y-2">
        <Label htmlFor={id}>{label}</Label>
        <Input
          id={id}
          value={form[key]}
          aria-invalid={Boolean(errors[key])}
          aria-describedby={errors[key] ? `${id}-error` : hint ? `${id}-hint` : undefined}
          onChange={(e) => set(key, e.target.value)}
          {...props}
        />
        {hint && !errors[key] && (
          <p id={`${id}-hint`} className="text-xs text-muted-foreground">
            {hint}
          </p>
        )}
        <FieldError id={`${id}-error`} messages={errors[key]} />
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <Button
        type="button"
        variant={editing ? "outline" : "default"}
        className="gap-2"
        onClick={() => changeOpen(true)}
      >
        {editing ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
        {editing ? "Edit venue" : "Add venue"}
      </Button>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{venue ? `Edit ${venue.name}` : "Add a venue"}</DialogTitle>
          <DialogDescription>
            Changes show at once in the catalogue and on the venue request form.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            {text("name", "Name *")}
            {text("location", "Location *")}
          </div>
          {text("capacity", "Capacity *", { inputMode: "numeric" })}
          {(
            [
              ["facilities", "Facilities", "facility"],
              ["accessibilityFeatures", "Accessibility features", "accessibility feature"],
              ["supportedLayouts", "Supported layouts", "layout"],
            ] as const
          ).map(([field, legend, noun]) => (
            <OptionPicker
              key={field}
              id={`${idPrefix}-${field}`}
              legend={legend}
              noun={noun}
              options={options[field]}
              selected={form[field]}
              onChange={(next) => set(field, next)}
              errors={errors[field]}
            />
          ))}

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Opening hours (SGT) *</legend>
            <div className="space-y-2">
              {form.hours.map((day) => {
                const name = WEEKDAYS[day.weekday - 1];
                const errorId = `${idPrefix}-hours-${day.weekday}-error`;
                const dayErrors = errors[`hours-${day.weekday}`];
                return (
                  <div key={day.weekday} className="space-y-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="w-24 text-sm">{name}</span>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          aria-label={`${name} closed`}
                          checked={day.closed}
                          onChange={(e) => setDay(day.weekday, { closed: e.target.checked })}
                        />
                        Closed
                      </label>
                      {!day.closed && (
                        <>
                          <Input
                            type="time"
                            className="w-32"
                            aria-label={`${name} opens`}
                            value={day.opensAt}
                            aria-invalid={Boolean(dayErrors)}
                            aria-describedby={dayErrors ? errorId : undefined}
                            onChange={(e) => setDay(day.weekday, { opensAt: e.target.value })}
                          />
                          <span className="text-sm text-muted-foreground">to</span>
                          <Input
                            type="time"
                            className="w-32"
                            aria-label={`${name} closes`}
                            value={day.closesAt}
                            aria-invalid={Boolean(dayErrors)}
                            aria-describedby={dayErrors ? errorId : undefined}
                            onChange={(e) => setDay(day.weekday, { closesAt: e.target.value })}
                          />
                        </>
                      )}
                    </div>
                    <FieldError id={errorId} messages={dayErrors} />
                  </div>
                );
              })}
            </div>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            {text("setupMinutes", "Setup time (minutes)", { inputMode: "numeric" })}
            {text("turnaroundMinutes", "Turnaround time (minutes)", { inputMode: "numeric" })}
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-knownRestrictions`}>Known restrictions</Label>
            <Textarea
              id={`${idPrefix}-knownRestrictions`}
              value={form.knownRestrictions}
              placeholder="e.g. limited emergency access on the east side"
              aria-invalid={Boolean(errors.knownRestrictions)}
              aria-describedby={
                errors.knownRestrictions ? `${idPrefix}-knownRestrictions-error` : undefined
              }
              onChange={(e) => set("knownRestrictions", e.target.value)}
            />
            <FieldError
              id={`${idPrefix}-knownRestrictions-error`}
              messages={errors.knownRestrictions}
            />
          </div>

          <AffectedBookings bookings={affected} />
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => changeOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button type="button" onClick={submit} disabled={pending} className="gap-2">
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            {pending ? "Saving…" : venue ? "Save venue" : "Add venue"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
