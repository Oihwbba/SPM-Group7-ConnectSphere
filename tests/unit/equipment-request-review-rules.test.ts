import { describe, it, expect } from "vitest";
import type { EquipmentRequestStatus } from "@prisma/client";

import {
  canMoveRequest,
  formatEventPeriod,
  reviewLine,
} from "@/lib/equipment/requests";
import {
  reviewEquipmentRequestSchema,
  suggestAlternativeSchema,
} from "@/lib/schemas/equipment-request";

// SCRUM-28 — the pure rules behind reviewing a request: which status moves are
// allowed, and what a line looks like against what is free for its event.

describe("canMoveRequest — SCRUM-28 [AC2, AC3]", () => {
  it.each<[EquipmentRequestStatus, EquipmentRequestStatus]>([
    ["PENDING_REVIEW", "IN_REVIEW"],
    ["IN_REVIEW", "APPROVED"],
    ["IN_REVIEW", "REJECTED"],
  ])("allows %s → %s", (from, to) => {
    expect(canMoveRequest(from, to)).toBe(true);
  });

  it.each<[EquipmentRequestStatus, EquipmentRequestStatus]>([
    ["PENDING_REVIEW", "APPROVED"],
    ["PENDING_REVIEW", "REJECTED"],
    ["IN_REVIEW", "PENDING_REVIEW"],
    ["IN_REVIEW", "IN_REVIEW"],
    ["APPROVED", "REJECTED"],
    ["REJECTED", "APPROVED"],
    ["APPROVED", "IN_REVIEW"],
    ["CANCELLED", "IN_REVIEW"],
  ])("refuses %s → %s", (from, to) => {
    expect(canMoveRequest(from, to)).toBe(false);
  });
});

describe("reviewLine — SCRUM-28 [AC1, AC4]", () => {
  const catalogue = [
    { id: "eqp_laptop", type: "Laptop" },
    { id: "eqp_lectern", type: "Lectern" },
    { id: "eqp_projector", type: "Projector" },
    { id: "eqp_speaker", type: "PA Speaker" },
  ];
  const free = {
    eqp_laptop: { available: 6, total: 15 },
    eqp_lectern: { available: 1, total: 4 },
    eqp_projector: { available: 2, total: 10 },
    eqp_speaker: { available: 3, total: 8 },
  };

  it("SCRUM-28 [AC1] TC-28-01: a line that fits reports what is free and needs no alternative", () => {
    expect(
      reviewLine(
        { equipmentId: "eqp_projector", quantity: 2 },
        free,
        catalogue,
      ),
    ).toEqual({
      available: 2,
      total: 10,
      shortfall: 0,
      alternatives: [],
    });
  });

  it("SCRUM-28 [AC4] TC-28-07: a line that is short offers every other type that could cover the whole quantity", () => {
    expect(
      reviewLine(
        { equipmentId: "eqp_projector", quantity: 3 },
        free,
        catalogue,
      ),
    ).toEqual({
      available: 2,
      total: 10,
      shortfall: 1,
      alternatives: [
        { id: "eqp_laptop", type: "Laptop", available: 6 },
        { id: "eqp_speaker", type: "PA Speaker", available: 3 },
      ],
    });
  });

  it("SCRUM-28 [AC4] TC-28-08: an alternative with exactly the quantity free is offered, one fewer is not", () => {
    const line = reviewLine(
      { equipmentId: "eqp_lectern", quantity: 3 },
      free,
      catalogue,
    );
    expect(line.alternatives.map((item) => item.id)).toEqual([
      "eqp_laptop",
      "eqp_speaker",
    ]);
    expect(line.alternatives.map((item) => item.id)).not.toContain(
      "eqp_projector",
    );
  });

  it("never offers a type whose availability is unknown", () => {
    const withNewType = [...catalogue, { id: "eqp_new", type: "Camera" }];
    const line = reviewLine(
      { equipmentId: "eqp_projector", quantity: 3 },
      free,
      withNewType,
    );
    expect(line.alternatives.map((item) => item.id)).not.toContain("eqp_new");
  });

  it("treats a type that is no longer in the pool as having nothing free", () => {
    expect(
      reviewLine({ equipmentId: "eqp_retired", quantity: 1 }, free, catalogue),
    ).toMatchObject({ available: 0, total: 0, shortfall: 1 });
  });
});

describe("formatEventPeriod — SCRUM-27 AC 1", () => {
  it("shows the event's start and end in Singapore time", () => {
    expect(
      formatEventPeriod({
        startAt: new Date("2031-02-03T01:00:00.000Z"),
        endAt: new Date("2031-02-03T09:30:00.000Z"),
      }),
    ).toBe("3 Feb 2031, 9:00 am SGT – 3 Feb 2031, 5:30 pm SGT");
  });

  it("says the dates are still to come when an event has none", () => {
    expect(formatEventPeriod({ startAt: null, endAt: null })).toBe(
      "Dates to be confirmed",
    );
  });
});

describe("reviewEquipmentRequestSchema — SCRUM-28 [AC2, AC3]", () => {
  it("accepts starting a review with no note", () => {
    const parsed = reviewEquipmentRequestSchema.safeParse({
      requestId: "eqr_1",
      toStatus: "IN_REVIEW",
    });
    expect(parsed.success && parsed.data).toEqual({
      requestId: "eqr_1",
      toStatus: "IN_REVIEW",
      note: null,
    });
  });

  it("accepts approval with an optional note", () => {
    const parsed = reviewEquipmentRequestSchema.safeParse({
      requestId: "eqr_1",
      toStatus: "APPROVED",
      note: " All set. ",
    });
    expect(parsed.success && parsed.data.note).toBe("All set.");
  });

  it("SCRUM-28 [AC3] TC-28-04: requires a reason to reject, so the coordinator knows why", () => {
    const parsed = reviewEquipmentRequestSchema.safeParse({
      requestId: "eqr_1",
      toStatus: "REJECTED",
      note: "  ",
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.flatten().fieldErrors.note).toEqual([
        "Give the coordinator a reason for rejecting the request.",
      ]);
    }
  });

  it("refuses a status Technical Support can't set", () => {
    expect(
      reviewEquipmentRequestSchema.safeParse({
        requestId: "eqr_1",
        toStatus: "PENDING_REVIEW",
      }).success,
    ).toBe(false);
  });
});

describe("suggestAlternativeSchema — SCRUM-28 [AC4]", () => {
  it("needs the request, the line and the alternative", () => {
    const parsed = suggestAlternativeSchema.safeParse({
      requestId: "eqr_1",
      lineId: "eql_1",
      alternativeId: "",
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.flatten().fieldErrors.alternativeId).toEqual([
        "Choose the equipment to suggest.",
      ]);
    }
  });
});
