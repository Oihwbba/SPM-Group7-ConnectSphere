"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import {
  queueHref,
  type QueueDefaults,
  type QueueStatus,
  type QueueView,
} from "@/lib/queues";
import { cn } from "@/lib/utils";

const FILTERS: { status: QueueStatus; label: string }[] = [
  { status: "waiting", label: "Waiting" },
  { status: "decided", label: "Decided" },
  { status: "all", label: "All" },
];

/**
 * SCRUM-211 AC2 — the same status filter and search box, in the same place,
 * on every queue. Both are kept in the link: the filter as links, the search
 * written in as it is typed (after a short pause), replacing the address so
 * Back isn't filled with every keystroke.
 */
export function QueueControls({
  base,
  view,
  defaults,
  searchLabel = "Search by event name",
}: {
  base: string;
  view: QueueView;
  defaults: QueueDefaults;
  /** What the box matches, where a queue searches more than the event's name. */
  searchLabel?: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState(view.q);

  // A new address (Clear search, Back) shows what it says.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing from the address
    setQuery(view.q);
  }, [view.q]);

  useEffect(() => {
    if (query.trim() === view.q) return;
    const timer = setTimeout(() => {
      router.replace(
        queueHref(base, view, defaults, { q: query.trim(), open: null }),
      );
    }, 300);
    return () => clearTimeout(timer);
  }, [query, view, base, defaults, router]);

  return (
    <div
      className="flex flex-wrap items-center gap-3"
      data-testid="queue-controls"
    >
      <nav
        aria-label="Show"
        className="flex gap-1 rounded-full border bg-card/60 p-1"
      >
        {FILTERS.map(({ status, label }) => (
          <Link
            key={status}
            href={queueHref(base, view, defaults, { status, open: null })}
            aria-current={view.status === status ? "page" : undefined}
            className={cn(
              "rounded-full px-3 py-1 text-sm transition-colors",
              view.status === status
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {label}
          </Link>
        ))}
      </nav>
      <form
        role="search"
        className="relative w-full max-w-sm"
        onSubmit={(e) => {
          e.preventDefault();
          router.replace(
            queueHref(base, view, defaults, { q: query.trim(), open: null }),
          );
        }}
      >
        <Search
          className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          type="search"
          aria-label={searchLabel}
          placeholder={`${searchLabel}…`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9"
        />
      </form>
    </div>
  );
}
