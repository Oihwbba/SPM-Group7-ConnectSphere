"use client";

import { useEffect, useState, useTransition } from "react";
import { CalendarRange, CircleDot, Users } from "lucide-react";
import { StatStrip } from "@/components/app/stat-strip";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  closeRegistration,
  getRegistrationControl,
  reopenRegistration,
  type RegistrationControl as Control,
} from "@/app/(app)/events/registration-control-actions";

/**
 * SCRUM-75 AC6 — on a Confirmed event that needs registration, its Organiser
 * and assigned Coordinator see where registration stands and can close it,
 * or reopen it until the event's start. Shows nothing for any other event.
 */
export function RegistrationControl({ eventId }: { eventId: string }) {
  // undefined while loading; null when the event has no registration to control.
  const [control, setControl] = useState<Control | null | undefined>(undefined);
  const [loadFailed, setLoadFailed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    getRegistrationControl(eventId)
      .then((result) => {
        if (cancelled) return;
        if (result.ok) setControl(result.data);
        else setLoadFailed(true);
      })
      .catch(() => {
        if (!cancelled) setLoadFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  if (control === null) return null;

  function act(action: typeof closeRegistration) {
    setError(null);
    startTransition(async () => {
      const result = await action({ eventId });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setControl(result.data);
      // SCRUM-132 AC4: every action that changes data confirms it.
      toast.success(
        action === closeRegistration
          ? "Registration closed."
          : "Registration reopened.",
      );
    });
  }

  return (
    <Card className="overflow-hidden" data-testid="registration-control">
      <CardHeader className="bg-muted/30 px-4 py-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <Users aria-hidden="true" className="h-4 w-4 text-primary" />{" "}
          Registration
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 p-4 text-xs">
        {loadFailed ? (
          <p role="alert" className="text-muted-foreground">
            Couldn&apos;t load registration. Try reopening this event.
          </p>
        ) : control === undefined ? (
          <p role="status" className="text-muted-foreground">
            Loading registration…
          </p>
        ) : (
          <>
            {/* Shared page conventions: the state of registration at a glance. */}
            <StatStrip
              stats={[
                {
                  icon: CircleDot,
                  label: "Status",
                  value: control.label,
                  testId: "registration-control-state",
                },
                { icon: CalendarRange, label: "Period", value: control.period },
                {
                  icon: Users,
                  label: "Registered",
                  value: `${control.registered} of ${control.capacity}`,
                },
              ]}
            />
            {error && (
              <p role="alert" className="text-destructive">
                {error}
              </p>
            )}
            {control.canClose && (
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => act(closeRegistration)}
              >
                {pending ? "Closing…" : "Close registration"}
              </Button>
            )}
            {control.canReopen && (
              <Button
                size="sm"
                disabled={pending}
                onClick={() => act(reopenRegistration)}
              >
                {pending ? "Reopening…" : "Reopen registration"}
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
