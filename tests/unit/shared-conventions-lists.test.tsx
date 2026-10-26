import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { ReviewQueue } from "@/app/(app)/equipment-requests/review-queue";
import { CoordinatorRequests } from "@/app/(app)/equipment-requests/coordinator-requests";
import type {
  CoordinatorEquipmentRequest,
  QueuedEquipmentRequest,
} from "@/lib/equipment/request-queries";

// Rendering only: no action, router call or note is reached.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));
vi.mock("@/app/(app)/equipment-requests/actions", () => ({
  updateEquipmentRequestStatus: vi.fn(),
  suggestAlternativeEquipment: vi.fn(),
  withdrawEquipmentRequest: vi.fn(),
  createEquipmentRequest: vi.fn(),
  changeEquipmentRequest: vi.fn(),
}));
vi.mock("@/app/(app)/events/edit-actions", () => ({
  getOperationalNotes: vi.fn(() => new Promise(() => {})),
  addOperationalNote: vi.fn(),
}));

const request = {
  id: "req_1",
  status: "PENDING_REVIEW",
  createdAt: new Date("2034-11-01T02:00:00Z"),
  decidedAt: null,
  notes: null,
  requestedBy: { name: "Cody Coordinator" },
  event: {
    id: "evt_1",
    name: "Robotics Expo",
    status: "PLANNING",
    startAt: new Date("2034-11-07T01:00:00Z"),
    endAt: new Date("2034-11-07T09:00:00Z"),
    equipmentRequirements: "Two projectors",
  },
  lines: [],
  updates: [],
};

describe("SCRUM-207 — shared page conventions in the equipment request lists", () => {
  it("SCRUM-207 [AC2] TC-207-03: a request's row shows its status with the shared badge and the story's name for it", () => {
    const html = renderToStaticMarkup(
      <ReviewQueue requests={[request as unknown as QueuedEquipmentRequest]} />,
    );
    expect(html).toContain('data-testid="review-row"');
    expect(html).toMatch(
      /data-testid="request-status"[^>]*><svg[\s\S]*?<\/svg><span>Pending Review<\/span>/,
    );
  });

  it("SCRUM-207 [AC3] TC-207-04: an empty review queue says why it is empty and what comes next", () => {
    const html = renderToStaticMarkup(<ReviewQueue requests={[]} />);
    expect(html).toContain("No requests waiting for review");
    expect(html).toContain(
      "New equipment requests from coordinators appear here.",
    );
    expect(html).not.toContain('data-testid="review-row"');
  });

  it("SCRUM-207 [AC3] TC-207-05: a Coordinator with no requests is told what to do next, and offered the button for it", () => {
    const html = renderToStaticMarkup(
      <CoordinatorRequests
        requests={[] as CoordinatorEquipmentRequest[]}
        canCreate
        events={[
          {
            id: "evt_1",
            name: "Robotics Expo",
          } as unknown as Parameters<typeof CoordinatorRequests>[0]["events"][number],
        ]}
        equipment={[]}
      />,
    );
    expect(html).toContain("No equipment requests yet");
    expect(html).toContain(
      "Ask for projectors, microphones and anything else from the equipment list for one of your approved events.",
    );
    expect(html.match(/New request/g)?.length).toBeGreaterThanOrEqual(2);
  });
});
