import Link from "next/link";
import { CalendarDays, MapPin, Ticket } from "lucide-react";
import type { EventStatus, RegistrationStatus } from "@prisma/client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatEventTime } from "@/lib/datetime";
import { isBeingReplanned, venueLabel } from "@/lib/confirmed-details";
import { REGISTRATION_STATUS_LABEL } from "@/lib/status-labels";
import { REPLANNING_LABEL } from "../events/replanning-event-detail";
import type { MyRegistration } from "./queries";

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
        // SCRUM-85 AC8, AC9: while a registered event is re-planned, its card
        // says so, never "Planning", and shows what was last confirmed.
        const replanning = status === "REGISTERED" && isBeingReplanned(event);
        const venues = replanning
          ? event.confirmedVenues
          : event.bookings.map((b) => venueLabel(b.venue));
        // A Confirmed event has an Attendee detail page (SCRUM-72), and so
        // does one being re-planned, for this Attendee (SCRUM-85 AC9).
        const title =
          event.status === "CONFIRMED" || replanning ? (
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
                  variant={replanning ? "warning" : STATUS_BADGE_VARIANT[shown]}
                  data-testid="registration-status"
                >
                  {replanning ? REPLANNING_LABEL : REGISTRATION_STATUS_LABEL[shown]}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                <span data-testid="event-date">
                  {replanning
                    ? formatEventTime(event.confirmedStartAt, event.confirmedEndAt)
                    : formatEventTime(event.startAt, event.endAt)}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                <span data-testid="venue">
                  {venues.length > 0 ? venues.join("; ") : "Venue to be confirmed"}
                </span>
              </div>
              {event.status === "CANCELLED" && event.cancellationReason && (
                <p data-testid="cancellation-reason" className="text-foreground">
                  Cancelled: {event.cancellationReason}
                </p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
