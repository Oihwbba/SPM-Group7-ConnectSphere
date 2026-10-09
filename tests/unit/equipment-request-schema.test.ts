import { describe, it, expect } from "vitest";

import {
  createEquipmentRequestSchema,
  equipmentRequestLineSchema,
  fieldErrorsByPath,
} from "@/lib/schemas/equipment-request";

// SCRUM-27 — the one schema the request form and createEquipmentRequest share,
// so the rules below are checked identically in the browser and on the server.
const line = (overrides: Record<string, unknown> = {}) => ({
  equipmentId: "eqp_projector",
  quantity: "2",
  technicalRequirements: "",
  ...overrides,
});

describe("equipmentRequestLineSchema — SCRUM-27", () => {
  it("SCRUM-27 [AC3] TC-27-05: accepts a positive whole number and reads it as a number", () => {
    const parsed = equipmentRequestLineSchema.safeParse(
      line({ quantity: "3" }),
    );
    expect(parsed.success && parsed.data.quantity).toBe(3);
  });

  it("SCRUM-27 [AC3] TC-27-05: accepts exactly 1, the smallest quantity", () => {
    expect(
      equipmentRequestLineSchema.safeParse(line({ quantity: "1" })).success,
    ).toBe(true);
  });

  it.each([
    ["zero", "0"],
    ["a negative number", "-2"],
    ["a fraction", "1.5"],
    ["text", "two"],
    ["a blank", ""],
  ])("SCRUM-27 [AC3] TC-27-05: refuses %s as the quantity", (_label, quantity) => {
    const parsed = equipmentRequestLineSchema.safeParse(line({ quantity }));
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.flatten().fieldErrors.quantity).toEqual([
        "Quantity must be a positive whole number.",
      ]);
    }
  });

  it("SCRUM-27 [AC3] TC-27-05: refuses a quantity above 1,000, so the database column can never overflow", () => {
    const parsed = equipmentRequestLineSchema.safeParse(
      line({ quantity: "1001" }),
    );
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.flatten().fieldErrors.quantity).toEqual([
        "Quantity can be at most 1,000.",
      ]);
    }
  });

  it("SCRUM-27 [AC2] TC-27-04: requires an equipment type from the list", () => {
    const parsed = equipmentRequestLineSchema.safeParse(
      line({ equipmentId: "" }),
    );
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.flatten().fieldErrors.equipmentId).toEqual([
        "Select an equipment type.",
      ]);
    }
  });

  it("SCRUM-27 [AC5] TC-27-07: keeps free-text technical requirements, trimmed", () => {
    const parsed = equipmentRequestLineSchema.safeParse(
      line({ technicalRequirements: "  HDMI to the stage, 4K if possible  " }),
    );
    expect(parsed.success && parsed.data.technicalRequirements).toBe(
      "HDMI to the stage, 4K if possible",
    );
  });

  it("SCRUM-27 [AC5] TC-27-07: technical requirements are optional, and a blank one is stored as none", () => {
    const parsed = equipmentRequestLineSchema.safeParse(
      line({ technicalRequirements: "   " }),
    );
    expect(parsed.success && parsed.data.technicalRequirements).toBeNull();

    const omitted = equipmentRequestLineSchema.safeParse({
      equipmentId: "eqp_projector",
      quantity: 1,
    });
    expect(omitted.success && omitted.data.technicalRequirements).toBeNull();
  });

  // regression: the form adds a line by parsing it, then checks the whole
  // request again before sending it, so a parsed line must parse again.
  it("regression: accepts a line it has already parsed, with no requirements", () => {
    const once = equipmentRequestLineSchema.parse(
      line({ technicalRequirements: "" }),
    );
    const twice = equipmentRequestLineSchema.safeParse(once);
    expect(twice.success && twice.data).toEqual({
      equipmentId: "eqp_projector",
      quantity: 2,
      technicalRequirements: null,
    });
  });

  it("refuses technical requirements over 1,000 characters", () => {
    const parsed = equipmentRequestLineSchema.safeParse(
      line({ technicalRequirements: "x".repeat(1001) }),
    );
    expect(parsed.success).toBe(false);
  });
});

describe("createEquipmentRequestSchema — SCRUM-27", () => {
  const request = (overrides: Record<string, unknown> = {}) => ({
    eventId: "evt_approved",
    notes: "",
    lines: [line()],
    ...overrides,
  });

  it("SCRUM-27 TC-27-13: requires the event the request is for", () => {
    const parsed = createEquipmentRequestSchema.safeParse(
      request({ eventId: "" }),
    );
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.flatten().fieldErrors.eventId).toEqual([
        "Select an event.",
      ]);
    }
  });

  it("SCRUM-27 TC-27-13: requires at least one equipment item", () => {
    const parsed = createEquipmentRequestSchema.safeParse(
      request({ lines: [] }),
    );
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.flatten().fieldErrors.lines).toEqual([
        "Add at least one equipment item.",
      ]);
    }
  });

  it("SCRUM-27 [AC4] TC-27-06: refuses the same equipment type twice on one request", () => {
    const parsed = createEquipmentRequestSchema.safeParse(
      request({ lines: [line(), line({ quantity: "1" })] }),
    );
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(fieldErrorsByPath(parsed.error)).toEqual({
        "lines.1.equipmentId": [
          "This equipment type is already on the request.",
        ],
      });
    }
  });

  it("SCRUM-27 [AC2, AC4] TC-27-03, TC-27-06: accepts different equipment types on one request", () => {
    const parsed = createEquipmentRequestSchema.safeParse(
      request({ lines: [line(), line({ equipmentId: "eqp_mic" })] }),
    );
    expect(parsed.success).toBe(true);
  });

  it("regression: accepts a request built from lines the form has already parsed", () => {
    const parsed = createEquipmentRequestSchema.safeParse({
      eventId: "evt_approved",
      notes: null,
      lines: [equipmentRequestLineSchema.parse(line())],
    });
    expect(parsed.success).toBe(true);
  });

  it("stores blank notes as none and trims the rest", () => {
    const blank = createEquipmentRequestSchema.safeParse(
      request({ notes: "  " }),
    );
    expect(blank.success && blank.data.notes).toBeNull();

    const written = createEquipmentRequestSchema.safeParse(
      request({ notes: " Stage left, please. " }),
    );
    expect(written.success && written.data.notes).toBe("Stage left, please.");
  });
});

describe("fieldErrorsByPath", () => {
  it("keys each message by its full path, so a form can place it on the right line", () => {
    const parsed = createEquipmentRequestSchema.safeParse({
      eventId: "",
      lines: [line({ quantity: "0" })],
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(fieldErrorsByPath(parsed.error)).toEqual({
        eventId: ["Select an event."],
        "lines.0.quantity": ["Quantity must be a positive whole number."],
      });
    }
  });
});
