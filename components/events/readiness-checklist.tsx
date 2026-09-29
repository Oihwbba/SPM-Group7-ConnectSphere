"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, CircleDashed, ListChecks } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getEventReadiness } from "@/app/(app)/events/readiness-actions";
import type { ReadinessChecklist as Checklist } from "@/lib/event-readiness";

/**
 * SCRUM-110 — the readiness checklist on a Planning event's details. The
 * server decides how much each viewer sees (the Organiser gets no internal
 * reasons), so this component only renders what it is given.
 */
export function ReadinessChecklist({ eventId }: { eventId: string }) {
  const [checklist, setChecklist] = useState<Checklist | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getEventReadiness(eventId)
      .then((result) => {
        if (cancelled) return;
        if (result.ok) setChecklist(result.data);
        else setLoadFailed(true);
      })
      .catch(() => {
        if (!cancelled) setLoadFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  return (
    <Card className="overflow-hidden" data-testid="readiness-checklist">
      <CardHeader className="bg-muted/30 px-4 py-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <ListChecks aria-hidden="true" className="h-4 w-4 text-primary" />{" "}
          Readiness checklist
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 p-4 text-xs">
        {loadFailed ? (
          <p role="alert" className="text-muted-foreground">
            Couldn&apos;t load the readiness checklist. Try reopening this
            event.
          </p>
        ) : !checklist ? (
          <p role="status" className="text-muted-foreground">
            Checking arrangements…
          </p>
        ) : (
          <>
            <ul className="space-y-2">
              {checklist.items.map((item) => (
                <li
                  key={item.name}
                  className="flex items-start gap-2"
                  data-testid={`readiness-item-${item.name === "Equipment" ? "equipment" : "venue"}`}
                  data-complete={item.complete}
                >
                  {item.complete ? (
                    <CheckCircle2
                      aria-hidden="true"
                      className="mt-0.5 h-4 w-4 shrink-0 text-success"
                    />
                  ) : (
                    <CircleDashed
                      aria-hidden="true"
                      className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
                    />
                  )}
                  <div>
                    <p>
                      <span className="font-semibold">{item.name}</span>
                      <span className="sr-only">
                        {item.complete ? ", complete" : ", incomplete"}
                      </span>
                      {" — "}
                      {item.reason
                        ? `${item.state} – ${item.reason}`
                        : item.state}
                    </p>
                    {item.lines.length > 0 && (
                      <ul className="mt-1 space-y-0.5 text-muted-foreground">
                        {item.lines.map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            <p
              className={
                checklist.ready
                  ? "font-semibold text-success"
                  : "text-muted-foreground"
              }
              data-testid="readiness-summary"
            >
              {checklist.ready
                ? "Ready to confirm"
                : "Not ready to confirm yet: complete the items above."}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
