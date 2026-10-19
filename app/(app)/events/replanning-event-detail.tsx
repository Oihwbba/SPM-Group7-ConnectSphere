import Link from "next/link";
import { ArrowLeft, CalendarDays, CheckCircle2, MapPin } from "lucide-react";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatEventTime } from "@/lib/datetime";
import { canWithdrawNow } from "@/lib/registration-state";
import { WithdrawButton } from "./withdraw-button";

export const REPLANNING_LABEL = "Details being updated – registration paused";

/**
 * SCRUM-85 AC9 — a Confirmed event back in Planning, as its registered
 * Attendee sees it: name, description and the date, time and venues last
 * confirmed, never the internal status or anything being planned. Their
 * registration stands (AC10); they can still withdraw (SCRUM-77).
 */
export function ReplanningEventDetail({
  event,
}: {
  event: {
    name: string;
    description: string | null;
    confirmedStartAt: Date | null;
    confirmedEndAt: Date | null;
    confirmedVenues: string[];
    /** The live start, which the server's withdrawal cut-off uses (SCRUM-77 AC3). */
    startAt: Date | null;
    registrations: { id: string; status: string }[];
  };
}) {
  const registration = event.registrations[0];

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link
        href="/registrations"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to my registrations
      </Link>

      <Card data-testid="replanning-event">
        <CardHeader className="space-y-2">
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-xl font-bold leading-none tracking-tight">
              {event.name}
            </h1>
            <Badge variant="warning" data-testid="replanning-status">
              {REPLANNING_LABEL}
            </Badge>
          </div>
          {event.description && (
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">
              {event.description}
            </p>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground" role="status">
            This event&apos;s details are being updated. You&apos;ll be told
            if anything changes. Below are the details as last confirmed.
          </p>
          <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <div className="flex items-start gap-2">
              <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <div>
                <p className="text-xs font-semibold text-muted-foreground">
                  Date &amp; time
                </p>
                <p className="text-foreground" data-testid="event-date">
                  {formatEventTime(event.confirmedStartAt, event.confirmedEndAt)}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <div>
                <p className="text-xs font-semibold text-muted-foreground">
                  {event.confirmedVenues.length > 1 ? "Venues" : "Venue"}
                </p>
                {event.confirmedVenues.map((venue) => (
                  <p key={venue} className="text-foreground" data-testid="venue">
                    {venue}
                  </p>
                ))}
              </div>
            </div>
          </div>
          {registration && (
            <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-3">
              <span
                className="flex items-center gap-1.5 text-sm font-medium text-success"
                data-testid="already-registered"
              >
                <CheckCircle2 className="h-4 w-4" /> You&apos;re registered
              </span>
              {/* SCRUM-77 AC3: offered only before the start, as the server
                  allows. Once withdrawn, this page is no longer theirs to
                  see. */}
              {canWithdrawNow(event) ? (
                <WithdrawButton
                  registrationId={registration.id}
                  afterWithdrawHref="/registrations"
                />
              ) : (
                <span
                  className="text-xs text-muted-foreground"
                  data-testid="withdraw-closed"
                >
                  The event has started, so you can no longer withdraw.
                </span>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
