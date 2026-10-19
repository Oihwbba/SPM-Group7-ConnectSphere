"use client";

import { useEffect, useState } from "react";
import { Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getEventRegistrations } from "@/app/(app)/events/registration-list-actions";
import { REGISTRATION_STATUS_LABEL } from "@/lib/status-labels";
import type {
  EventRegistrationList,
  RegistrationRow,
} from "@/lib/registration-list";

const STATUS_BADGE_VARIANT = {
  REGISTERED: "success",
  WITHDRAWN: "muted",
  CANCELLED: "destructive",
} as const;

function RegistrationRows({ rows }: { rows: RegistrationRow[] }) {
  return (
    <ul className="divide-y divide-border">
      {rows.map((row) => (
        <li
          key={row.id}
          data-testid="registration-row"
          data-status={row.status}
          className="flex items-center justify-between gap-2 py-1.5"
        >
          <span>{row.attendeeName}</span>
          <Badge variant={STATUS_BADGE_VARIANT[row.status]}>
            {REGISTRATION_STATUS_LABEL[row.status]}
          </Badge>
        </li>
      ))}
    </ul>
  );
}

/**
 * SCRUM-70 — the event's registrations, for its Organiser and its assigned
 * Coordinator. Shows nothing to anyone the server refuses, so the panel never
 * hints that a list exists (AC5).
 */
export function RegistrationListPanel({ eventId }: { eventId: string }) {
  const [list, setList] = useState<EventRegistrationList | null>(null);

  useEffect(() => {
    let cancelled = false;
    getEventRegistrations(eventId)
      .then((result) => {
        if (!cancelled && result.ok) setList(result.data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  if (!list) return null;

  return (
    <Card className="overflow-hidden" data-testid="registration-list">
      <CardHeader className="bg-muted/30 px-4 py-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <Users aria-hidden="true" className="h-4 w-4 text-primary" />
          Registrations
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 p-4 text-xs">
        <p data-testid="registration-summary">
          {list.registeredCount} registered · {list.remaining} of{" "}
          {list.capacity} places remaining
        </p>

        {list.registered.length > 0 ? (
          <RegistrationRows rows={list.registered} />
        ) : (
          <p className="text-muted-foreground">No registrations yet.</p>
        )}

        {list.inactive.length > 0 && (
          <div data-testid="inactive-registrations" className="space-y-1">
            <p className="font-semibold text-muted-foreground">
              Withdrawn or cancelled (not counted)
            </p>
            <RegistrationRows rows={list.inactive} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
