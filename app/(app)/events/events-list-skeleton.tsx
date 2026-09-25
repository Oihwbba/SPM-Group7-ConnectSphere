import { Card, CardContent } from "@/components/ui/card";

/**
 * The events list's loading skeleton. Rendered via an explicit <Suspense>
 * around just the role-dispatch in page.tsx — deliberately NOT a folder-level
 * loading.tsx, because that file convention would also wrap every nested
 * route under events/ (including events/[id], SCRUM-72) in the same Suspense
 * boundary, which breaks that route's notFound() from producing a real 404
 * (Next.js has already streamed a 200 shell by the time notFound() resolves).
 */
export function EventsListLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-2">
          <div className="h-7 w-40 animate-pulse rounded-md bg-muted" />
          <div className="h-4 w-72 animate-pulse rounded-md bg-muted" />
        </div>
        <div className="h-10 w-32 animate-pulse rounded-md bg-muted" />
      </div>

      <Card>
        <CardContent className="space-y-3 p-6">
          {Array.from({ length: 5 }).map((_, index) => (
            <div
              key={index}
              className="h-10 w-full animate-pulse rounded-md bg-muted"
            />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
