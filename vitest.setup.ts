// Runs before each Vitest file. Keep this minimal — the unit tests mock their
// own dependencies (Prisma, auth) so they never touch a real database.
import { vi } from "vitest";

// `next/cache`'s revalidatePath is a no-op outside a request, so stub it to
// avoid noisy errors when an action calls it during a unit test.
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));
