import { describe, expect, it, vi } from "vitest";

import { err, ok, runAction } from "@/lib/action-result";

/**
 * runAction is the client-side safety net for the project-wide convention that
 * Server Actions return `ActionResult` for expected failures. It matters for
 * one case only: an *unexpected* throw inside `startTransition(async () => …)`,
 * which otherwise rejects unhandled and leaves the button disabled forever.
 */
describe("runAction", () => {
  it("passes a successful result straight through", async () => {
    const result = await runAction(async () => ok({ id: "evt_1" }));

    expect(result).toEqual({ ok: true, data: { id: "evt_1" } });
  });

  it("passes an expected failure through untouched, keeping its field errors", async () => {
    const failure = err("Please fix the highlighted fields.", {
      name: ["Required"],
    });

    const result = await runAction(async () => failure);

    expect(result).toBe(failure);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("Please fix the highlighted fields.");
      expect(result.fieldErrors?.name).toEqual(["Required"]);
    }
  });

  it("turns an unexpected throw into an err() instead of rejecting", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const result = await runAction(async () => {
      throw new Error("connection reset");
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("Something went wrong. Please try again.");
    }
    consoleError.mockRestore();
  });

  it("does not leak the underlying error text to the user", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const result = await runAction(async () => {
      throw new Error("DATABASE_URL=postgres://user:hunter2@host/db");
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).not.toContain("hunter2");
      expect(result.error).not.toContain("DATABASE_URL");
    }
    consoleError.mockRestore();
  });

  it("logs the real cause to the console so it is still debuggable", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const boom = new Error("connection reset");

    await runAction(async () => {
      throw boom;
    });

    expect(consoleError).toHaveBeenCalledWith(
      "Server action failed unexpectedly:",
      boom,
    );
    consoleError.mockRestore();
  });

  it("catches a rejected promise, not only a synchronous throw", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const result = await runAction(() =>
      Promise.reject(new Error("network")),
    );

    expect(result.ok).toBe(false);
    consoleError.mockRestore();
  });
});
