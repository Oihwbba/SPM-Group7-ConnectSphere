import Link from "next/link";
import { ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Rendered by a server component when the signed-in role is not allowed to see
 * a route. The important part is WHERE it is decided: the server chose not to
 * render the real page, so this is a genuine server-side refusal, not a hidden
 * link the user could reach by typing the URL.
 */
export function Forbidden() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="max-w-md text-center">
        <CardContent className="flex flex-col items-center gap-4 pt-6">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <ShieldAlert className="h-6 w-6" />
          </span>
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">Access denied</h2>
            <p className="text-sm text-muted-foreground">
              Your role does not have access to this page. If you think this is
              a mistake, contact your event coordinator.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/">Back to your dashboard</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
