import type { Role } from "@prisma/client";
import { CalendarPlus } from "lucide-react";

import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth/guard";
import { formatDate, formatDateTime } from "@/lib/datetime";
import { Forbidden } from "@/components/app/forbidden";
import { StatusBadge } from "@/components/events/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CreateEventDialog } from "./create-event-dialog";

// The reference feature. Only Organisers reach it; the query below is scoped
// to the signed-in organiser, so an Organiser can never see another's events.
const ALLOWED_ROLES: Role[] = ["ORGANISER"];

export default async function OrganiserEventsPage() {
  const session = await requireSession();
  if (!ALLOWED_ROLES.includes(session.user.role)) {
    return <Forbidden />;
  }

  // RELATIONSHIP enforced in the query: an organiser only ever loads their own
  // rows. This is the read-side counterpart to `can()`'s relationship check.
  const events = await prisma.event.findMany({
    where: { organiserId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">My Events</h1>
          <p className="text-sm text-muted-foreground">
            Create and track your event requests through their lifecycle.
          </p>
        </div>
        <CreateEventDialog />
      </div>

      {events.length === 0 ? (
        <EmptyState />
      ) : (
        <Card>
          {/* The table scrolls inside its own container (see Table) so a wide
              table never pushes the whole page sideways. */}
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Starts</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell className="font-medium">{event.name}</TableCell>
                    <TableCell>
                      <StatusBadge status={event.status} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {event.startAt ? formatDateTime(event.startAt) : "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(event.createdAt)}
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

/** Shown when the organiser has no events yet — a real empty state, not a
 * blank table. */
function EmptyState() {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <CalendarPlus className="h-6 w-6" />
        </span>
        <p className="text-base font-medium">No events yet</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Create your first draft event to get started. You can complete the
          details and submit it for review later.
        </p>
        <div className="pt-2">
          <CreateEventDialog />
        </div>
      </CardContent>
    </Card>
  );
}
