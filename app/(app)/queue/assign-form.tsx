"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { CoordinatorLoad } from "@/lib/coordinator-assignment";
import { assignCoordinator } from "./actions";

/** SCRUM-165 AC4 — choose one Coordinator; each shows their active events,
 * and the least-loaded is pre-selected and marked as suggested. */
export function AssignForm({
  eventId,
  coordinators,
  suggestedId,
}: {
  eventId: string;
  coordinators: CoordinatorLoad[];
  suggestedId: string | null;
}) {
  const [coordinatorId, setCoordinatorId] = useState(suggestedId ?? "");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  if (coordinators.length === 0) {
    return (
      <p className="text-sm text-muted-foreground" role="status">
        There are no Coordinators to assign yet.
      </p>
    );
  }

  function handleAssign() {
    startTransition(async () => {
      const result = await assignCoordinator({ eventId, coordinatorId });
      if (!result.ok) {
        toast.error(result.error);
        router.refresh();
        return;
      }
      toast.success(`Assigned to ${result.data.coordinatorName}.`);
      router.push("/queue");
    });
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <label className="flex flex-1 flex-col gap-1 text-sm">
        <span className="font-medium">Coordinator</span>
        <select
          value={coordinatorId}
          onChange={(e) => setCoordinatorId(e.target.value)}
          aria-label="Coordinator"
          className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          {coordinators.map((coordinator) => (
            <option key={coordinator.id} value={coordinator.id}>
              {coordinator.name} — {coordinator.activeEvents} active event
              {coordinator.activeEvents === 1 ? "" : "s"}
              {coordinator.id === suggestedId ? " (suggested)" : ""}
            </option>
          ))}
        </select>
      </label>
      <Button
        onClick={handleAssign}
        disabled={isPending || !coordinatorId}
        data-testid="assign-button"
      >
        {isPending ? "Assigning..." : "Assign"}
      </Button>
    </div>
  );
}
