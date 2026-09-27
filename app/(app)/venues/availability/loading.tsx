/** Streamed while the availability calendar loads (SCRUM-36). */
export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="h-8 w-64 max-w-full animate-pulse rounded-md bg-muted" />
        <div className="h-4 w-96 max-w-full animate-pulse rounded-md bg-muted" />
      </div>
      <div className="grid gap-4 sm:grid-cols-[2fr_1fr_1fr]">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className="h-16 animate-pulse rounded-md bg-muted/40"
          />
        ))}
      </div>
      <div className="space-y-2">
        {Array.from({ length: 7 }).map((_, index) => (
          <div
            key={index}
            className="h-20 animate-pulse rounded-xl bg-muted/40"
          />
        ))}
      </div>
    </div>
  );
}
