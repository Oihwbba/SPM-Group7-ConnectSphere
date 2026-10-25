"use client";

import { Label } from "@/components/ui/label";
import { AppSelect } from "@/components/app/app-select";

/**
 * SCRUM-38 AC1 — which of the Coordinator's events the search is for.
 * Choosing one sends the form at once, so search opens for that event as it
 * does from the event's Find a venue; without JavaScript, Search sends it.
 */
export function EventPicker({
  events,
  value,
}: {
  events: { id: string; name: string }[];
  value: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor="event">For event</Label>
      <AppSelect
        id="event"
        name="event"
        defaultValue={value}
        submitOnChange
        options={[
          { value: "", label: "None: search any period" },
          ...events.map((event) => ({ value: event.id, label: event.name })),
        ]}
      />
    </div>
  );
}
