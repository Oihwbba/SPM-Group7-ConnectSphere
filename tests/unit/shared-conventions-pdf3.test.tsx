import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { AuditTrail } from "@/components/app/audit-trail";
import { NotificationsList } from "@/app/(app)/notifications/notifications-list";
import type { MyNotification } from "@/app/(app)/notifications/queries";

// Rendering only: opening a notification is never reached.
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/app/(app)/notifications/actions", () => ({
  markNotificationRead: vi.fn(),
}));

const AT = new Date("2034-11-07T02:00:00Z");

describe("AuditTrail — shared page conventions", () => {
  it("SCRUM-207 TC-207-18: joins entries with a dotted line, and leaves a single entry without one", () => {
    const entry = (id: string) => ({ id, at: AT, note: id, by: "Vera Venue" });
    const one = renderToStaticMarkup(<AuditTrail entries={[entry("a")]} />);
    expect(one).not.toContain("after:border-dotted");

    const two = renderToStaticMarkup(
      <AuditTrail entries={[entry("a"), entry("b")]} />,
    );
    // Only the first of the two reaches down to the next.
    expect(two.match(/after:border-dotted/g)).toHaveLength(1);
  });

  it("SCRUM-207 TC-207-18: names the author in a pill, read as “by” its name", () => {
    const html = renderToStaticMarkup(
      <AuditTrail entries={[{ id: "a", at: AT, note: "Doors at 9", by: "Vera Venue" }]} />,
    );
    expect(html).toContain("rounded-full");
    expect(html).toMatch(/<span class="sr-only">by <\/span>Vera Venue/);
  });
});

describe("notification cards — shared page conventions", () => {
  it("SCRUM-207 TC-207-19: are white with a violet left edge, read or unread", () => {
    const notification = (id: string, readAt: Date | null) =>
      ({
        id,
        type: "RESERVATION_CANCELLED",
        title: "Reservation cancelled",
        message: "The projector was released.",
        readAt,
        showFromAt: AT,
        href: null,
      }) as MyNotification;
    const html = renderToStaticMarkup(
      <NotificationsList
        notifications={[notification("ntf_1", null), notification("ntf_2", AT)]}
      />,
    );
    expect(html.match(/border-l-violet-500 bg-card/g)).toHaveLength(2);
    expect(html).not.toContain("bg-primary/5");
  });
});
