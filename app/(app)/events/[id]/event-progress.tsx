import { Check, X } from "lucide-react";
import type { EventStatus } from "@prisma/client";

import { EVENT_STATUS_LABEL } from "@/lib/status-labels";
import { cn } from "@/lib/utils";

const STEPS = ["Request", "Review", "Planning", "Confirmed", "Completed"] as const;

/** Where each status sits on the way from request to completed event. */
const STEP_OF: Record<EventStatus, number> = {
  DRAFT: 0,
  SUBMITTED: 1,
  UNDER_REVIEW: 1,
  REJECTED: 1,
  APPROVED: 2,
  PLANNING: 2,
  CONFIRMED: 3,
  COMPLETED: 4,
  CANCELLED: -1,
};

/**
 * SCRUM-208 AC2 — the event's status as its place on the way: the steps done
 * are ticked, the current one glows in the site's primary colour, and a Rejected request is marked
 * where it stopped. A Cancelled event shows how far it got, then Cancelled.
 * Carries the status for tests and screen readers as the badge did.
 */
export function EventProgress({
  status,
  cancelledFrom = null,
}: {
  status: EventStatus;
  /** For a Cancelled event, the status it was cancelled from, when known. */
  cancelledFrom?: EventStatus | null;
}) {
  const cancelled = status === "CANCELLED";
  const rejected = status === "REJECTED";
  const current = cancelled ? STEP_OF[cancelledFrom ?? "PLANNING"] : STEP_OF[status];
  const finished = status === "COMPLETED";

  return (
    <div
      data-testid="status-badge"
      data-status={status}
      className="py-1"
    >
      <p className="sr-only">Status: {EVENT_STATUS_LABEL[status]}</p>
      <ol
        className="flex items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        aria-label="Progress"
      >
        {STEPS.map((step, i) => {
          const done = i < current || (finished && i === current);
          const here = i === current && !finished;
          const stopped = here && (rejected || cancelled);
          return (
            <li
              key={step}
              className="flex min-w-0 flex-1 items-center gap-1 last:flex-none"
              aria-current={here ? "step" : undefined}
            >
              {/* SCRUM-207: on a phone the label sits under its circle and
                  the type is smaller, so every step is in view at once
                  without the row scrolling. */}
              <span className="flex min-w-0 flex-col items-center gap-1 sm:flex-row sm:gap-2">
                <span
                  aria-hidden
                  className={cn(
                    "flex h-5 w-5 items-center justify-center rounded-full border-2",
                    done && "border-primary bg-primary text-primary-foreground",
                    here && !stopped && "border-primary bg-primary/15",
                    stopped && "border-destructive bg-destructive text-destructive-foreground",
                    !done && !here && "border-muted-foreground/30 bg-background",
                  )}
                >
                  {done && <Check className="h-3 w-3" strokeWidth={3} />}
                  {stopped && <X className="h-3 w-3" strokeWidth={3} />}
                  {here && !stopped && (
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary shadow-[0_0_8px_2px_hsl(var(--primary)/0.6)]" />
                    </span>
                  )}
                </span>
                <span
                  className={cn(
                    "whitespace-nowrap text-center text-[11px] leading-tight sm:text-sm",
                    here ? "font-semibold text-primary" : "text-muted-foreground",
                    stopped && "text-destructive",
                  )}
                >
                  {stopped ? (rejected ? "Rejected" : "Cancelled") : step}
                </span>
              </span>
              {i < STEPS.length - 1 && (
                <span
                  aria-hidden
                  className={cn(
                    // On a phone it lines up with the circles, which sit above
                    // their labels.
                    "mx-1 mt-[9px] h-0.5 min-w-1.5 flex-1 self-start rounded-full sm:mx-2 sm:mt-0 sm:min-w-4 sm:self-auto",
                    i < current || finished ? "bg-primary" : "bg-muted-foreground/20",
                  )}
                />
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
