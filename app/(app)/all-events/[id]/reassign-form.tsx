"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { CoordinatorLoad } from "@/lib/coordinator-assignment";
import { reassignCoordinator } from "../actions";

/** SCRUM-21 AC1, AC3 — move the event to another Coordinator. Each shows
 * their active events; the current one is marked, and choosing them changes
 * nothing. The event's own Organiser isn't offered. */
export function ReassignForm({
  eventId,
  currentId,
  coordinators,
}: {
  eventId: string;
  currentId: string;
  coordinators: CoordinatorLoad[];
}) {
  const [coordinatorId, setCoordinatorId] = useState(currentId);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleReassign() {
    startTransition(async () => {
      const result = await reassignCoordinator({ eventId, coordinatorId });
      if (!result.ok) {
        toast.error(result.error);
      } else if (result.data.changed) {
        toast.success(`Reassigned to ${result.data.coordinatorName}.`);
      } else {
        toast.info(`${result.data.coordinatorName} already coordinates it.`);
      }
      router.refresh();
    });
  }

  return (
    <div
      className="flex flex-col gap-3 sm:flex-row sm:items-end"
      data-testid="reassign-form"
    >
      <label className="flex flex-1 flex-col gap-1 text-sm">
        <span className="font-medium">Reassign to</span>
        <select
          value={coordinatorId}
          onChange={(e) => setCoordinatorId(e.target.value)}
          aria-label="Reassign to"
          className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          {coordinators.map((coordinator) => (
            <option key={coordinator.id} value={coordinator.id}>
              {coordinator.name} — {coordinator.activeEvents} active event
              {coordinator.activeEvents === 1 ? "" : "s"}
              {coordinator.id === currentId ? " (current)" : ""}
            </option>
          ))}
        </select>
      </label>
      <Button
        onClick={handleReassign}
        disabled={isPending || coordinatorId === currentId}
        data-testid="reassign-button"
      >
        {isPending ? "Reassigning..." : "Reassign"}
      </Button>
    </div>
  );
}
