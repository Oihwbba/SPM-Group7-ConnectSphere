import { Card, CardContent, CardHeader } from "@/components/ui/card";

/** Streamed while the server component loads the Lead's Unassigned queue. */
export default function Loading() {
  return (
    <div
      className="space-y-6"
      aria-busy="true"
      aria-label="Loading the unassigned queue"
    >
      <div className="space-y-2">
        <div className="h-7 w-56 animate-pulse rounded-md bg-muted" />
        <div className="h-4 w-80 max-w-full animate-pulse rounded-md bg-muted" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Card key={index}>
            <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
              <div className="h-5 w-64 max-w-full animate-pulse rounded-md bg-muted" />
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, cell) => (
                <div key={cell} className="h-4 w-40 animate-pulse rounded-md bg-muted/40" />
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
