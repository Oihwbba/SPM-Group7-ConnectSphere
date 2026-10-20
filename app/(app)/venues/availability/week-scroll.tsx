"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * The week grid's scrolling window. The grid covers the whole day, but opens
 * scrolled to `top` (the start of the working day, or earlier if something
 * starts earlier), so the hours that matter are in view without a scroll.
 */
export function WeekScroll({
  top,
  children,
}: {
  top: number;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.scrollTop = top;
  }, [top]);

  return (
    <div
      ref={ref}
      // A scrolling area keyboard users can focus and scroll with the arrows.
      tabIndex={0}
      role="region"
      aria-label="Week, by hour"
      className="max-h-[36rem] overflow-y-auto rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {children}
    </div>
  );
}
