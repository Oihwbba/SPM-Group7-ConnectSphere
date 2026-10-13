import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTime } from "@/lib/datetime";
import type { TimeClashFlag } from "@/lib/venue-time-clashes";

/**
 * SCRUM-160 AC5 — the bookings flagged because a venue's setup or turnaround
 * time changed, with the venue, the event, its Coordinator and what each
 * clashes with. The Coordinator resolves each flag (SCRUM-26).
 */
export function TimeClashFlags({ flags }: { flags: TimeClashFlag[] }) {
  return (
    <section className="space-y-3" aria-labelledby="time-clash-flags">
      <div className="space-y-1">
        <h2 id="time-clash-flags" className="text-lg font-semibold tracking-tight">
          Clashes after a setup or turnaround change
        </h2>
        <p className="text-sm text-muted-foreground">
          These bookings stand as they are until their event&apos;s Coordinator
          decides whether each still stands.
        </p>
      </div>
      {flags.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No booking is waiting on a setup or turnaround change.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Venue</TableHead>
              <TableHead>Event</TableHead>
              <TableHead>Coordinator</TableHead>
              <TableHead>Booked</TableHead>
              <TableHead>Clashes with</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {flags.map((flag) => (
              <TableRow key={flag.bookingId}>
                <TableCell>{flag.venueName}</TableCell>
                <TableCell>{flag.eventName}</TableCell>
                <TableCell>{flag.coordinatorName ?? "Not assigned"}</TableCell>
                <TableCell>
                  {formatDateTime(flag.startAt)} to {formatDateTime(flag.endAt)}
                </TableCell>
                <TableCell>
                  <ul className="space-y-1">
                    {flag.clashesWith.map((clash) => (
                      <li key={clash}>{clash}</li>
                    ))}
                  </ul>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  );
}
