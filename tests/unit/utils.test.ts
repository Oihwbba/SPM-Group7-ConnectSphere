import { describe, expect, it } from "vitest";

import { cn } from "@/lib/utils";

describe("class name utility", () => {
  it("merges conditional class values and lets later Tailwind classes win", () => {
    expect(
      cn(
        "rounded-md px-2 text-sm",
        false && "hidden",
        ["px-4", { "font-medium": true, "opacity-50": false }],
        undefined,
        "text-lg",
      ),
    ).toBe("rounded-md px-4 font-medium text-lg");
  });
});
