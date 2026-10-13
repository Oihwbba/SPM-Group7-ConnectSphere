import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Building2, History, Wrench } from "lucide-react";

import { requireSession } from "@/lib/auth/guard";
import { can } from "@/lib/auth/can";
import { Forbidden } from "@/components/app/forbidden";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime, formatEventTime } from "@/lib/datetime";
import { SAFETY_CHECK_LABEL } from "@/lib/safety-check";
import { getSafetyCheckReview } from "../queries";
import { OutcomeForm } from "./outcome-form";

const list = (values: string[]) => (values.length ? values.join(", ") : "None recorded");
const or = (value: string | null) => value || "None recorded";

/**
 * SCRUM-166 AC2 — everything a Safety Officer reviews, read-only, and the
 * outcome form while the check awaits review (AC3). Earlier checks for the
 * same event are listed beneath it (AC5).
 */
export default async function SafetyCheckReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  if (!can(session.user, "safety-check:review")) {
    return <Forbidden />;
  }
  const { id } = await params;
  const check = await getSafetyCheckReview(session.user, id);
  if (!check) notFound();
  const { event } = check;

  return (
    <div className="space-y-6">
      <Link
        href="/safety-checks"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft aria-hidden="true" className="h-4 w-4" /> Safety checks
      </Link>

      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{event.name}</h1>
        <p className="text-sm text-muted-foreground">
          {formatEventTime(event.startAt, event.endAt)} ·{" "}
          {event.expectedAttendance ?? "—"} expected · Requested by{" "}
          {check.requestedBy} on {formatDateTime(check.requestedAt)}
        </p>
        <p className="text-sm" data-testid="safety-check-status">
          Status: <span className="font-semibold">{SAFETY_CHECK_LABEL[check.status]}</span>
          {check.decidedBy &&
            ` — recorded by ${check.decidedBy} on ${formatDateTime(check.decidedAt!)}`}
        </p>
        {check.note && <p className="text-sm">Note: {check.note}</p>}
      </div>

      <Card>
        <CardHeader className="bg-muted/30 px-4 py-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <Building2 aria-hidden="true" className="h-4 w-4 text-primary" /> Venues
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 p-4 text-sm">
          <p>
            <span className="font-semibold">Accessibility needs:</span>{" "}
            {or(event.accessibilityNeeds)}
          </p>
          {check.venues.length === 0 && <p>No venue is booked.</p>}
          {check.venues.map((venue) => (
            <dl
              key={venue.bookingId}
              className="grid gap-x-4 gap-y-1 border-t pt-3 sm:grid-cols-[12rem_1fr]"
              data-testid="safety-check-venue"
            >
              <dt className="col-span-full font-semibold">{venue.name}</dt>
              <dt className="text-muted-foreground">Capacity</dt>
              <dd>{venue.capacity}</dd>
              <dt className="text-muted-foreground">Attendance booked</dt>
              <dd>{venue.bookedAttendance ?? event.expectedAttendance ?? "—"}</dd>
              <dt className="text-muted-foreground">Requested layout</dt>
              <dd>{or(venue.requestedLayout ?? event.preferredLayout)}</dd>
              <dt className="text-muted-foreground">Supported layouts</dt>
              <dd>{list(venue.supportedLayouts)}</dd>
              <dt className="text-muted-foreground">Accessibility features</dt>
              <dd>{list(venue.accessibilityFeatures)}</dd>
              <dt className="text-muted-foreground">Setup and turnaround</dt>
              <dd>
                {venue.setupMinutes} min before, {venue.turnaroundMinutes} min after
              </dd>
              <dt className="text-muted-foreground">Known restrictions</dt>
              <dd>{or(venue.knownRestrictions)}</dd>
            </dl>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="bg-muted/30 px-4 py-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <Wrench aria-hidden="true" className="h-4 w-4 text-primary" /> Reserved equipment
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 p-4 text-sm">
          {check.equipment.length === 0 && <p>No equipment is reserved.</p>}
          {check.equipment.map((item) => (
            <div key={item.reservationId} data-testid="safety-check-equipment">
              <p className="font-semibold">
                {item.type} × {item.quantity}
              </p>
              <p className="text-muted-foreground">
                Specs: {or(item.technicalSpecs)}
              </p>
              <p>Technical requirements and placement: {or(item.technicalRequirements)}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      {check.status === "AWAITING_REVIEW" && (
        <OutcomeForm
          checkId={check.id}
          arrangements={[
            ...check.venues.map((v) => ({
              kind: "booking" as const,
              id: v.bookingId,
              label: v.name,
            })),
            ...check.equipment.map((e) => ({
              kind: "reservation" as const,
              id: e.reservationId,
              label: `${e.type} × ${e.quantity}`,
            })),
          ]}
        />
      )}

      {check.history.length > 0 && (
        <Card>
          <CardHeader className="bg-muted/30 px-4 py-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <History aria-hidden="true" className="h-4 w-4 text-primary" /> Earlier
              checks for this event
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 p-4 text-sm">
            {check.history.map((past) => (
              <p key={past.id}>
                <span className="font-semibold">{SAFETY_CHECK_LABEL[past.status]}</span>
                {past.decidedBy &&
                  ` by ${past.decidedBy} on ${formatDateTime(past.decidedAt!)}`}
                {past.note && ` — ${past.note}`}
                <span className="text-muted-foreground">
                  {" "}
                  (requested {formatDateTime(past.requestedAt)})
                </span>
              </p>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
