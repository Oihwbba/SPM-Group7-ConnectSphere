import { Card, CardContent, CardHeader } from "@/components/ui/card";

/** Streamed while the server component loads the requests and the form's lists. */
export default function Loading() {
  return (
    <div
      className="space-y-6"
      aria-busy="true"
      aria-label="Loading equipment requests"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2">
          <div className="h-7 w-56 animate-pulse rounded-md bg-muted" />
          <div className="h-4 w-80 max-w-full animate-pulse rounded-md bg-muted" />
        </div>
        <div className="h-10 w-32 animate-pulse rounded-md bg-muted" />
      </div>
      {Array.from({ length: 2 }).map((_, index) => (
        <Card key={index}>
          <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
            <div className="space-y-2">
              <div className="h-5 w-64 max-w-full animate-pulse rounded-md bg-muted" />
              <div className="h-4 w-48 animate-pulse rounded-md bg-muted" />
            </div>
            <div className="h-6 w-28 animate-pulse rounded-full bg-muted" />
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="h-9 w-full animate-pulse rounded-md bg-muted/40" />
            <div className="h-9 w-full animate-pulse rounded-md bg-muted/40" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
