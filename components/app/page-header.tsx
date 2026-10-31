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
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to {back.to}
        </Link>
      )}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h1 className="flex flex-wrap items-center gap-2 break-words text-2xl font-semibold tracking-tight">
            {title}
          </h1>
          <p
            className="text-sm text-muted-foreground"
            data-testid="page-description"
          >
            {description}
          </p>
        </div>
        {actions && (
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        )}
      </div>
    </div>
  );
}
