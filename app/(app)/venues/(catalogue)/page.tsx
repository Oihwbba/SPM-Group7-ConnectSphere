import Link from "next/link";

import { requireSession } from "@/lib/auth/guard";
import { can } from "@/lib/auth/can";
import { Forbidden } from "@/components/app/forbidden";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getVenueCatalogue, getVenueOptions } from "../queries";
import { VenueFormDialog } from "../venue-form-dialog";

type Venue = Awaited<ReturnType<typeof getVenueCatalogue>>[number];

function VenueTable({ venues, caption }: { venues: Venue[]; caption: string }) {
  return (
    <div className="overflow-x-auto rounded-md border">
      <Table aria-label={caption}>
        <TableHeader>
          <TableRow>
            <TableHead>Venue</TableHead>
            <TableHead>Location</TableHead>
            <TableHead className="text-right">Capacity</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {venues.map((venue) => (
            <TableRow key={venue.id} data-testid="venue-row">
              <TableCell>
                <Link href={`/venues/${venue.id}`} className="font-medium hover:underline">
                  {venue.name}
                </Link>
                {!venue.isActive && (
                  <Badge variant="muted" className="ml-2">
                    Retired
                  </Badge>
                )}
              </TableCell>
              <TableCell>{venue.location}</TableCell>
              <TableCell className="text-right">{venue.capacity}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/**
 * SCRUM-34 — the venue catalogue. Any internal user browses it (AC2); Venue
 * Staff add venues here and see the retired ones too, which no one else is
 * offered (AC3, AC8). Who may do what is decided by can(), not a role list.
 */
export default async function VenuesPage() {
  const session = await requireSession();
  if (!can(session.user, "venue:read")) {
    return <Forbidden />;
  }
  const manages = can(session.user, "venue:manage");
  const venues = await getVenueCatalogue({ includeRetired: manages });
  const options = manages ? await getVenueOptions() : null;
  const active = venues.filter((venue) => venue.isActive);
  const retired = venues.filter((venue) => !venue.isActive);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Venue Catalogue</h1>
          <p className="text-sm text-muted-foreground">
            Each venue&apos;s capacity, facilities, opening hours and restrictions.
          </p>
        </div>
        {options && <VenueFormDialog options={options} />}
      </div>

      {active.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No venues in the catalogue yet.
          </CardContent>
        </Card>
      ) : (
        <VenueTable venues={active} caption="Venues" />
      )}

      {retired.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Retired venues</h2>
          <p className="text-sm text-muted-foreground">
            No longer offered for new requests; their past bookings stay readable.
          </p>
          <VenueTable venues={retired} caption="Retired venues" />
        </section>
      )}
    </div>
  );
}
