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

/** Moves the calendar to another venue or week by rewriting the address. */
function useShow(venueId: string, week: string) {
  const router = useRouter();
  return (change: Partial<{ venue: string; week: string }>) => {
    const params = new URLSearchParams({ venue: venueId, week, ...change });
    router.push(`/venues/availability?${params}`);
  };
}

/**
 * SCRUM-36 AC7 — which week the calendar shows: arrows either side of the
 * week's dates, and the dates themselves open a calendar to jump to any week.
 * Also keeps an open calendar fresh (SCRUM-37 AC1).
 */
export function WeekNav({
  venueId,
  week,
  label,
}: {
  venueId: string;
  /** The Monday of the week shown, "YYYY-MM-DD". */
  week: string;
  /** The week as shown, e.g. "12 – 18 Oct 2026". */
  label: string;
}) {
  const router = useRouter();
  const show = useShow(venueId, week);
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

  return (
    <div data-hydrated={isHydrated} className="flex items-center gap-2">
      <Button
        variant="outline"
        size="icon"
        aria-label="Previous week"
        onClick={() => show({ week: addDays(week, -7) })}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <DatePicker
        id="goToDate"
        label="Go to"
        value=""
        openOn={week}
        display={label}
        allowPast
        onChange={(day) => show({ week: day })}
        className="min-w-48 justify-center"
      />
      <Button
        variant="outline"
        size="icon"
        aria-label="Next week"
        onClick={() => show({ week: addDays(week, 7) })}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

/** SCRUM-36 — which venue the calendar shows. */
export function VenuePicker({
  venues,
  venueId,
  week,
}: {
  venues: { id: string; name: string; capacity: number }[];
  venueId: string;
  week: string;
}) {
  const show = useShow(venueId, week);
  return (
    <div className="flex items-center gap-3">
      <Label htmlFor="venue" className="shrink-0">
        Venue
      </Label>
      <Select value={venueId} onValueChange={(venue) => show({ venue })}>
        <SelectTrigger id="venue" className="w-72 max-w-full">
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
  );
}
