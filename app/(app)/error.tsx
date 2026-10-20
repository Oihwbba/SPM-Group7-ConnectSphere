"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCw } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Shown in place of a page whose server work failed, for example when the
 * database can't be reached, instead of Next's generic error screen. Nothing
 * was saved by the failed load, so trying again is safe.
 */
export default function AppError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div role="alert" className="mx-auto max-w-lg space-y-4 rounded-xl border border-border bg-card p-6">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" aria-hidden />
        <div className="space-y-1">
          <h1 className="text-lg font-semibold">This page couldn&apos;t load</h1>
          <p className="text-sm text-muted-foreground">
            Something went wrong while loading it, and nothing was changed. Try again in a
            moment. If it keeps happening, tell the team and quote the reference below.
          </p>
          {error.digest && (
            <p className="text-xs text-muted-foreground">
              Reference: <span className="font-mono">{error.digest}</span>
            </p>
          )}
        </div>
      </div>
      <Button onClick={() => retry()}>
        <RotateCw className="h-4 w-4" aria-hidden />
        Try again
      </Button>
    </div>
  );
}
