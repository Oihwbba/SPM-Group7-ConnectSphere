import { Card, CardContent } from "@/components/ui/card";

/** SCRUM-211 — shown while a queue loads, in the shape of the shared layout. */
export function QueueLoading({ label }: { label: string }) {
  return (
    <div className="space-y-6" aria-busy="true" aria-label={label}>
      <div className="space-y-2">
        <div className="h-7 w-56 animate-pulse rounded-md bg-muted" />
        <div className="h-4 w-80 max-w-full animate-pulse rounded-md bg-muted" />
      </div>
      <div className="flex flex-wrap gap-3">
        <div className="h-9 w-56 animate-pulse rounded-full bg-muted" />
        <div className="h-9 w-72 max-w-full animate-pulse rounded-md bg-muted" />
      </div>
      <Card>
        <CardContent className="space-y-3 p-4">
          {Array.from({ length: 5 }).map((_, row) => (
            <div key={row} className="grid grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, cell) => (
                <div
                  key={cell}
                  className="h-4 animate-pulse rounded-md bg-muted/50"
                />
              ))}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
