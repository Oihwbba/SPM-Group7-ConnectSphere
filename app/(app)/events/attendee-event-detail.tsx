import Link from "next/link";
import { ArrowLeft, CalendarDays, MapPin, Users } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  computeRegistrationState,
  remainingCapacity,
  totalCapacity,
  canRegisterNow,
  REGISTRATION_STATE_LABEL,
} from "@/lib/registration-state";
import { formatDateTimeInTimezone } from "@/lib/datetime";
import type { BrowsableEvent } from "./attendee-events-client";

const STATE_BADGE_VARIANT = {
  OPEN: "success",
  FULL: "destructive",
  NOT_YET_OPEN: "warning",
  CLOSED: "muted",
  EXPIRED: "muted",
} as const;

/** SCRUM-72 — the read-only detail view. The register action itself
 * (SCRUM-73) is not wired up here on purpose — this story's boundary line
 * hands that to SCRUM-73–75; this button is disabled whenever the state
 * isn't OPEN so the reason is visible even before that action exists. */
export function AttendeeEventDetail({ event }: { event: BrowsableEvent }) {
  const state = computeRegistrationState(event, event._count.registrations);
  const remaining = remainingCapacity(event, event._count.registrations);
  const venue = event.bookings[0];

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link
        href="/events"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to events
      </Link>

      <Card>
        <CardHeader className="space-y-2">
          <div className="flex items-start justify-between gap-3">
            <CardTitle className="text-xl font-bold">{event.name}</CardTitle>
            <Badge
              variant={STATE_BADGE_VARIANT[state]}
              data-testid="registration-state-badge"
            >
              {REGISTRATION_STATE_LABEL[state]}
            </Badge>
          </div>
          {event.description && (
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">
              {event.description}
            </p>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <div className="flex items-start gap-2">
              <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <div>
                <p className="text-xs font-semibold text-muted-foreground">
                  Date &amp; time
                </p>
                <p className="text-foreground">
                  {event.startAt
                    ? formatDateTimeInTimezone(event.startAt, event.timezone)
                    : "To be confirmed"}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <div>
                <p className="text-xs font-semibold text-muted-foreground">
                  Venue
                </p>
                <p className="text-foreground" data-testid="venue">
                  {venue ? venue.venue.name : "To be confirmed"}
                </p>
                {venue && (
                  <p className="text-xs text-muted-foreground">
                    {venue.venue.location}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-3">
            <div className="flex items-center gap-2 text-sm">
              <Users className="h-4 w-4 text-primary" />
              <span data-testid="remaining-capacity">
                {remaining} of {totalCapacity(event)} places remaining
              </span>
            </div>
            <Button
              disabled={!canRegisterNow(state)}
              data-testid="register-button"
            >
              Register
            </Button>
          </div>
          {!canRegisterNow(state) && (
            <p className="text-xs text-muted-foreground" role="status">
              {state === "FULL" &&
                "This event is full. You can check back in case a place opens up."}
              {state === "NOT_YET_OPEN" &&
                "Registration for this event hasn't opened yet."}
              {(state === "CLOSED" || state === "EXPIRED") &&
                "Registration for this event is closed."}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
