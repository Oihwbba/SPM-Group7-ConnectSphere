import { describe, it, expect, vi } from "vitest";
import type { Prisma } from "@prisma/client";

import { notifyAboutEvent } from "@/lib/event-notifications";

// SCRUM-45 AC12, AC13 — the one helper every workflow notice goes through.
function client() {
  const createMany = vi.fn().mockResolvedValue({ count: 0 });
  return {
    tx: { notification: { createMany } } as unknown as Prisma.TransactionClient,
    createMany,
  };
}
const event = { id: "evt_1", name: "Career Fair" };

describe("notifyAboutEvent — SCRUM-45", () => {
  it("SCRUM-45 [AC12] TC-45-08: each recipient gets a notice about the event, saying what happened", async () => {
    const { tx, createMany } = client();

    await notifyAboutEvent(tx, ["usr_org", "usr_coord"], event, {
      title: "Registration is full",
      message: '"Career Fair" has reached its capacity of 2.',
    });

    expect(createMany).toHaveBeenCalledWith({
      data: ["usr_org", "usr_coord"].map((userId) => ({
        userId,
        type: "EVENT_STATUS_CHANGED",
        eventId: "evt_1",
        title: "Registration is full",
        message: '"Career Fair" has reached its capacity of 2.',
      })),
    });
  });

  it("SCRUM-45 [AC13] TC-45-08: a person named twice is notified once, and a missing Coordinator is skipped", async () => {
    const { tx, createMany } = client();

    await notifyAboutEvent(tx, ["usr_org", null, "usr_org"], event, {
      title: "t",
      message: "m",
    });

    expect(
      createMany.mock.calls[0][0].data.map((n: { userId: string }) => n.userId),
    ).toEqual(["usr_org"]);
  });

  it("SCRUM-45 [AC11] TC-45-07: a notice for a known future time carries its show-from time", async () => {
    const { tx, createMany } = client();
    const closesAt = new Date("2031-06-01T01:00:00.000Z");

    await notifyAboutEvent(tx, ["usr_org"], event, {
      title: "Registration closed",
      message: "m",
      showFromAt: closesAt,
    });

    expect(createMany.mock.calls[0][0].data[0].showFromAt).toEqual(closesAt);
  });
});
