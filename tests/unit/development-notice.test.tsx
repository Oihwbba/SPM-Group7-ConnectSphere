import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { DevelopmentNotice } from "@/components/app/development-notice";

const SAYS =
  "This site is the ConnectSphere team&#x27;s development environment, used to build and coordinate the project. It isn&#x27;t a service for customers.";

describe("SCRUM-237 — the development-environment notice", () => {
  it.each(["strip", "panel"] as const)(
    "SCRUM-237 [AC1, AC4] TC-237-01, TC-237-02: the %s says the site is the team's development environment, not a service for customers",
    (variant) => {
      const html = renderToStaticMarkup(<DevelopmentNotice variant={variant} />);

      expect(html).toContain(SAYS);
      expect(html).toContain('role="note"');
    },
  );

  it("SCRUM-237 [AC2] TC-237-03: both use the theme's colours, the strip across the page and the panel as a card", () => {
    const strip = renderToStaticMarkup(<DevelopmentNotice variant="strip" />);
    const panel = renderToStaticMarkup(<DevelopmentNotice variant="panel" />);

    expect(strip).toContain("bg-muted ");
    expect(strip).toContain("border-b");
    expect(panel).toContain("rounded-lg border bg-muted/60");
    for (const html of [strip, panel]) {
      expect(html).toContain("text-muted-foreground");
      expect(html).not.toMatch(/#[0-9a-f]{3,6}\b|rgb\(|hsl\(/i);
    }
  });
});
