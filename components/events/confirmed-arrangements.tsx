"use client";

import { useEffect, useState } from "react";
import {
  BadgeCheck,
  Building2,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Wrench,
} from "lucide-react";
import { StatStrip } from "@/components/app/stat-strip";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getEventArrangements,
  getEventBookings,
} from "@/app/(app)/events/readiness-actions";
import { BOOKING_STATUS_LABEL } from "@/lib/status-labels";
import type { EventVenueBooking } from "@/lib/event-readiness";
import { formatDate, formatTime } from "@/lib/datetime";
import type { ConfirmedArrangements as Arrangements } from "@/lib/event-readiness";

/**
 * SCRUM-81 AC 6 — on a Confirmed event, what has been secured: the venue,
 * the date and time, and the reserved equipment.
 */
export function ConfirmedArrangements({ eventId }: { eventId: string }) {
  const [arrangements, setArrangements] = useState<Arrangements | null>(null);
  // SCRUM-162 AC7: every venue booking, shown beside what was secured.
  const [bookings, setBookings] = useState<EventVenueBooking[]>([]);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getEventArrangements(eventId), getEventBookings(eventId)])
      .then(([result, booked]) => {
        if (cancelled) return;
        if (booked.ok) setBookings(booked.data);
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
                // One type to a line, in normal text.
                plain: true,
                value:
                  arrangements.equipment.length > 0
                    ? arrangements.equipment.map((item) => (
                        <span key={item} className="block">
                          {item}
                        </span>
                      ))
                    : "None reserved",
                testId: "confirmed-equipment",
              },
              {
                icon: ClipboardList,
                label: "Venue bookings",
                plain: true,
                value:
                  bookings.length > 0
                    ? bookings.map((booking) => (
                        <span
                          key={booking.id}
                          className="flex flex-wrap items-center gap-x-1.5"
                          data-testid="event-venue-booking"
                          data-status={booking.status}
                        >
                          {booking.venueName}
                          <span
                            className={
                              booking.status === "APPROVED"
                                ? "inline-flex items-center gap-1 font-semibold text-success"
                                : "font-semibold text-muted-foreground"
                            }
                          >
                            {booking.status === "APPROVED" && (
                              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                            )}
                            {BOOKING_STATUS_LABEL[booking.status]}
                          </span>
                        </span>
                      ))
                    : "None",
              },
            ]}
          />
        )}
      </CardContent>
    </Card>
  );
}
