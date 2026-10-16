import { describe, it, expect, vi } from "vitest";

import { showSaveReply } from "@/components/events/edit-details-dialog";

// SCRUM-25 AC3 — what the Edit details dialog does with a save's reply. The
// action and the router are never reached: the reply is given directly.
vi.mock("@/app/(app)/events/edit-actions", () => ({
  canEditEventDetails: vi.fn(),
  updateEventDetails: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

function dialogUi() {
  return {
    showError: vi.fn(),
    showWarning: vi.fn(),
    close: vi.fn(),
    refresh: vi.fn(),
    onSaved: vi.fn(),
  };
}

describe("showSaveReply — SCRUM-25", () => {
  it("SCRUM-25 [AC3] TC-25-21: a save that flags an arrangement closes the dialog and tells the event's details to read the flags and the checklist again", () => {
    const ui = dialogUi();

    showSaveReply(
      {
        ok: true,
        data: { changed: ["expectedAttendance"], safetyCheckOutdated: false, flagged: 1 },
      },
      ui,
    );

    expect(ui.close).toHaveBeenCalledWith(
      "Details saved. 1 arrangement flagged Needs Reconsideration.",
    );
    expect(ui.onSaved).toHaveBeenCalledTimes(1);
    expect(ui.refresh).toHaveBeenCalledTimes(1);
    expect(ui.showError).not.toHaveBeenCalled();
    expect(ui.showWarning).not.toHaveBeenCalled();
  });

  it("SCRUM-25 [AC3] TC-25-21: the warning saved nothing, so the dialog stays open and nothing around it reads again", () => {
    const ui = dialogUi();
    const arrangements = [
      { kind: "booking" as const, id: "bkg_1", label: "Exhibition Hall (Pending)" },
    ];

    showSaveReply({ ok: true, data: { confirm: arrangements, message: null } }, ui);

    expect(ui.showWarning).toHaveBeenCalledWith({ arrangements, message: null });
    expect(ui.close).not.toHaveBeenCalled();
    expect(ui.onSaved).not.toHaveBeenCalled();
    expect(ui.refresh).not.toHaveBeenCalled();
  });

  it("SCRUM-25 [AC1] TC-25-21: a refused save changed nothing, so the dialog stays open and nothing around it reads again", () => {
    const ui = dialogUi();

    showSaveReply(
      {
        ok: false,
        error: "Please fix the highlighted fields.",
        fieldErrors: { name: ["Event name is required."] },
      },
      ui,
    );

    expect(ui.showError).toHaveBeenCalledWith("Please fix the highlighted fields.", {
      name: ["Event name is required."],
    });
    expect(ui.close).not.toHaveBeenCalled();
    expect(ui.onSaved).not.toHaveBeenCalled();
    expect(ui.refresh).not.toHaveBeenCalled();
  });

  it("SCRUM-25 [AC1, AC3] TC-25-20, TC-25-21: with the reply lost the save may have flagged something, so the dialog stays open and the view around it reads again", () => {
    const ui = dialogUi();

    showSaveReply(null, ui);

    expect(ui.showError).toHaveBeenCalledWith(
      "The details couldn't be saved — check your connection and try again.",
      {},
    );
    expect(ui.close).not.toHaveBeenCalled();
    expect(ui.onSaved).toHaveBeenCalledTimes(1);
    expect(ui.refresh).toHaveBeenCalledTimes(1);
  });
});
