import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import AppError from "@/app/(app)/error";

// The page shown when a page's server work fails (the 20 Oct audit): an
// alert with a heading, what happened, a reference to quote and a way to try
// again. Rendering only; the retry callback is Next's own.
describe("app error page", () => {
  const render = (digest?: string) =>
    renderToStaticMarkup(
      <AppError
        error={Object.assign(new Error("database unreachable"), { digest })}
        retry={() => {}}
      />,
    );

  it("says the page couldn't load, gives the reference and offers to try again", () => {
    const html = render("abc123");

    expect(html).toContain('role="alert"');
    expect(html).toMatch(/<h1[^>]*>This page couldn(&#x27;|')t load<\/h1>/);
    expect(html).toContain("abc123");
    expect(html).toMatch(/<button[^>]*>.*Try again<\/button>/);
    // The server's own message isn't shown to the user.
    expect(html).not.toContain("database unreachable");
  });

  it("leaves out the reference line when there is none", () => {
    expect(render()).not.toContain("Reference");
  });
});
