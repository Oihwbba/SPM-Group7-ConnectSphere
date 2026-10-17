/**
 * Streamed while the server component loads the venue catalogue. It sits in
 * a route group so it doesn't wrap `/venues/[id]`, whose `notFound()` must
 * still return a real 404 (as `events/[id]`, which has no loading boundary).
 */
export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading venues">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2">
          <div className="h-7 w-48 animate-pulse rounded-md bg-muted" />
          <div className="h-4 w-80 max-w-full animate-pulse rounded-md bg-muted" />
        </div>
        <div className="h-10 w-32 animate-pulse rounded-md bg-muted" />
      </div>
      <div className="space-y-2 rounded-md border p-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-9 w-full animate-pulse rounded-md bg-muted/40" />
        ))}
      </div>
    </div>
  );
}
