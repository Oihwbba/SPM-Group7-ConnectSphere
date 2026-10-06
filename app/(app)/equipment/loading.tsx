import { Card, CardContent, CardHeader } from "@/components/ui/card";

function CardHeaderSkeleton({ titleWidth }: { titleWidth: string }) {
  return (
    <CardHeader className="pb-4">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 shrink-0 animate-pulse rounded-xl bg-muted" />
        <div className="space-y-2">
          <div
            className={`h-6 ${titleWidth} animate-pulse rounded-md bg-muted`}
          />
          <div className="h-4 w-72 animate-pulse rounded-md bg-muted" />
        </div>
      </div>
    </CardHeader>
  );
}

/**
 * Streamed by Next.js while the server component fetches equipment and the
 * approved requests. Mirrors the page: reserving an approved request on top,
 * equipment availability below (SCRUM-156), so the layout doesn't jump.
 */
export default function Loading() {
  return (
    <div className="space-y-6">
      {/* 1. Reserve an approved request */}
      <Card className="shadow-xs border border-border bg-card text-card-foreground backdrop-blur-none">
        <CardHeaderSkeleton titleWidth="w-60" />
        <CardContent className="pt-2">
          <div className="h-16 w-full animate-pulse rounded-md bg-muted/40" />
        </CardContent>
      </Card>

      {/* 2. Equipment availability */}
      <Card className="shadow-xs border border-border bg-card text-card-foreground backdrop-blur-none">
        <CardHeaderSkeleton titleWidth="w-52" />
        <CardContent className="space-y-6 pt-2">
          <div className="h-16 w-full max-w-md animate-pulse rounded-md bg-muted/40" />
          <div className="h-20 w-full animate-pulse rounded-md bg-muted/40" />
          <div className="h-10 w-32 animate-pulse rounded-md bg-muted/40" />
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
