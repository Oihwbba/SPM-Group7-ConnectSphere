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
    <div ref={ref} className="max-h-[36rem] overflow-y-auto">
      {children}
    </div>
  );
}
