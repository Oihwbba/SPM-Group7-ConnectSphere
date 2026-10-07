import Link from "next/link";
import { CalendarDays, MapPin, Ticket } from "lucide-react";
import type { EventStatus, RegistrationStatus } from "@prisma/client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatEventTime } from "@/lib/datetime";
import type { MyRegistration } from "./queries";

const STATUS_LABEL: Record<RegistrationStatus, string> = {
  REGISTERED: "Registered",
  WITHDRAWN: "Withdrawn",
  CANCELLED: "Cancelled",
};

const STATUS_BADGE_VARIANT = {
  REGISTERED: "success",
  WITHDRAWN: "muted",
  CANCELLED: "destructive",
} as const;

/**
 * SCRUM-76 AC3: once ConnectSphere cancels the event, the registration reads
 * as Cancelled, even if the row itself was never updated by the cancellation.
 */
export function shownRegistrationStatus(
  registrationStatus: RegistrationStatus,
  eventStatus: EventStatus,
): RegistrationStatus {
  return eventStatus === "CANCELLED" ? "CANCELLED" : registrationStatus;
}

export function RegistrationsList({
  registrations,
}: {
  registrations: MyRegistration[];
}) {
  if (registrations.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
          <Ticket className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">
            No registrations yet
          </p>
          <p className="text-xs text-muted-foreground">
            Events you register for will appear here.{" "}
            <Link href="/events" className="font-medium text-primary">
              Browse events
            </Link>
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {registrations.map(({ id, status, event }) => {
        const shown = shownRegistrationStatus(status, event.status);
        const venue = event.bookings[0]?.venue;
        // Only a Confirmed event has an Attendee detail page (SCRUM-72).
        const title =
          event.status === "CONFIRMED" ? (
            <Link href={`/events/${event.id}`} className="hover:underline">
              {event.name}
            </Link>
          ) : (
            event.name
          );

        return (
          <Card
            key={id}
            data-testid="registration-card"
            data-status={shown}
            className="h-full"
          >
            <CardHeader className="space-y-1.5">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-base font-semibold leading-tight">
                  {title}
                </CardTitle>
                <Badge
                  variant={STATUS_BADGE_VARIANT[shown]}
                  data-testid="registration-status"
                >
                  {STATUS_LABEL[shown]}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                <span data-testid="event-date">
                  {formatEventTime(event.startAt, event.endAt)}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                <span data-testid="venue">
                  {venue
                    ? `${venue.name} — ${venue.location}`
                    : "Venue to be confirmed"}
                </span>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
