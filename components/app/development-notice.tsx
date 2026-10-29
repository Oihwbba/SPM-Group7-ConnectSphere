import { Info } from "lucide-react";

import { cn } from "@/lib/utils";

export const DEVELOPMENT_NOTICE =
  "This site is the ConnectSphere team's development environment, used to build and coordinate the project. It isn't a service for customers.";

/**
 * SCRUM-237 — says the deployed site is where the team builds the project, so
 * nobody takes it for a live service. `strip` runs across the top of every
 * signed-in page; `panel` sits under the sign-in form.
 */
export function DevelopmentNotice({ variant }: { variant: "strip" | "panel" }) {
  return (
    <p
      role="note"
      data-testid="development-notice"
      className={cn(
        "flex items-start gap-2 text-xs text-muted-foreground",
        variant === "strip"
          ? "justify-center border-b bg-muted px-4 py-1.5 text-center sm:px-6"
          : "mt-6 rounded-lg border bg-muted/60 p-3",
      )}
    >
      <Info className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
      <span>{DEVELOPMENT_NOTICE}</span>
    </p>
  );
}
