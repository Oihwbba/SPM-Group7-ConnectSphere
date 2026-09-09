import { Construction } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

/**
 * The "Coming soon" screen every not-yet-built feature route renders. It names
 * the backlog item and its owner, so who is building what is visible at a
 * glance. When a developer builds their feature, they replace this with a real
 * page copied from the /events reference (app/(app)/events).
 */
export function PagePlaceholder({
  title,
  scrumId,
  owner,
  description,
}: {
  title: string;
  scrumId: string;
  owner: string;
  description: string;
}) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <Badge variant="muted">Owner: {owner}</Badge>
      </div>

      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Construction className="h-6 w-6" />
          </span>
          <p className="text-base font-medium">Coming soon</p>
          <p className="text-sm text-muted-foreground">
            This feature will be built in{" "}
            <span className="font-mono text-foreground">{scrumId}</span>.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
