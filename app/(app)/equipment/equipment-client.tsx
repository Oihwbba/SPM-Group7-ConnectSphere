"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createReservation,
  getAllEquipmentAvailability,
} from "./actions";
import { allAvailabilitySchema } from "@/lib/schemas/reservation";

type Equipment = { id: string; type: string; totalQuantity: number };
type Event = { id: string; name: string };
type AvailabilityMap = Record<string, { available: number; total: number }>;

/** A datetime-local control has no zone. Convert it in the browser so the
 * server receives the instant the Technical Support user selected. */
function toUtcIso(localValue: string): string {
  return localValue ? new Date(localValue).toISOString() : localValue;
}

export function EquipmentClient({
  equipment,
  events,
}: {
  equipment: Equipment[];
  events: Event[];
}) {
  const [form, setForm] = useState({
    eventId: "",
    equipmentId: "",
    quantity: "1",
    startAt: "",
    endAt: "",
  });
  const [allAvailability, setAllAvailability] = useState<AvailabilityMap | null>(null);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);

  // Derive per-equipment availability at render time — always in sync with both
  // allAvailability (set by the date-change effect) and form.equipmentId (set by update()).
  const availability =
    form.equipmentId && allAvailability?.[form.equipmentId]
      ? allAvailability[form.equipmentId].available
      : null;
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[] | undefined>>({});
  const [pending, startTransition] = useTransition();

  const update = (field: keyof typeof form, value: string) => {
    const nextForm = { ...form, [field]: value };
    setForm(nextForm);
    if (field === "startAt" || field === "endAt" || !nextForm.startAt || !nextForm.endAt) {
      setAllAvailability(null);
      setAvailabilityError(null);
    }
    if (fieldErrors[field]) {
      setFieldErrors((current) => ({ ...current, [field]: undefined }));
    }
  };

  // Live calculation: automatically fetch availability whenever startAt & endAt change (debounced)
  useEffect(() => {
    if (!form.startAt || !form.endAt) return;

    let isMounted = true;
    const timer = setTimeout(() => {
      startTransition(async () => {
        const parsed = allAvailabilitySchema.safeParse({
          startAt: toUtcIso(form.startAt),
          endAt: toUtcIso(form.endAt),
        });

        if (!parsed.success) {
          if (!isMounted) return;
          setAllAvailability(null);
          const errs = parsed.error.flatten().fieldErrors;
          setFieldErrors((current) => ({
            ...current,
            startAt: errs.startAt,
            endAt: errs.endAt,
          }));
          setAvailabilityError(
            errs.endAt?.[0] || errs.startAt?.[0] || "Invalid reservation period.",
          );
          return;
        }

        try {
          const res = await getAllEquipmentAvailability(parsed.data);

          if (!isMounted) return;

          if (res.ok) {
            setAllAvailability(res.data);
            setAvailabilityError(null);
            setFieldErrors((current) => ({
              ...current,
              startAt: undefined,
              endAt: undefined,
            }));
          } else {
            setAllAvailability(null);
            if (res.fieldErrors) {
              setFieldErrors((current) => ({
                ...current,
                ...res.fieldErrors,
              }));
            }
            setAvailabilityError(
              res.error || "Couldn't calculate availability — check the period and try again",
            );
          }
        } catch {
          if (!isMounted) return;
          setAllAvailability(null);
          setAvailabilityError(
            "Couldn't calculate availability — check the period and try again",
          );
        }
      });
    }, 300);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [form.startAt, form.endAt]);

  const reserve = () =>
    startTransition(async () => {
      setFieldErrors({});
      const result = await createReservation({
        ...form,
        startAt: toUtcIso(form.startAt),
        endAt: toUtcIso(form.endAt),
      });
      if (!result.ok) {
        if (result.fieldErrors) {
          setFieldErrors(result.fieldErrors);
        }
        toast.error(result.error);
        return;
      }
      setFieldErrors({});
      toast.success(
        `Reservation confirmed. ${result.data.available} unit(s) remain available.`,
      );

      // Refresh live availability map (shared error handling with the effect)
      if (form.startAt && form.endAt) {
        try {
          const allRes = await getAllEquipmentAvailability({
            startAt: toUtcIso(form.startAt),
            endAt: toUtcIso(form.endAt),
          });
          if (allRes.ok) {
            setAllAvailability(allRes.data);
          } else {
            setAllAvailability(null);
            setAvailabilityError(
              allRes.error || "Couldn't refresh availability — try changing the period.",
            );
          }
        } catch {
          setAllAvailability(null);
          setAvailabilityError(
            "Couldn't refresh availability — try changing the period.",
          );
        }
      }
    });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Reserve equipment</CardTitle>
          <CardDescription>
            Confirmed reservations secure equipment for the full selected
            period.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="event">Approved event</Label>
            <select
              id="event"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={form.eventId}
              onChange={(e) => update("eventId", e.target.value)}
            >
              <option value="">Select an event</option>
              {events.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.name}
                </option>
              ))}
            </select>
            {fieldErrors.eventId?.[0] && (
              <p className="text-xs text-destructive">{fieldErrors.eventId[0]}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="equipment">Equipment type</Label>
            <select
              id="equipment"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={form.equipmentId}
              onChange={(e) => update("equipmentId", e.target.value)}
            >
              <option value="">Select equipment</option>
              {equipment.map((item) => {
                const liveCount = allAvailability?.[item.id]?.available;
                const statusSuffix =
                  liveCount !== undefined
                    ? ` — ${liveCount} of ${item.totalQuantity} available`
                    : ` (${item.totalQuantity} total)`;
                return (
                  <option key={item.id} value={item.id}>
                    {item.type}
                    {statusSuffix}
                  </option>
                );
              })}
            </select>
            {fieldErrors.equipmentId?.[0] && (
              <p className="text-xs text-destructive">
                {fieldErrors.equipmentId[0]}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="start">Start</Label>
            <Input
              id="start"
              type="datetime-local"
              value={form.startAt}
              onChange={(e) => update("startAt", e.target.value)}
            />
            {fieldErrors.startAt?.[0] && (
              <p className="text-xs text-destructive">{fieldErrors.startAt[0]}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="end">End</Label>
            <Input
              id="end"
              type="datetime-local"
              value={form.endAt}
              onChange={(e) => update("endAt", e.target.value)}
            />
            {fieldErrors.endAt?.[0] && (
              <p className="text-xs text-destructive">{fieldErrors.endAt[0]}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="quantity">Quantity</Label>
            <Input
              id="quantity"
              type="number"
              min="1"
              step="1"
              value={form.quantity}
              onChange={(e) => update("quantity", e.target.value)}
            />
            {fieldErrors.quantity?.[0] && (
              <p className="text-xs text-destructive">
                {fieldErrors.quantity[0]}
              </p>
            )}
          </div>
          <div className="flex items-end">
            <Button type="button" onClick={reserve} disabled={pending}>
              Confirm reservation
            </Button>
          </div>
          {availability !== null && (
            <p
              className="text-sm font-medium text-success md:col-span-2"
              role="status"
            >
              {availability} unit(s) available for this period.
            </p>
          )}
          {!events.length && (
            <p className="text-sm text-muted-foreground md:col-span-2">
              There are no approved events ready for an equipment reservation.
            </p>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Live equipment availability</CardTitle>
          <CardDescription>
            {availabilityError ? (
              <span className="font-medium text-destructive">{availabilityError}</span>
            ) : form.startAt && form.endAt && allAvailability ? (
              "Live availability calculated for the selected period."
            ) : form.startAt && form.endAt ? (
              "Calculating live equipment availability..."
            ) : (
              "Select start and end dates above to view live equipment availability for that period."
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {equipment.map((item) => {
              const itemAvail = allAvailability?.[item.id];
              const isPeriodSelected = Boolean(allAvailability);
              const availableCount = itemAvail ? itemAvail.available : null;
              const totalCount = item.totalQuantity;

              return (
                <div
                  key={item.id}
                  className="rounded-md border p-3 text-sm flex flex-col justify-between space-y-2"
                >
                  <div>
                    <p className="font-medium">{item.type}</p>
                    <p className="text-muted-foreground">
                      {totalCount} total unit(s)
                    </p>
                  </div>
                  {isPeriodSelected && availableCount !== null ? (
                    <div className="flex items-center gap-2 pt-1 border-t">
                      <span
                        className={`inline-block h-2 w-2 rounded-full ${
                          availableCount > 0 ? "bg-success" : "bg-destructive"
                        }`}
                      />
                      <span className="font-semibold text-foreground">
                        {availableCount} of {totalCount} available
                      </span>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground italic pt-1 border-t">
                      Select period above to calculate
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

