import { notFound } from "next/navigation";
import {
  Accessibility,
  AlertTriangle,
  Clock,
  Info,
  LayoutGrid,
  MapPin,
  Repeat,
  Sparkles,
  Timer,
  Users,
  type LucideIcon,
} from "lucide-react";

import { requireSession } from "@/lib/auth/guard";
import { can } from "@/lib/auth/can";
import { Forbidden } from "@/components/app/forbidden";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { describeHours, WEEKDAYS } from "@/lib/venue-hours";
import { getVenueDetail, getVenueOptions } from "../queries";
import { RetireVenueDialog } from "../retire-venue-dialog";
import { VenueFormDialog } from "../venue-form-dialog";

/** "wheelchair-access" -> "wheelchair access" */
const readable = (tag: string) => tag.replace(/-/g, " ");

function Tags({
  values,
  empty,
  variant,
}: {
  values: string[];
  empty: string;
  variant: "info" | "success" | "secondary";
}) {
  if (values.length === 0) {
    return <p className="text-sm text-muted-foreground">{empty}</p>;
  }
  return (
    <ul className="flex flex-wrap gap-2">
      {values.map((value) => (
        <li key={value}>
          <Badge variant={variant}>{readable(value)}</Badge>
        </li>
      ))}
    </ul>
  );
}

/** A detail with its icon in a tinted chip, so the main points stand out. */
function Fact({
  label,
  icon: Icon,
  tone = "bg-primary/10 text-primary",
  children,
}: {
  label: string;
  icon: LucideIcon;
  tone?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${tone}`}
        aria-hidden
      >
        <Icon className="h-4 w-4" />
      </span>
      <div className="space-y-0.5">
        <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </dt>
        <dd className="text-sm font-medium">{children}</dd>
      </div>
    </div>
  );
}

function CardHeading({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  return (
    <CardTitle className="flex items-center gap-2 text-base">
      <Icon className="h-4 w-4 text-primary" aria-hidden />
      {children}
    </CardTitle>
  );
}

function TagGroup({ icon: Icon, tone, title, children }: {
  icon: LucideIcon;
  tone: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <h2 className="flex items-center gap-2 text-sm font-medium">
        <Icon className={`h-4 w-4 ${tone}`} aria-hidden />
        {title}
      </h2>
      {children}
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
      <PageHeader
        title={
          <>
            {venue.name}
            {!venue.isActive && <Badge variant="muted">Retired</Badge>}
          </>
        }
        description={`${venue.location}: its capacity, facilities, opening hours and bookings.`}
        back={{ href: "/venues", to: "Venue Catalogue" }}
        actions={
          options && (
            <>
              <VenueFormDialog venue={venue} options={options} />
              <RetireVenueDialog venue={venue} />
            </>
          )
        }
      />

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardHeading icon={Info}>Details</CardHeading>
          </CardHeader>
          <CardContent>
            <dl className="space-y-4" data-testid="venue-details">
              <Fact label="Location" icon={MapPin}>{venue.location}</Fact>
              <Fact label="Capacity" icon={Users} tone="bg-info/10 text-info">
                {venue.capacity}
              </Fact>
              <Fact label="Setup time" icon={Timer} tone="bg-success/10 text-success">
                {venue.setupMinutes} minutes
              </Fact>
              <Fact label="Turnaround time" icon={Repeat} tone="bg-success/10 text-success">
                {venue.turnaroundMinutes} minutes
              </Fact>
              <Fact
                label="Known restrictions"
                icon={AlertTriangle}
                tone="bg-warning/10 text-warning"
              >
                {venue.knownRestrictions ?? (
                  <span className="text-muted-foreground">None recorded</span>
                )}
              </Fact>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardHeading icon={Clock}>Opening hours (SGT)</CardHeading>
          </CardHeader>
          <CardContent>
            {venue.openingHours.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Not recorded yet{venue.operatingHours ? ` (previously noted: ${venue.operatingHours})` : ""}.
              </p>
            ) : (
              <ul className="space-y-1 text-sm" data-testid="opening-hours">
                {venue.openingHours.map((day) => (
                  <li key={day.weekday} className="flex justify-between gap-4">
                    <span>{WEEKDAYS[day.weekday - 1]}</span>
                    <span>{describeHours(day)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardHeading icon={Sparkles}>What the venue offers</CardHeading>
          </CardHeader>
          <CardContent className="space-y-4">
            <TagGroup icon={Sparkles} tone="text-info" title="Facilities">
              <Tags values={venue.facilities} empty="None recorded" variant="info" />
            </TagGroup>
            <TagGroup icon={Accessibility} tone="text-success" title="Accessibility features">
              <Tags values={venue.accessibilityFeatures} empty="None recorded" variant="success" />
            </TagGroup>
            <TagGroup icon={LayoutGrid} tone="text-primary" title="Supported layouts">
              <Tags values={venue.supportedLayouts} empty="None recorded" variant="secondary" />
            </TagGroup>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
