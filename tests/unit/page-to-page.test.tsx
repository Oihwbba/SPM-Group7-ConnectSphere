import { readdirSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { CalendarDays } from "lucide-react";
import { describe, it, expect, vi, beforeEach } from "vitest";

const linkStatus = vi.hoisted(() => ({ pending: false }));
vi.mock("next/link", () => ({ useLinkStatus: () => linkStatus }));

import { PendingNavIcon } from "@/components/app/pending-nav-icon";

/** Every file under a folder, as paths relative to the repo root. */
function filesUnder(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? filesUnder(join(dir, entry.name)) : [join(dir, entry.name)],
  );
}

// SCRUM-207 — moving between pages keeps the current page until the next is
// ready, so nothing flashes in between; the clicked menu link shows it's loading.
describe("SCRUM-207 — moving between pages", () => {
  beforeEach(() => {
    linkStatus.pending = false;
  });

  it("SCRUM-207 TC-207-25: no page behind sign-in has a loading skeleton, so none can flash between pages", () => {
    const loadingFiles = filesUnder(join("app", "(app)")).filter((file) => /(^|[\\/])loading\.(tsx|ts|jsx|js)$/.test(file));

    expect(loadingFiles).toEqual([]);
  });

  it("SCRUM-207 TC-207-25: a menu link shows its own icon while nothing is loading", () => {
    const html = renderToStaticMarkup(<PendingNavIcon icon={CalendarDays} className="h-5 w-5" />);

    expect(html).toContain("lucide-calendar-days");
    expect(html).not.toContain("data-pending");
  });

  it("SCRUM-207 TC-207-25: while its page loads, the clicked link's icon becomes a spinner, which stays still for anyone who prefers reduced motion", () => {
    linkStatus.pending = true;

    const html = renderToStaticMarkup(<PendingNavIcon icon={CalendarDays} className="h-5 w-5" />);

    expect(html).toContain("data-pending");
    expect(html).not.toContain("lucide-calendar-days");
    expect(html).toContain("h-5 w-5 motion-safe:animate-spin");
    expect(html).not.toMatch(/(^|\s)animate-spin/);
  });
});
