"use client";

import Link from "next/link";
import { CalendarDays, MapPin, Users } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  computeRegistrationState,
  remainingCapacity,
  totalCapacity,
  REGISTRATION_STATE_LABEL,
  type RegistrationState,
} from "@/lib/registration-state";
import { formatDateTimeInTimezone } from "@/lib/datetime";

type Booking = {
  id: string;
  status: string;
  venue: { name: string; location: string };
};

export type BrowsableEvent = {
  id: string;
  name: string;
  description: string | null;
  startAt: Date | null;
  endAt: Date | null;
  timezone: string | null;
  expectedAttendance: number | null;
  registrationEnabled: boolean;
  registrationOpensAt: Date | null;
  registrationClosesAt: Date | null;
  bookings: Booking[];
  _count: { registrations: number };
};

const STATE_BADGE_VARIANT: Record<
  RegistrationState,
  "success" | "destructive" | "warning" | "muted"
> = {
  OPEN: "success",
  FULL: "destructive",
  NOT_YET_OPEN: "warning",
  CLOSED: "muted",
  EXPIRED: "muted",
};

/** SCRUM-72 — the attendee's browse list. Confirmed, non-Cancelled events
 * (already filtered by the query), each shown regardless of registration
 * state per the AC: a full or not-yet-open event stays visible, marked with
 * why registering isn't available right now, rather than disappearing. */
export function AttendeeEventsClient({ events }: { events: BrowsableEvent[] }) {
  if (events.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
          <CalendarDays className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">
            No confirmed events yet
          </p>
          <p className="text-xs text-muted-foreground">
            Check back soon — events appear here once ConnectSphere confirms
            them.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {events.map((event) => {
        const state = computeRegistrationState(
          event,
          event._count.registrations,
        );
        const remaining = remainingCapacity(event, event._count.registrations);
        const venue = event.bookings[0];

        return (
          <Link
            key={event.id}
            href={`/events/${event.id}`}
            data-testid="browsable-event-card"
            data-registration-state={state}
            className="block rounded-lg transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Card className="h-full">
              <CardHeader className="space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base font-semibold leading-tight">
                    {event.name}
                  </CardTitle>
                  <Badge
                    variant={STATE_BADGE_VARIANT[state]}
                    data-testid="registration-state-badge"
                  >
                    {REGISTRATION_STATE_LABEL[state]}
                  </Badge>
                </div>
                {event.description && (
                  <p className="line-clamp-2 text-xs text-muted-foreground">
                    {event.description}
                  </p>
                )}
              </CardHeader>
              <CardContent className="space-y-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                  <span>
                    {event.startAt
                      ? formatDateTimeInTimezone(event.startAt, event.timezone)
                      : "Date to be confirmed"}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  {/* A Confirmed event is expected to carry an approved
                      booking; shown defensively rather than crashing if one
                      is somehow missing. */}
                  <span data-testid="venue">
                    {venue
                      ? `${venue.venue.name} — ${venue.venue.location}`
                      : "Venue to be confirmed"}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 shrink-0" />
                  <span data-testid="remaining-capacity">
                    {remaining} of {totalCapacity(event)} places remaining
                  </span>
                </div>
              </CardContent>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
