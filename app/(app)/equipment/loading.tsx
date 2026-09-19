import { Card, CardContent, CardHeader } from "@/components/ui/card";

/**
 * Streamed by Next.js while the server component fetches equipment and events.
 * Provides a skeleton matching the form and live availability grid so layout stays smooth.
 */
export default function Loading() {
  return (
    <div className="space-y-6">
      {/* 1. Reserve equipment skeleton */}
      <Card className="border border-border bg-card text-card-foreground shadow-xs backdrop-blur-none">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 shrink-0 animate-pulse rounded-xl bg-muted" />
            <div className="space-y-2">
              <div className="h-6 w-44 animate-pulse rounded-md bg-muted" />
              <div className="h-4 w-64 animate-pulse rounded-md bg-muted" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 pt-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="h-16 w-full animate-pulse rounded-md bg-muted/40" />
            <div className="h-16 w-full animate-pulse rounded-md bg-muted/40" />
          </div>
          <div className="h-20 w-full animate-pulse rounded-md bg-muted/40" />
          <div className="flex justify-between pt-2 border-t">
            <div className="h-10 w-32 animate-pulse rounded-md bg-muted/40" />
            <div className="h-11 w-44 animate-pulse rounded-md bg-muted/40" />
          </div>
        </CardContent>
      </Card>

      {/* 2. Live equipment availability skeleton */}
      <Card className="border border-border bg-card text-card-foreground shadow-xs backdrop-blur-none">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 shrink-0 animate-pulse rounded-xl bg-muted" />
            <div className="space-y-2">
              <div className="h-6 w-52 animate-pulse rounded-md bg-muted" />
              <div className="h-4 w-72 animate-pulse rounded-md bg-muted" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="h-24 w-full animate-pulse rounded-xl bg-muted/40" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="h-28 w-full animate-pulse rounded-xl bg-muted/40"
              />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
