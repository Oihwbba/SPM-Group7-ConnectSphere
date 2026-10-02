"use client";

import { useEffect, useState } from "react";
import { BadgeCheck } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getEventArrangements } from "@/app/(app)/events/readiness-actions";
import { formatDateTime } from "@/lib/datetime";
import type { ConfirmedArrangements as Arrangements } from "@/lib/event-readiness";

/**
 * SCRUM-81 AC 5 — on a Confirmed event, what has been secured: the venue,
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
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
            <dt className="font-semibold text-muted-foreground">Venue</dt>
            <dd data-testid="confirmed-venue">
              {arrangements.venue
                ? `${arrangements.venue.name}, ${arrangements.venue.location}`
                : "—"}
            </dd>
            <dt className="font-semibold text-muted-foreground">Date & time</dt>
            <dd>
              {arrangements.startAt
                ? formatDateTime(arrangements.startAt)
                : "—"}{" "}
              to {arrangements.endAt ? formatDateTime(arrangements.endAt) : "—"}
            </dd>
            <dt className="font-semibold text-muted-foreground">Equipment</dt>
            <dd data-testid="confirmed-equipment">
              {arrangements.equipment.length > 0
                ? arrangements.equipment.join(", ")
                : "None reserved"}
            </dd>
          </dl>
        )}
      </CardContent>
    </Card>
  );
}
