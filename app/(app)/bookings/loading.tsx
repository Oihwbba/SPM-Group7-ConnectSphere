import { Card, CardContent } from "@/components/ui/card";

/** Streamed while the server component loads the pending queue (SCRUM-52). */
export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="h-8 w-72 animate-pulse rounded-md bg-muted" />
        <div className="h-4 w-full max-w-2xl animate-pulse rounded-md bg-muted" />
      </div>
      {Array.from({ length: 2 }).map((_, index) => (
        <Card key={index}>
          <CardContent className="space-y-4 pt-6">
            <div className="space-y-2">
              <div className="h-5 w-64 animate-pulse rounded-md bg-muted" />
              <div className="h-4 w-80 animate-pulse rounded-md bg-muted/60" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((__, fact) => (
                <div
                  key={fact}
                  className="h-12 animate-pulse rounded-md bg-muted/40"
                />
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
