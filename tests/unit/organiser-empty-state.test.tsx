import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { EventsClient } from "@/app/(app)/events/events-client";

// SCRUM-84 AC5 — an Organiser with no requests is told so and offered to
// create one. Rendering only: the router and the actions are never reached.
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }) }));
vi.mock("@/app/(app)/events/actions", () => ({}));
vi.mock("@/app/(app)/events/clarification-actions", () => ({}));

describe("My Events with no requests — SCRUM-84 AC5", () => {
  it("SCRUM-84 [AC5] TC-84-04: says there are no events yet and offers Create Event Request", () => {
    const html = renderToStaticMarkup(<EventsClient events={[]} />);

    expect(html).toContain("No events yet");
    expect(html).toContain(
      "Create your first draft event to get started. You can complete the details and submit it for review later.",
    );
    expect(html.match(/<button[^>]*>(?:(?!<\/button>).)*Create Event Request<\/button>/g)?.length).toBe(2);
  });

  it("SCRUM-84 [AC5] TC-84-04: a Coordinator with nothing to review is told so, with nothing to create", () => {
    const html = renderToStaticMarkup(<EventsClient events={[]} isCoordinator />);

    expect(html).toContain("No submitted event requests");
    expect(html).not.toContain("Create Event Request");
  });
});
