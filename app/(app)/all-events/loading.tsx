import { Card, CardContent } from "@/components/ui/card";

/** Streamed while the server component loads every event and, for the Lead, the Coordinators' loads. */
export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading all events">
      <div className="space-y-2">
        <div className="h-7 w-40 animate-pulse rounded-md bg-muted" />
        <div className="h-4 w-80 max-w-full animate-pulse rounded-md bg-muted" />
      </div>
      <div className="flex flex-wrap gap-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="h-10 w-40 animate-pulse rounded-md bg-muted" />
        ))}
        <div className="h-10 w-24 animate-pulse rounded-md bg-muted" />
      </div>
      <Card>
        <CardContent className="space-y-2 pt-6">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-9 w-full animate-pulse rounded-md bg-muted/40" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
