import Link from "next/link";
import { ShieldCheck } from "lucide-react";

import { requireSession } from "@/lib/auth/guard";
import { can } from "@/lib/auth/can";
import { Forbidden } from "@/components/app/forbidden";
import { Card, CardContent } from "@/components/ui/card";
import { formatDateTime, formatEventTime } from "@/lib/datetime";
import { getSafetyCheckQueue } from "./queries";

// SCRUM-166 AC1 — the Safety Officers' queue of checks awaiting review,
// oldest request first. Access is decided by lib/auth/can.ts (SCRUM-67).
export default async function SafetyChecksPage() {
  const session = await requireSession();
  if (!can(session.user, "safety-check:review")) {
    return <Forbidden />;
  }

  const queue = await getSafetyCheckQueue(session.user);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Safety checks</h1>
        <p className="text-sm text-muted-foreground">
          Events waiting for an operational safety check, oldest request first.
          Open one to review its venues and equipment and record the outcome.
          Times are Singapore time.
        </p>
      </div>

      {queue.length === 0 ? (
        <Card>
          <CardContent className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
            <ShieldCheck aria-hidden="true" className="h-4 w-4" />
            No safety checks are awaiting review.
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-3" data-testid="safety-check-queue">
          {queue.map((check) => (
            <li key={check.id}>
              <Link
                href={`/safety-checks/${check.id}`}
                className="block rounded-lg border bg-card p-4 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <p className="font-semibold">{check.event.name}</p>
                <p className="text-sm text-muted-foreground">
                  {formatEventTime(check.event.startAt, check.event.endAt)}
                  {check.event.expectedAttendance !== null &&
                    ` · ${check.event.expectedAttendance} expected`}
                </p>
                <p className="text-xs text-muted-foreground">
                  Requested by {check.requestedBy} on{" "}
                  {formatDateTime(check.requestedAt)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
