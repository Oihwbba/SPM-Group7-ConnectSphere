"use client";

import { useState, useTransition } from "react";
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
import { createReservation, getEquipmentAvailability } from "./actions";

type Equipment = { id: string; type: string; totalQuantity: number };
type Event = { id: string; name: string };

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
  const [availability, setAvailability] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();
  const update = (field: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    if (field !== "quantity") setAvailability(null);
  };

  const checkAvailability = () =>
    startTransition(async () => {
      const result = await getEquipmentAvailability({
        ...form,
        startAt: toUtcIso(form.startAt),
        endAt: toUtcIso(form.endAt),
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setAvailability(result.data.available);
    });

  const reserve = () =>
    startTransition(async () => {
      const result = await createReservation({
        ...form,
        startAt: toUtcIso(form.startAt),
        endAt: toUtcIso(form.endAt),
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setAvailability(result.data.available);
      toast.success(
        `Reservation confirmed. ${result.data.available} unit(s) remain available.`,
      );
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
              {equipment.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.type} ({item.totalQuantity} total)
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="start">Start</Label>
            <Input
              id="start"
              type="datetime-local"
              value={form.startAt}
              onChange={(e) => update("startAt", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="end">End</Label>
            <Input
              id="end"
              type="datetime-local"
              value={form.endAt}
              onChange={(e) => update("endAt", e.target.value)}
            />
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
          </div>
          <div className="flex items-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={checkAvailability}
              disabled={pending}
            >
              Check availability
            </Button>
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
          <CardTitle>Equipment catalogue</CardTitle>
          <CardDescription>
            Total units by type. Check availability for a period before
            reserving, as confirmed reservations and maintenance affect it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {equipment.map((item) => (
              <div key={item.id} className="rounded-md border p-3 text-sm">
                <p className="font-medium">{item.type}</p>
                <p className="text-muted-foreground">
                  {item.totalQuantity} total unit(s)
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
