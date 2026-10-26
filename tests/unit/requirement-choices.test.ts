import { describe, it, expect } from "vitest";

import {
  joinChoices,
  splitChoice,
  splitChoices,
} from "@/lib/requirement-choices";

// Shared page conventions, change 7: the event request's free-text venue,
// layout, accessibility and equipment answers shown as choices plus "Other",
// without changing what is stored.
const VENUES = ["Grand Auditorium", "Seminar Room 2.1", "Exhibition Hall"];
const PREFIX = "Preferred venue: ";

describe("splitChoices", () => {
  it("SCRUM-207 TC-207-17: reads the choices the catalogue buttons wrote, in the options' own spelling", () => {
    expect(
      splitChoices(
        "Preferred venue: Grand Auditorium, exhibition hall",
        VENUES,
        PREFIX,
      ),
    ).toEqual({ chosen: ["Grand Auditorium", "Exhibition Hall"], other: "" });
  });

  it("SCRUM-207 TC-207-17: keeps anything that names no option as the Other text", () => {
    expect(
      splitChoices(
        "Preferred venue: Grand Auditorium, needs a stage",
        VENUES,
        PREFIX,
      ),
    ).toEqual({ chosen: ["Grand Auditorium"], other: "needs a stage" });
  });

  it("SCRUM-207 TC-207-17: returns an answer that names no option untouched, so it is never rewritten", () => {
    const text = "Preferred venue: somewhere quiet\nwith parking, near the MRT";
    expect(splitChoices(text, VENUES, PREFIX)).toEqual({
      chosen: [],
      other: text,
    });
  });

  it("SCRUM-207 TC-207-17: lists a choice once, and treats blank as nothing chosen", () => {
    expect(splitChoices("Lift, lift", ["Lift"])).toEqual({
      chosen: ["Lift"],
      other: "",
    });
    expect(splitChoices("   ", ["Lift"])).toEqual({ chosen: [], other: "" });
  });
});

describe("joinChoices", () => {
  it("SCRUM-207 TC-207-17: writes choices after the prefix, then the Other text", () => {
    expect(
      joinChoices(
        { chosen: ["Grand Auditorium"], other: "needs a stage" },
        PREFIX,
      ),
    ).toBe("Preferred venue: Grand Auditorium, needs a stage");
    expect(joinChoices({ chosen: [], other: "anything large" }, PREFIX)).toBe(
      "anything large",
    );
    expect(joinChoices({ chosen: [], other: "  " }, PREFIX)).toBe("");
  });

  it("SCRUM-207 TC-207-17: is read back by splitChoices as the same choices", () => {
    const choices = {
      chosen: ["Exhibition Hall", "Grand Auditorium"],
      other: "needs a stage",
    };
    expect(splitChoices(joinChoices(choices, PREFIX), VENUES, PREFIX)).toEqual(
      choices,
    );
  });
});

describe("splitChoice (one choice, e.g. the room layout)", () => {
  const LAYOUTS = ["Theatre", "U-Shape", "Cocktail / Standing"];

  it("SCRUM-207 TC-207-17: matches an option whatever its case or punctuation", () => {
    expect(splitChoice("u shape", LAYOUTS)).toEqual({
      chosen: ["U-Shape"],
      other: "",
    });
    expect(splitChoice("Theatre", LAYOUTS)).toEqual({
      chosen: ["Theatre"],
      other: "",
    });
  });

  it("SCRUM-207 TC-207-17: keeps anything else as the Other text", () => {
    expect(splitChoice("Garden party", LAYOUTS)).toEqual({
      chosen: [],
      other: "Garden party",
    });
    expect(splitChoice("", LAYOUTS)).toEqual({ chosen: [], other: "" });
  });
});
