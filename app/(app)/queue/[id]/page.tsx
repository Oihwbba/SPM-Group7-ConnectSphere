import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { requireSession } from "@/lib/auth/guard";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime, formatEventTime } from "@/lib/datetime";
import { getQueueRequest } from "../queries";
import { AssignForm } from "../assign-form";

/** SCRUM-165 AC3, AC4 — a queued request's basic information, read-only,
 * and the Lead's choice of Coordinator. `getQueueRequest` is the gate: it
 * returns null for anyone but a Lead, and for a request already assigned. */
export default async function QueueRequestPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireSession();

  const { id } = await params;
  const found = await getQueueRequest(id);
  if (!found) {
    notFound();
  }
  const { request, coordinators, suggestedId } = found;

  const details: [string, string | null][] = [
    ["Purpose", request.purpose],
    ["Description", request.description],
    ["Date & time", formatEventTime(request.startAt, request.endAt)],
    [
      "Expected attendance",
      request.expectedAttendance === null
        ? null
        : String(request.expectedAttendance),
    ],
    ["Venue requirements", request.venueRequirements],
    ["Accessibility needs", request.accessibilityNeeds],
    ["Preferred layout", request.preferredLayout],
    ["Equipment requirements", request.equipmentRequirements],
    ["Organiser", request.organiser.name],
    [
      "Submitted",
      request.submittedAt ? formatDateTime(request.submittedAt) : null,
    ],
  ];

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link
        href="/queue"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to the queue
      </Link>

      <Card>
        <CardHeader className="space-y-2">
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-xl font-bold leading-none tracking-tight">
              {request.name}
            </h1>
            {request.overdue && (
              <Badge variant="destructive" data-testid="overdue">
                Overdue
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <dl
            className="grid grid-cols-1 gap-x-4 gap-y-2 text-sm sm:grid-cols-[auto_1fr]"
            data-testid="request-details"
          >
            {details.map(([label, value]) => (
              <div key={label} className="contents">
                <dt className="font-semibold text-muted-foreground">{label}</dt>
                <dd className="whitespace-pre-wrap">{value || "—"}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">
            Assign a Coordinator
          </CardTitle>
        </CardHeader>
        <CardContent>
          <AssignForm
            eventId={request.id}
            coordinators={coordinators}
            suggestedId={suggestedId}
          />
        </CardContent>
      </Card>
    </div>
  );
}
