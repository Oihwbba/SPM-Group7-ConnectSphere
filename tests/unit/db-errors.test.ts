import { describe, it, expect, vi } from "vitest";

import { onceMoreOnDeadlock, postgresError } from "@/lib/db-errors";

// The two shapes Prisma's pg adapter gives a database refusal, as logged from
// a real deadlock: a model query's error carries it in `cause`; a raw query's
// is a P2010 error carrying it in `meta.driverAdapterError.cause`.
const deadlock = { originalCode: "40P01", originalMessage: "deadlock detected" };
const fromModelQuery = Object.assign(new Error("deadlock"), { cause: deadlock });
const fromRawQuery = Object.assign(new Error("Raw query failed. Code: `40P01`."), {
  code: "P2010",
  meta: { driverAdapterError: { name: "DriverAdapterError", cause: deadlock } },
});

describe("onceMoreOnDeadlock — SCRUM-202", () => {
  it("SCRUM-202 [AC2] TC-202-04: a deadlock raised by a raw query is recognised, like one from a model query", () => {
    for (const error of [fromModelQuery, fromRawQuery]) {
      expect(postgresError(error)).toEqual({ code: "40P01", message: "deadlock detected" });
    }
    expect(postgresError(new Error("other"))).toEqual({ code: undefined, message: "" });
  });

  it("SCRUM-202 [AC2] TC-202-04: an attempt aborted as a deadlock in a raw query is run once more", async () => {
    const attempt = vi
      .fn()
      .mockRejectedValueOnce(fromRawQuery)
      .mockResolvedValueOnce("saved");

    await expect(onceMoreOnDeadlock(attempt)).resolves.toBe("saved");
    expect(attempt).toHaveBeenCalledTimes(2);
  });

  it("SCRUM-202 [AC2] TC-202-04: any other raw-query failure is thrown at once, not retried", async () => {
    const other = { ...fromRawQuery, meta: { driverAdapterError: { cause: { originalCode: "23505" } } } };
    const attempt = vi.fn().mockRejectedValue(other);

    await expect(onceMoreOnDeadlock(attempt)).rejects.toBe(other);
    expect(attempt).toHaveBeenCalledTimes(1);
  });
});
