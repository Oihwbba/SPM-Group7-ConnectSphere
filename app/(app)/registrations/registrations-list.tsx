import Link from "next/link";
import { CalendarDays, MapPin, Ticket } from "lucide-react";
import type { EventStatus, RegistrationStatus } from "@prisma/client";

import { RegistrationStateBadge } from "@/components/events/registration-state-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatEventTime } from "@/lib/datetime";
import { isBeingReplanned, venueLabel } from "@/lib/confirmed-details";
import { canWithdrawRegistration } from "@/lib/registration-summary";
import { REGISTRATION_STATUS_LABEL } from "@/lib/status-labels";
import { REPLANNING_LABEL } from "../events/replanning-event-detail";
import { WithdrawButton } from "../events/withdraw-button";
import type { MyRegistration } from "./queries";

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
  // SCRUM-212 AC2, SCRUM-207 AC3: says why the list is empty and what to do.
  if (registrations.length === 0) {
    return (
      <Card data-testid="registrations-empty">
        <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
          <Ticket className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">
            You haven&apos;t registered for any events yet
          </p>
          <p className="text-xs text-muted-foreground">
            When you register for an event, it appears here with your status.
          </p>
          <Button asChild variant="outline" className="mt-2 h-11 sm:h-10">
            <Link href="/events">Browse Events</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  // SCRUM-212 AC2: one short row per registration: the event, its date and
  // venue, my status, and what I can do about it.
  return (
    <ul className="space-y-3">
      {registrations.map(({ id, status, event }) => {
        const shown = shownRegistrationStatus(status, event.status);
        // SCRUM-85 AC8, AC9: while a registered event is re-planned, its row
        // says so, never "Planning", and shows what was last confirmed.
        const replanning = status === "REGISTERED" && isBeingReplanned(event);
        const venues = replanning
          ? event.confirmedVenues
          : event.bookings.map((b) => venueLabel(b.venue));
        // A Confirmed event has an Attendee detail page (SCRUM-72), and so
        // does one being re-planned, for this Attendee (SCRUM-85 AC9).
        const viewable = event.status === "CONFIRMED" || replanning;
        const withdrawable = canWithdrawRegistration(status, event);

        return (
          <li key={id}>
            <Card
              data-testid="registration-card"
              data-status={shown}
              className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between"
            >
              <div className="min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-semibold leading-tight">
                    {event.name}
                  </h2>
                  <RegistrationStateBadge
                    kind={replanning ? "PAUSED" : shown}
                    label={
                      replanning
                        ? REPLANNING_LABEL
                        : REGISTRATION_STATUS_LABEL[shown]
                    }
                    testId="registration-status"
                  />
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                  <span data-testid="event-date">
                    {replanning
                      ? formatEventTime(
                          event.confirmedStartAt,
                          event.confirmedEndAt,
                        )
                      : formatEventTime(event.startAt, event.endAt)}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  <span data-testid="venue">
                    {venues.length > 0
                      ? venues.join("; ")
                      : "Venue to be confirmed"}
                  </span>
                </div>
                {event.status === "CANCELLED" && event.cancellationReason && (
                  <p
                    data-testid="cancellation-reason"
                    className="text-xs text-foreground"
                  >
                    Cancelled: {event.cancellationReason}
                  </p>
                )}
              </div>
              {(viewable || withdrawable) && (
                <div className="flex flex-col gap-2 sm:shrink-0 sm:flex-row">
                  {viewable && (
                    <Button asChild variant="outline" className="h-11 sm:h-10">
                      <Link href={`/events/${event.id}`}>View event</Link>
                    </Button>
                  )}
                  {withdrawable && (
                    <WithdrawButton
                      registrationId={id}
                      eventName={event.name}
                    />
                  )}
                </div>
              )}
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
