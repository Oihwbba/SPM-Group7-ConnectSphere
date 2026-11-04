import Link from "next/link";
import { Home, SearchX } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * SCRUM-207 — the app's own "not found" page, in place of Next's default
 * black 404 box: what happened, and the way back to the user's own list.
 */
export function NotFoundMessage() {
  return (
    <div
      className="mx-auto max-w-lg space-y-4 rounded-xl border border-border bg-card p-6"
      data-testid="not-found"
    >
      <div className="flex items-start gap-3">
        <SearchX className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
        <div className="space-y-1">
          <h1 className="text-lg font-semibold">This page doesn&apos;t exist</h1>
          <p className="text-sm text-muted-foreground">
            The link may be mistyped, or what it pointed to was removed. Go back to your
            own list and find it from there.
          </p>
        </div>
      </div>
      <div className="flex justify-center">
        <Button asChild>
          <Link href="/">
            <Home className="h-4 w-4" aria-hidden />
            Go to my home page
          </Link>
        </Button>
      </div>
    </div>
  );
}
