import Link from "next/link";
import { notFound } from "next/navigation";

import { requireSession } from "@/lib/auth/guard";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/events/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatEventTime } from "@/lib/datetime";
import { getEventForPlanning } from "../queries";
import { ReassignForm } from "./reassign-form";

/** SCRUM-141 AC3, AC4 — an event's details, read-only, for anyone who may see
 * the all-events list. `getEventForPlanning` is the gate: null for other
 * roles, a draft or a missing id. Only the assigned Coordinator edits, from
 * their own Events page; the Lead's actions here are assigning (SCRUM-165)
 * and reassigning (SCRUM-21). */
export default async function PlanningEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireSession();

  const { id } = await params;
  const found = await getEventForPlanning(id);
  if (!found) {
    notFound();
  }
  const { event, canEdit, canAssign, canReassign, coordinators } = found;

  const details: [string, string | null][] = [
    ["Purpose", event.purpose],
    ["Description", event.description],
    ["Date & time", formatEventTime(event.startAt, event.endAt)],
    [
      "Expected attendance",
      event.expectedAttendance === null
        ? null
        : String(event.expectedAttendance),
    ],
    [
      "Venues",
      event.bookings.length > 0
        ? event.bookings
            .map((b) => `${b.venue.name} — ${b.venue.location}`)
            .join("\n")
        : "Not booked",
    ],
    ["Coordinator", event.coordinator?.name ?? "Unassigned"],
    ["Organiser", event.organiser.name],
    ["Venue requirements", event.venueRequirements],
    ["Accessibility needs", event.accessibilityNeeds],
    ["Preferred layout", event.preferredLayout],
    ["Equipment requirements", event.equipmentRequirements],
  ];

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader
        title={
          <>
            {event.name}
            <StatusBadge status={event.status} />
          </>
        }
        description={
          <span data-testid="read-only">
            {canEdit
              ? "You coordinate this event; edit it from your Events page."
              : "Read-only: only the event's assigned Coordinator can change it."}
          </span>
        }
        back={{ href: "/all-events", to: "All Events" }}
      />

      <Card>
        <CardContent className="space-y-4 pt-6">
          <dl
            className="grid grid-cols-1 gap-x-4 gap-y-2 text-sm sm:grid-cols-[auto_1fr]"
            data-testid="event-details"
          >
            {details.map(([label, value]) => (
              <div key={label} className="contents">
                <dt className="font-semibold text-muted-foreground">{label}</dt>
                <dd className="whitespace-pre-wrap">{value || "—"}</dd>
              </div>
            ))}
          </dl>
          {canEdit && (
            <Link
              href={`/events/${event.id}`}
              className="inline-block text-sm font-medium text-primary hover:underline"
            >
              Open in my Events
            </Link>
          )}
          {canAssign && (
            <Link
              href={`/queue/${event.id}`}
              className="inline-block text-sm font-medium text-primary hover:underline"
              data-testid="assign-link"
            >
              Assign a Coordinator
            </Link>
          )}
          {canReassign && event.coordinatorId && (
            <ReassignForm
              eventId={event.id}
              currentId={event.coordinatorId}
              coordinators={coordinators}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
