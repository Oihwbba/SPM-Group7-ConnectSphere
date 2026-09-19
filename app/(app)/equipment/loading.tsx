import { Card, CardContent } from "@/components/ui/card";

/**
 * Streamed by Next.js while the server component fetches equipment and events.
 * Provides a skeleton matching the form and live availability grid so layout stays smooth.
 */
export default function Loading() {
  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="h-6 w-44 animate-pulse rounded-md bg-muted" />
          <div className="grid gap-4 md:grid-cols-2">
            {Array.from({ length: 5 }).map((_, index) => (
              <div
                key={index}
                className="h-10 w-full animate-pulse rounded-md bg-muted"
              />
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="h-6 w-48 animate-pulse rounded-md bg-muted" />
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="h-20 w-full animate-pulse rounded-md bg-muted"
              />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
