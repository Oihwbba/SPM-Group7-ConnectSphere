"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { User } from "lucide-react";

import { DatePicker } from "@/components/app/date-picker";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** How often an open calendar re-reads the server (SCRUM-37 AC1). */
const REFRESH_MS = 15_000;

const emptySubscribe = () => () => {};

/**
 * SCRUM-36 — which venue and which dates the calendar shows. Each choice is
 * written to the address, so the server draws the calendar and the view can
 * be shared as a link.
 */
export function RangeControls({
  venues,
  venueId,
  from,
  to,
}: {
  venues: { id: string; name: string; capacity: number }[];
  venueId: string;
  from: string;
  to: string;
}) {
  const router = useRouter();
  const isHydrated = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );

  // SCRUM-37 AC1 — never stale: a booking approved or unavailability recorded
  // elsewhere appears without the viewer reloading.
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, REFRESH_MS);
    return () => clearInterval(interval);
  }, [router]);

  function show(change: Partial<{ venue: string; from: string; to: string }>) {
    const params = new URLSearchParams({ venue: venueId, from, to, ...change });
    router.push(`/venues/availability?${params}`);
  }

  return (
    <div
      data-hydrated={isHydrated}
      className="grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]"
    >
      <div className="space-y-2">
        <Label htmlFor="venue">Venue</Label>
        <Select value={venueId} onValueChange={(venue) => show({ venue })}>
          <SelectTrigger id="venue">
            <SelectValue />
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
      </div>
      <div className="space-y-2">
        <Label htmlFor="rangeFrom">From</Label>
        <DatePicker
          id="rangeFrom"
          label="From"
          value={from}
          onChange={(day) => show({ from: day })}
          className="w-full"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="rangeTo">To</Label>
        <DatePicker
          id="rangeTo"
          label="To"
          value={to}
          onChange={(day) => show({ to: day })}
          className="w-full"
        />
      </div>
    </div>
  );
}
