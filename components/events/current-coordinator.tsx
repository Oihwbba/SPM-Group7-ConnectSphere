"use client";

import { useEffect, useState } from "react";

import { PersonPill } from "@/components/app/audit-trail";
import { getEventCoordinator } from "@/app/(app)/events/readiness-actions";

/**
 * SCRUM-21 AC8 — the event's current Coordinator, read when the details open,
 * so the Organiser sees a reassignment as soon as it is made. Shows nothing
 * if it can't be read.
 */
export function CurrentCoordinator({ eventId }: { eventId: string }) {
  const [name, setName] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    getEventCoordinator(eventId)
      .then((result) => {
        if (!cancelled && result.ok) setName(result.data.name);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  if (name === undefined) return null;
  return (
    <div data-testid="current-coordinator">
      <span className="font-semibold text-muted-foreground">Coordinator:</span>
      <p className="mt-0.5 text-foreground">
        {name ? <PersonPill name={name} /> : "Not assigned yet"}
      </p>
    </div>
  );
}
