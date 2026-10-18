import { describe, it, expect } from "vitest";

import { fromParts, toParts } from "@/app/(app)/venues/search/time-field";

// SCRUM-38 AC2 — the start and end time are picked as hour, minute and AM or
// PM, and sent as the 24-hour "HH:mm" the search reads.
describe("the venue search time picker — SCRUM-38 AC2", () => {
  it("SCRUM-38 [AC2] TC-38-21: an hour and PM with the minutes left alone is that hour in the afternoon", () => {
    expect(fromParts({ hour: "5", minute: "00", half: "PM" })).toBe("17:00");
    expect(fromParts({ hour: "9", minute: "00", half: "AM" })).toBe("09:00");
  });

  it("SCRUM-38 [AC2] TC-38-21: 12 AM is midnight and 12 PM is noon", () => {
    expect(fromParts({ hour: "12", minute: "00", half: "AM" })).toBe("00:00");
    expect(fromParts({ hour: "12", minute: "30", half: "PM" })).toBe("12:30");
    expect(fromParts({ hour: "11", minute: "59", half: "PM" })).toBe("23:59");
  });

  it("SCRUM-38 [AC2] TC-38-21: no hour is no time, whatever the minutes say", () => {
    expect(fromParts({ hour: "", minute: "45", half: "PM" })).toBe("");
  });

  it("SCRUM-38 [AC2] TC-38-21: a time searched shows again as it was picked, and no time starts at 00", () => {
    expect(toParts("17:05")).toEqual({ hour: "5", minute: "05", half: "PM" });
    expect(toParts("00:00")).toEqual({ hour: "12", minute: "00", half: "AM" });
    expect(toParts("12:00")).toEqual({ hour: "12", minute: "00", half: "PM" });
    expect(toParts(undefined)).toEqual({ hour: "", minute: "00", half: "AM" });
    for (const time of ["00:00", "07:30", "12:00", "15:01", "23:59"]) {
      expect(fromParts(toParts(time))).toBe(time);
    }
  });
});
