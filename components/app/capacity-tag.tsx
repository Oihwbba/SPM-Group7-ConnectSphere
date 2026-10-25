import { User } from "lucide-react";

/**
 * A venue's capacity as a person icon and a number (shared page conventions,
 * change 6), wherever a venue is offered as a choice.
 */
export function CapacityTag({ capacity }: { capacity: number }) {
  return (
    <span
      className="inline-flex items-center gap-1 text-xs text-muted-foreground"
      title={`Holds up to ${capacity} people`}
    >
      <User className="h-3.5 w-3.5" aria-hidden />
      <span className="sr-only">max capacity</span>
      {capacity}
    </span>
  );
}
