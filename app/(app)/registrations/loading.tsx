import { Card, CardContent, CardHeader } from "@/components/ui/card";

/** Shown while the Attendee's registrations load. A folder-level loading.tsx
 * is safe here: no nested route under registrations/ calls notFound(). */
export default function RegistrationsLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="h-7 w-48 animate-pulse rounded-md bg-muted" />
        <div className="h-4 w-80 animate-pulse rounded-md bg-muted" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Card key={index}>
            <CardHeader>
              <div className="h-5 w-3/4 animate-pulse rounded-md bg-muted" />
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="h-4 w-2/3 animate-pulse rounded-md bg-muted" />
              <div className="h-4 w-1/2 animate-pulse rounded-md bg-muted" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
