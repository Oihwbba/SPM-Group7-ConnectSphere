"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { CoordinatorLoad } from "@/lib/coordinator-assignment";
import { assignCoordinator } from "./actions";
import { AppSelect } from "@/components/app/app-select";
import { DECISION_BUTTON } from "@/components/queues/confirm-dialog";

/** SCRUM-165 AC4 — choose one Coordinator; each shows their active events,
 * and the least-loaded is pre-selected and marked as suggested. SCRUM-211
 * AC4: once assigned, the next waiting request opens (`nextHref`); a refusal
 * is shown here, on the same request. */
export function AssignForm({
  eventId,
  coordinators,
  suggestedId,
  nextHref,
}: {
  eventId: string;
  coordinators: CoordinatorLoad[];
  suggestedId: string | null;
  nextHref: string;
}) {
  const [coordinatorId, setCoordinatorId] = useState(suggestedId ?? "");
  const [refusal, setRefusal] = useState<string | null>(null);
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
        setRefusal(result.error);
        toast.error(result.error);
        router.refresh();
        return;
      }
      toast.success(`Assigned to ${result.data.coordinatorName}.`);
      router.push(nextHref);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {refusal && (
        <p
          role="alert"
          className="text-sm text-destructive"
          data-testid="decision-refused"
        >
          {refusal}
        </p>
      )}
      <label className="flex flex-1 flex-col gap-1 text-sm">
        <span className="font-medium">Coordinator</span>
        <AppSelect
          value={coordinatorId}
          onValueChange={setCoordinatorId}
          aria-label="Coordinator"
          className="h-9"
          options={coordinators.map((coordinator) => ({
            value: coordinator.id,
            label: `${coordinator.name} — ${coordinator.activeEvents} active event${
              coordinator.activeEvents === 1 ? "" : "s"
            }${coordinator.id === suggestedId ? " (suggested)" : ""}`,
          }))}
        />
      </label>
      <Button
        onClick={handleAssign}
        disabled={isPending || !coordinatorId}
        data-testid="assign-button"
        variant="outline"
        className={DECISION_BUTTON.positive}
      >
        {isPending ? "Assigning..." : "Assign"}
      </Button>
    </div>
  );
}
