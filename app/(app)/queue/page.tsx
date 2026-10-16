import Link from "next/link";
import { CalendarDays, Inbox, User, Users } from "lucide-react";

import { requireSession } from "@/lib/auth/guard";
import { can } from "@/lib/auth/can";
import { Forbidden } from "@/components/app/forbidden";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime, formatEventTime } from "@/lib/datetime";
import { getUnassignedQueue } from "./queries";

/** SCRUM-165 — the Lead's Unassigned queue. Access is decided by `can()`
 * (SCRUM-66 / SCRUM-67), not a role list here. */
export default async function QueuePage() {
  const session = await requireSession();
  if (!can(session.user, "event:assign")) {
    return <Forbidden />;
  }

  const requests = await getUnassignedQueue();

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Unassigned Queue
        </h1>
        <p className="text-sm text-muted-foreground">
          New requests wait here, oldest first, until you assign a
          Coordinator.
        </p>
      </div>

      {requests.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <Inbox className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">
              No requests waiting
            </p>
            <p className="text-xs text-muted-foreground">
              Newly submitted requests will appear here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {requests.map((request) => (
            <Link
              key={request.id}
              href={`/queue/${request.id}`}
              data-testid="queue-request"
              className="block rounded-lg transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Card>
                <CardHeader className="space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base font-semibold leading-tight">
                      {request.name}
                    </CardTitle>
                    {request.overdue && (
                      <Badge variant="destructive" data-testid="overdue">
                        Overdue
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="grid grid-cols-1 gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                  <span className="flex items-center gap-1.5">
                    <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                    {formatEventTime(request.startAt, request.endAt)}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5 shrink-0" />
                    {request.expectedAttendance ?? "—"} expected
                  </span>
                  <span className="flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 shrink-0" />
                    {request.organiser.name}
                  </span>
                  <span data-testid="submitted-at">
                    Submitted{" "}
                    {request.submittedAt
                      ? formatDateTime(request.submittedAt)
                      : "—"}
                  </span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
