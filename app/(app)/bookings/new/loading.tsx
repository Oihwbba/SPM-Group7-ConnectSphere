import { Card, CardContent } from "@/components/ui/card";

/** Streamed while the server component loads events and venues (SCRUM-50). */
export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="h-8 w-56 animate-pulse rounded-md bg-muted" />
        <div className="h-4 w-96 max-w-full animate-pulse rounded-md bg-muted" />
      </div>
      <Card>
        <CardContent className="space-y-5 pt-6">
          <div className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="h-16 animate-pulse rounded-md bg-muted/40"
              />
            ))}
          </div>
          <div className="h-20 animate-pulse rounded-md bg-muted/40" />
          <div className="flex justify-end border-t pt-4">
            <div className="h-10 w-36 animate-pulse rounded-md bg-muted/40" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
