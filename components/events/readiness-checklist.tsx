"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, CircleDashed, ListChecks } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { confirmEvent } from "@/app/(app)/events/actions";
import { getEventReadiness } from "@/app/(app)/events/readiness-actions";
import type { ReadinessChecklist as Checklist } from "@/lib/event-readiness";

/**
 * SCRUM-110 — the readiness checklist on a Planning event's details, and
 * SCRUM-81's Confirm action beneath it for the event's assigned Coordinator.
 * The server decides how much each viewer sees (the Organiser gets no internal
 * reasons) and who may confirm, so this component only renders what it is
 * given.
 */
export function ReadinessChecklist({ eventId }: { eventId: string }) {
  const [checklist, setChecklist] = useState<
    (Checklist & { canConfirm: boolean }) | null
  >(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [confirming, startConfirm] = useTransition();
  const router = useRouter();

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

  function confirm() {
    startConfirm(async () => {
      const result = await confirmEvent({ eventId });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Event confirmed.");
      router.refresh();
    });
  }

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
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap items-center justify-between gap-2">
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
              {/* SCRUM-81: offered only to the assigned Coordinator, and only
                  usable once every item is complete. */}
              {checklist.canConfirm && (
                <Button
                  size="sm"
                  onClick={confirm}
                  disabled={!checklist.ready || confirming}
                >
                  {confirming ? "Confirming…" : "Confirm event"}
                </Button>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
