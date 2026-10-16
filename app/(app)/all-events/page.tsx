import Link from "next/link";
import { CalendarSearch } from "lucide-react";

import { requireSession } from "@/lib/auth/guard";
import { can } from "@/lib/auth/can";
import { Forbidden } from "@/components/app/forbidden";
import { StatusBadge, STATUS_META } from "@/components/events/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatEventTime } from "@/lib/datetime";
import {
  LISTED_STATUSES,
  getAllEvents,
  parseAllEventsFilters,
} from "./queries";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const fieldClass =
  "h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

/** SCRUM-141 — every event, read-only, for planning. Access is decided by
 * `can()` (SCRUM-67): Organisers, Attendees and Safety Officers are refused. */
export default async function AllEventsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await requireSession();
  if (!can(session.user, "event:view-all")) {
    return <Forbidden />;
  }

  const filters = parseAllEventsFilters(await searchParams);
  const result = await getAllEvents(filters);
  if (!result) return <Forbidden />;
  const { events, isLead, coordinators } = result;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">All Events</h1>
        <p className="text-sm text-muted-foreground">
          Every event except drafts, soonest first, read-only for planning.
        </p>
      </div>

      {isLead && (
        <Card data-testid="coordinator-loads">
          <CardHeader>
            <CardTitle className="text-sm font-semibold">
              Coordinators&apos; active events
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2 text-sm">
            {coordinators.map((coordinator) => (
              <Link
                key={coordinator.id}
                href={`/all-events?coordinator=${coordinator.id}`}
                data-testid="coordinator-load"
                className="rounded-md border border-border px-3 py-1.5 hover:bg-muted"
              >
                {coordinator.name}: {coordinator.activeEvents} active
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      <form className="flex flex-wrap items-end gap-3" method="get">
        <label className="flex flex-col gap-1 text-xs font-medium">
          Status
          <select
            name="status"
            defaultValue={filters.status ?? ""}
            className={fieldClass}
          >
            <option value="">All statuses</option>
            {LISTED_STATUSES.map((status) => (
              <option key={status} value={status}>
                {STATUS_META[status].label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium">
          Starts from
          <input
            type="date"
            name="from"
            defaultValue={filters.from}
            className={fieldClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium">
          Starts by
          <input
            type="date"
            name="to"
            defaultValue={filters.to}
            className={fieldClass}
          />
        </label>
        {isLead && (
          <>
            <label className="flex flex-col gap-1 text-xs font-medium">
              Coordinator
              <select
                name="coordinator"
                defaultValue={filters.coordinatorId ?? ""}
                className={fieldClass}
              >
                <option value="">All Coordinators</option>
                {coordinators.map((coordinator) => (
                  <option key={coordinator.id} value={coordinator.id}>
                    {coordinator.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex h-9 items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="unassigned"
                value="1"
                defaultChecked={filters.unassigned}
              />
              Unassigned only
            </label>
          </>
        )}
        <Button type="submit" size="sm">
          Filter
        </Button>
        <Link
          href="/all-events"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          Clear
        </Link>
      </form>

      {events.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <CalendarSearch className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium" role="status">
              No events match
            </p>
            <p className="text-xs text-muted-foreground">
              Try other filters, or clear them.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Date &amp; time</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Venues</TableHead>
                  <TableHead>Coordinator</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((event) => (
                  <TableRow key={event.id} data-testid="all-events-row">
                    <TableCell className="font-medium">
                      <Link
                        href={`/all-events/${event.id}`}
                        className="hover:underline"
                      >
                        {event.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-xs">
                      {formatEventTime(event.startAt, event.endAt)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={event.status} />
                    </TableCell>
                    <TableCell className="text-xs" data-testid="venues">
                      {event.bookings.length > 0
                        ? event.bookings.map((b) => b.venue.name).join(", ")
                        : "Not booked"}
                    </TableCell>
                    <TableCell className="text-xs" data-testid="coordinator">
                      {event.coordinator?.name ?? "Unassigned"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
