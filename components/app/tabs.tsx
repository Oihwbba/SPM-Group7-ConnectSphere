"use client";

import { useId, useRef, useState } from "react";

import { cn } from "@/lib/utils";

export type Tab = {
  id: string;
  label: React.ReactNode;
  content: React.ReactNode;
};

/**
 * Tabs inside a detail pop-up (shared page conventions): one panel shows at a
 * time, the others stay mounted so what they load is ready when chosen.
 * Arrow keys move between tabs, as the ARIA tabs pattern expects.
 */
export function Tabs({
  tabs,
  label,
  initial,
  value,
  onChange,
  showTabs = true,
}: {
  tabs: Tab[];
  /** What the tabs are, for screen readers, e.g. "Event request". */
  label: string;
  initial?: string;
  /** The open tab, when the caller keeps it (e.g. in the page's link). */
  value?: string;
  onChange?: (id: string) => void;
  /** False shows only the first panel and no tabs, keeping the rest mounted. */
  showTabs?: boolean;
}) {
  const [own, setOwn] = useState(initial ?? tabs[0]?.id);
  const active = value ?? own;
  const setActive = (id: string) => {
    setOwn(id);
    onChange?.(id);
  };
  const base = useId();
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  function move(from: number, by: number) {
    const next = (from + by + tabs.length) % tabs.length;
    setActive(tabs[next].id);
    buttons.current[next]?.focus();
  }

  return (
    <div className="space-y-4">
      <div
        role="tablist"
        aria-label={label}
        hidden={!showTabs}
        // On a phone the tabs scroll sideways rather than squeezing (SCRUM-132).
        className="flex gap-1 overflow-x-auto border-b [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {tabs.map((tab, i) => {
          const selected = tab.id === active;
          return (
            <button
              key={tab.id}
              ref={(el) => {
                buttons.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`${base}-${tab.id}-tab`}
              aria-selected={selected}
              aria-controls={`${base}-${tab.id}-panel`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(tab.id)}
              onKeyDown={(e) => {
                if (e.key === "ArrowRight") move(i, 1);
                if (e.key === "ArrowLeft") move(i, -1);
              }}
              className={cn(
                "relative -mb-px inline-flex flex-1 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                selected
                  ? "border-primary font-semibold text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      {tabs.map((tab) => (
        <div
          key={tab.id}
          role="tabpanel"
          id={`${base}-${tab.id}-panel`}
          aria-labelledby={`${base}-${tab.id}-tab`}
          hidden={showTabs ? tab.id !== active : tab.id !== tabs[0]?.id}
        >
          {tab.content}
        </div>
      ))}
    </div>
  );
}
