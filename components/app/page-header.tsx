import Link from "next/link";
import { ArrowLeft } from "lucide-react";

/**
 * SCRUM-207 AC1 — the top of every page: one title, one line saying what the
 * page is for, and, on a page that isn't in the menu, a link back to the page
 * it was reached from. `actions` sit on the right of the title, such as a
 * page's "New request" button.
 */
export function PageHeader({
  title,
  description,
  back,
  actions,
}: {
  title: React.ReactNode;
  description: React.ReactNode;
  /** Where "Back to …" leads, and the name of that page. */
  back?: { href: string; to: string };
  actions?: React.ReactNode;
}) {
  return (
    <div className="space-y-3" data-testid="page-header">
      {back && (
        <Link
          href={back.href}
          data-testid="back-link"
          className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground md:min-h-6"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to {back.to}
        </Link>
      )}
      {/* The actions sit beside the title, on a phone as on a desktop; the
          description keeps the full width beneath them both. */}
      <div className="space-y-1">
        <div className="flex flex-wrap items-start justify-between gap-3">
          {/* The title keeps a floor of its own, so wide actions beside it
              cannot squeeze it away; where even that will not fit — a 320px
              screen — the actions drop beneath it rather than off the edge. */}
          <h1 className="flex min-w-[7rem] flex-1 flex-wrap items-center gap-2 break-words text-2xl font-semibold tracking-tight">
            {title}
          </h1>
          {actions && (
            <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
              {actions}
            </div>
          )}
        </div>
        <p
          className="text-sm text-muted-foreground"
          data-testid="page-description"
        >
          {description}
        </p>
      </div>
    </div>
  );
}
