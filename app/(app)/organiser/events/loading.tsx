import { Card, CardContent } from "@/components/ui/card";

/**
 * Streamed by Next.js while the server component fetches events. A simple
 * skeleton that matches the table's shape, so the layout does not jump when
 * the real data arrives. Copy this alongside any page that does a DB read.
 */
export default function Loading() {
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
