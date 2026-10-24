"use client";

import { useEffect, useState } from "react";
import { BadgeCheck, Building2, Calendar, Wrench } from "lucide-react";
import { StatStrip } from "@/components/app/stat-strip";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getEventArrangements } from "@/app/(app)/events/readiness-actions";
import { formatDate, formatTime } from "@/lib/datetime";
import type { ConfirmedArrangements as Arrangements } from "@/lib/event-readiness";

/**
 * SCRUM-81 AC 6 — on a Confirmed event, what has been secured: the venue,
 * the date and time, and the reserved equipment.
 */
export function ConfirmedArrangements({ eventId }: { eventId: string }) {
  const [arrangements, setArrangements] = useState<Arrangements | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getEventArrangements(eventId)
      .then((result) => {
        if (cancelled) return;
        if (result.ok) setArrangements(result.data);
        else setLoadFailed(true);
      })
      .catch(() => {
        if (!cancelled) setLoadFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  return (
    <Card className="overflow-hidden" data-testid="confirmed-arrangements">
      <CardHeader className="bg-success/10 px-4 py-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <BadgeCheck aria-hidden="true" className="h-4 w-4 text-success" />{" "}
          Confirmed arrangements
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 text-xs">
        {loadFailed ? (
          <p role="alert" className="text-muted-foreground">
            Couldn&apos;t load the confirmed arrangements. Try reopening this
            event.
          </p>
        ) : !arrangements ? (
          <p role="status" className="text-muted-foreground">
            Loading arrangements…
          </p>
        ) : (
          // Shared page conventions: what is secured, as a strip of stats.
          <StatStrip
            stats={[
              {
                icon: Building2,
                label: arrangements.venues.length > 1 ? "Venues" : "Venue",
                // SCRUM-162 AC7: every approved venue.
                value:
                  arrangements.venues.length > 0
                    ? arrangements.venues.map((venue) => venue.name).join(", ")
                    : "—",
                hint: arrangements.venues.map((venue) => venue.location).join("; ") || undefined,
                testId: "confirmed-venue",
              },
              {
                icon: Calendar,
                label: "Date & time",
                value: arrangements.startAt ? formatDate(arrangements.startAt) : "—",
                hint:
                  arrangements.startAt && arrangements.endAt
                    ? `${formatTime(arrangements.startAt)} to ${formatTime(arrangements.endAt)}`
                    : undefined,
              },
              {
                icon: Wrench,
                label: "Equipment",
                value:
                  arrangements.equipment.length > 0
                    ? arrangements.equipment.join(", ")
                    : "None reserved",
                testId: "confirmed-equipment",
              },
            ]}
          />
        )}
      </CardContent>
    </Card>
  );
}
