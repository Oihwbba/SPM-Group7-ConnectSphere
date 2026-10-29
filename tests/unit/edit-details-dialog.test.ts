import { describe, it, expect, vi } from "vitest";

import {
  periodToSave,
  showSaveReply,
} from "@/components/events/edit-details-dialog";
import { NOT_ONE_DAY_MESSAGE } from "@/lib/schemas/event";
import { eventDetailsEditSchema } from "@/lib/schemas/event-edit";

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

  it("SCRUM-25 [AC1, AC3] TC-25-21: a refused save changed nothing, so the dialog stays open and nothing around it reads again", () => {
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

// SCRUM-190 AC3 — an event entered across two days before the one-day rule
// (09:00 SGT on 3 Mar 2036 to 17:00 SGT on 4 Mar) can't be shown as one date.
describe("periodToSave — SCRUM-190 AC3", () => {
  const twoDays = {
    startAt: new Date("2036-03-03T01:00:00.000Z"),
    endAt: new Date("2036-03-04T09:00:00.000Z"),
  };
  const asRead = { date: "2036-03-03", startTime: "09:00", endTime: "17:00" };

  function editWith(period: { startAt: string; endAt: string }) {
    return eventDetailsEditSchema.safeParse({
      eventId: "evt_1",
      name: "Renamed",
      expectedAttendance: 10,
      ...period,
    });
  }

  it("SCRUM-190 [AC3] TC-190-11: a save that leaves a two-day period's fields as read sends the stored period, not one moved onto the start's day", () => {
    expect(periodToSave(twoDays, asRead)).toEqual({
      startAt: "2036-03-03T01:00:00.000Z",
      endAt: "2036-03-04T09:00:00.000Z",
    });
  });

  it("SCRUM-190 [AC3] TC-190-11: so that save is refused as not one day, until the Coordinator sets one", () => {
    const result = editWith(periodToSave(twoDays, asRead));

    expect(result.success).toBe(false);
    expect(result.error?.flatten().fieldErrors.endAt).toEqual([
      NOT_ONE_DAY_MESSAGE,
    ]);
  });

  it("SCRUM-190 [AC3] TC-190-11: once the Coordinator changes a time, the period saved is the one date with the times they see", () => {
    const period = periodToSave(twoDays, { ...asRead, endTime: "17:30" });

    expect(period).toEqual({
      startAt: "2036-03-03T01:00:00.000Z",
      endAt: "2036-03-03T09:30:00.000Z",
    });
    expect(editWith(period).success).toBe(true);
  });

  it("SCRUM-190 [AC3] TC-190-11: a one-day period left as read is saved unchanged", () => {
    const oneDay = {
      startAt: "2036-03-03T01:00:00.000Z",
      endAt: "2036-03-03T09:00:00.000Z",
    };

    expect(periodToSave(oneDay, asRead)).toEqual(oneDay);
  });

  it("SCRUM-190 [AC3] TC-190-11: a period never set stays empty, so the save asks for it", () => {
    expect(
      periodToSave(
        { startAt: null, endAt: null },
        { date: "", startTime: "", endTime: "" },
      ),
    ).toEqual({ startAt: "", endAt: "" });
  });
});
