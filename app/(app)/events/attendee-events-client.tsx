"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarDays, Clock, MapPin, Users } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RegistrationStateBadge } from "@/components/events/registration-state-badge";
import {
  remainingCapacity,
  totalCapacity,
  registrationPeriodText,
} from "@/lib/registration-state";
import { registrationSummary } from "@/lib/registration-summary";
import { formatEventTime } from "@/lib/datetime";

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
  expectedAttendance: number | null;
  registrationEnabled: boolean;
  registrationOpensAt: Date | null;
  registrationClosesAt: Date | null;
  bookings: Booking[];
  // The caller's OWN registration row, if any (SCRUM-73: "immediately
  // visible to the Attendee with a status of registered"). `id` is carried
  // through so the detail page's Withdraw button (SCRUM-74/77) has something
  // to act on.
  registrations: { id: string; status: string }[];
  _count: { registrations: number };
};

/** SCRUM-72 review: keep events whose name or description contains the
 * keyword, ignoring case. A blank keyword keeps everything. */
export function filterBrowsableEvents<
  T extends Pick<BrowsableEvent, "name" | "description">,
>(events: T[], keyword: string): T[] {
  const q = keyword.trim().toLowerCase();
  if (!q) return events;
  return events.filter(
    (evt) =>
      evt.name.toLowerCase().includes(q) ||
      Boolean(evt.description?.toLowerCase().includes(q)),
  );
}

/** SCRUM-72 — the attendee's browse list. Confirmed, non-Cancelled events
 * (already filtered by the query), each shown regardless of registration
 * state per the AC: a full or not-yet-open event stays visible, marked with
 * why registering isn't available right now, rather than disappearing.
 * SCRUM-212 AC1: each card reads its state at a glance, in the same badge and
 * line as the event page. */
export function AttendeeEventsClient({ events }: { events: BrowsableEvent[] }) {
  const [keyword, setKeyword] = useState("");
  const shown = filterBrowsableEvents(events, keyword);

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
    <div className="space-y-4">
      <input
        type="search"
        aria-label="Search events by name or description"
        placeholder="Search events by name or description..."
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
        className="flex h-11 w-full max-w-sm rounded-md border border-input bg-background px-3 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring sm:h-9"
      />
      {shown.length === 0 ? (
        <p
          className="py-8 text-center text-sm text-muted-foreground"
          role="status"
        >
          No events match your search.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((event) => {
            const remaining = remainingCapacity(
              event,
              event._count.registrations,
            );
            const summary = registrationSummary(
              event,
              event._count.registrations,
              event.registrations[0]?.status === "REGISTERED",
            );

            return (
              <Link
                key={event.id}
                href={`/events/${event.id}`}
                data-testid="browsable-event-card"
                data-registration-state={summary.state}
                className="block rounded-lg transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Card className="h-full">
                  <CardHeader className="space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base font-semibold leading-tight">
                        {event.name}
                      </CardTitle>
                      <RegistrationStateBadge
                        kind={summary.state}
                        label={summary.badge}
                      />
                    </div>
                    <p
                      className="text-sm font-medium text-foreground"
                      data-testid="registration-state-line"
                    >
                      {summary.line}
                    </p>
                    {event.description && (
                      <p className="line-clamp-2 text-xs text-muted-foreground">
                        {event.description}
                      </p>
                    )}
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
                      {/* A Confirmed event is expected to carry an approved
                      booking; shown defensively rather than crashing if one
                      is somehow missing. SCRUM-162 AC7: every approved
                      venue. */}
                      <span data-testid="venue">
                        {event.bookings.length > 0
                          ? event.bookings
                              .map(
                                (b) => `${b.venue.name} — ${b.venue.location}`,
                              )
                              .join("; ")
                          : "Venue to be confirmed"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5 shrink-0" />
                      <span data-testid="remaining-capacity">
                        {remaining} of {totalCapacity(event)} places remaining
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 shrink-0" />
                      <span data-testid="registration-period">
                        {registrationPeriodText(event)}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
