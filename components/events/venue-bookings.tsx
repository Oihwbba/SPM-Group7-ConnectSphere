"use client";

import { useEffect, useState } from "react";
import { Building2, CheckCircle2 } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getEventBookings } from "@/app/(app)/events/readiness-actions";
import { formatEventTime } from "@/lib/datetime";
import { BOOKING_STATUS_LABEL } from "@/lib/status-labels";
import type { EventVenueBooking } from "@/lib/event-readiness";

/**
 * SCRUM-162 AC7 — every venue booking of the event, with its venue,
 * attendance and status, for its Organiser and its Coordinator.
 */
export function VenueBookings({ eventId }: { eventId: string }) {
  const [bookings, setBookings] = useState<EventVenueBooking[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getEventBookings(eventId)
      .then((result) => {
        if (cancelled) return;
        if (result.ok) setBookings(result.data);
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
    <Card className="overflow-hidden" data-testid="venue-bookings-panel">
      <CardHeader className="bg-muted/30 px-4 py-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <Building2 aria-hidden="true" className="h-4 w-4 text-primary" />{" "}
          Venue bookings
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 text-xs">
        {loadFailed ? (
          <p role="alert" className="text-muted-foreground">
            Couldn&apos;t load the venue bookings. Try reopening this event.
          </p>
        ) : !bookings ? (
          <p role="status" className="text-muted-foreground">
            Loading venue bookings…
          </p>
        ) : bookings.length === 0 ? (
          <p className="text-muted-foreground">No venue requested yet.</p>
        ) : (
          <ul className="space-y-2">
            {bookings.map((booking) => (
              <li
                key={booking.id}
                className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5"
                data-testid="event-venue-booking"
                data-status={booking.status}
              >
                <span>
                  <span className="font-medium">{booking.venueName}</span>
                  {booking.attendance !== null &&
                    ` · ${booking.attendance} people`}
                  <span className="text-muted-foreground">
                    {" · "}
                    {formatEventTime(booking.startAt, booking.endAt)}
                  </span>
                </span>
                <span
                  className={
                    booking.status === "APPROVED"
                      ? "inline-flex items-center gap-1 font-semibold text-success"
                      : "font-semibold"
                  }
                >
                  {/* Shared page conventions: an approval stands out. */}
                  {booking.status === "APPROVED" && (
                    <CheckCircle2 className="h-4 w-4" aria-hidden />
                  )}
                  {BOOKING_STATUS_LABEL[booking.status]}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
