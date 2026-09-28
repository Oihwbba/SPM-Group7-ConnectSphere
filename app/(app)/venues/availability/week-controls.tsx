"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, User } from "lucide-react";

import { DatePicker } from "@/components/app/date-picker";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { addDays } from "@/lib/venue-availability";

/** How often an open calendar re-reads the server (SCRUM-37 AC1). */
const REFRESH_MS = 15_000;

const emptySubscribe = () => () => {};

/**
 * SCRUM-36 — which venue and which week the calendar shows. Each choice is
 * written to the address, so the server draws the calendar and the view can
 * be shared as a link.
 */
export function WeekControls({
  venues,
  venueId,
  week,
  today,
}: {
  venues: { id: string; name: string; capacity: number }[];
  venueId: string;
  /** The Monday of the week shown, "YYYY-MM-DD". */
  week: string;
  today: string;
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

  function show(change: Partial<{ venue: string; week: string }>) {
    const params = new URLSearchParams({ venue: venueId, week, ...change });
    router.push(`/venues/availability?${params}`);
  }

  return (
    <div
      data-hydrated={isHydrated}
      className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"
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

      <div className="flex flex-wrap items-end gap-2">
        <Button
          variant="outline"
          aria-label="Previous week"
          onClick={() => show({ week: addDays(week, -7) })}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="outline" onClick={() => show({ week: today })}>
          This week
        </Button>
        <Button
          variant="outline"
          aria-label="Next week"
          onClick={() => show({ week: addDays(week, 7) })}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <div className="space-y-2">
          <Label htmlFor="goToDate" className="sr-only">
            Go to date
          </Label>
          <DatePicker
            id="goToDate"
            label="Go to"
            value=""
            openOn={week}
            placeholder="Go to date"
            onChange={(day) => show({ week: day })}
            className="w-44"
          />
        </div>
      </div>
    </div>
  );
}
