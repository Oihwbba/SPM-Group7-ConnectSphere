import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock,
  MapPin,
  Users,
} from "lucide-react";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  computeRegistrationState,
  remainingCapacity,
  totalCapacity,
  canRegisterNow,
  registrationPeriodText,
  REGISTRATION_STATE_LABEL,
} from "@/lib/registration-state";
import { formatEventTime } from "@/lib/datetime";
import { RegisterButton } from "./register-button";
import { WithdrawButton } from "./withdraw-button";
import type { BrowsableEvent } from "./attendee-events-client";

const STATE_BADGE_VARIANT = {
  OPEN: "success",
  FULL: "destructive",
  NOT_YET_OPEN: "warning",
  CLOSED: "muted",
  EXPIRED: "muted",
} as const;

/** SCRUM-72/73/74 — the event detail view: read-only display plus the
 * working Register and Withdraw actions (./register-button.tsx,
 * ./withdraw-button.tsx). Register is disabled whenever the shared
 * registration-state rule says this isn't an OPEN event, so "why can't I
 * register" always matches what the server itself will refuse. */
export function AttendeeEventDetail({ event }: { event: BrowsableEvent }) {
  const state = computeRegistrationState(event, event._count.registrations);
  const remaining = remainingCapacity(event, event._count.registrations);
  const registration = event.registrations[0];
  const isRegistered = registration?.status === "REGISTERED";

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
            {/* A real heading, not CardTitle's <div> — this is the page's
                only h1, both for screen-reader navigation and so an
                automated check can locate the event by name. */}
            <h1 className="text-xl font-bold leading-none tracking-tight">
              {event.name}
            </h1>
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
                <p className="text-foreground" data-testid="event-date">
                  {formatEventTime(event.startAt, event.endAt)}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <div>
                <p className="text-xs font-semibold text-muted-foreground">
                  {event.bookings.length > 1 ? "Venues" : "Venue"}
                </p>
                {/* SCRUM-162 AC7: the name and location of every approved
                    venue. */}
                {event.bookings.length === 0 ? (
                  <p className="text-foreground" data-testid="venue">
                    To be confirmed
                  </p>
                ) : (
                  event.bookings.map((booking) => (
                    <div key={booking.id} data-testid="venue">
                      <p className="text-foreground">{booking.venue.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {booking.venue.location}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Clock className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <div>
                <p className="text-xs font-semibold text-muted-foreground">
                  Registration period
                </p>
                <p
                  className="text-foreground"
                  data-testid="registration-period"
                >
                  {registrationPeriodText(event)}
                </p>
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
            {isRegistered ? (
              <div className="flex items-center gap-3">
                <span
                  className="flex items-center gap-1.5 text-sm font-medium text-success"
                  data-testid="already-registered"
                >
                  <CheckCircle2 className="h-4 w-4" /> You&apos;re registered
                </span>
                <WithdrawButton registrationId={registration!.id} />
              </div>
            ) : (
              <RegisterButton
                eventId={event.id}
                disabled={!canRegisterNow(state)}
              />
            )}
          </div>
          {!isRegistered && !canRegisterNow(state) && (
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
