import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { requireSession } from "@/lib/auth/guard";
import { can } from "@/lib/auth/can";
import { Forbidden } from "@/components/app/forbidden";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { describeHours, WEEKDAYS } from "@/lib/venue-hours";
import { getVenueDetail, getVenueOptions } from "../queries";
import { RetireVenueDialog } from "../retire-venue-dialog";
import { VenueFormDialog } from "../venue-form-dialog";

/** "wheelchair-access" -> "wheelchair access" */
const readable = (tag: string) => tag.replace(/-/g, " ");

function Tags({ values, empty }: { values: string[]; empty: string }) {
  if (values.length === 0) {
    return <p className="text-sm text-muted-foreground">{empty}</p>;
  }
  return (
    <ul className="flex flex-wrap gap-2">
      {values.map((value) => (
        <li key={value}>
          <Badge variant="secondary">{readable(value)}</Badge>
        </li>
      ))}
    </ul>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

/**
 * SCRUM-34 AC1, AC2 — a venue's details, read from the saved record on every
 * request, for any internal user. Venue Staff edit or retire it here (AC6,
 * AC8). A retired venue still opens, marked Retired, so bookings that name it
 * stay readable.
 */
export default async function VenueDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  if (!can(session.user, "venue:read")) {
    return <Forbidden />;
  }
  const { id } = await params;
  const venue = await getVenueDetail(id);
  if (!venue) notFound();
  const manages = can(session.user, "venue:manage");
  const options = manages && venue.isActive ? await getVenueOptions() : null;

  return (
    <div className="space-y-6">
      <Link
        href="/venues"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Venue Catalogue
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="flex flex-wrap items-center gap-2 text-2xl font-semibold tracking-tight">
            {venue.name}
            {!venue.isActive && <Badge variant="muted">Retired</Badge>}
          </h1>
          <p className="text-sm text-muted-foreground">{venue.location}</p>
        </div>
        {options && (
          <div className="flex flex-wrap gap-2">
            <VenueFormDialog venue={venue} options={options} />
            <RetireVenueDialog venue={venue} />
          </div>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Details</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-4" data-testid="venue-details">
              <Fact label="Location">{venue.location}</Fact>
              <Fact label="Capacity">{venue.capacity}</Fact>
              <Fact label="Setup time">{venue.setupMinutes} minutes</Fact>
              <Fact label="Turnaround time">{venue.turnaroundMinutes} minutes</Fact>
              <Fact label="Known restrictions">
                {venue.knownRestrictions ?? (
                  <span className="text-muted-foreground">None recorded</span>
                )}
              </Fact>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Opening hours (SGT)</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm" data-testid="opening-hours">
              {venue.openingHours.map((day) => (
                <li key={day.weekday} className="flex justify-between gap-4">
                  <span>{WEEKDAYS[day.weekday - 1]}</span>
                  <span>{describeHours(day)}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">What the venue offers</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <h2 className="text-sm font-medium">Facilities</h2>
              <Tags values={venue.facilities} empty="None recorded" />
            </div>
            <div className="space-y-2">
              <h2 className="text-sm font-medium">Accessibility features</h2>
              <Tags values={venue.accessibilityFeatures} empty="None recorded" />
            </div>
            <div className="space-y-2">
              <h2 className="text-sm font-medium">Supported layouts</h2>
              <Tags values={venue.supportedLayouts} empty="None recorded" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
