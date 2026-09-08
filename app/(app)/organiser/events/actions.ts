"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { requirePermission, PermissionError } from "@/lib/auth/can";
import { createDraftEventSchema } from "@/lib/schemas/event";
import { ok, err, type ActionResult } from "@/lib/action-result";

/**
 * THE reference Server Action. Every action follows this exact shape — copy
 * it (see CONTRIBUTING.md):
 *
 *   1. Resolve the signed-in user.
 *   2. requirePermission FIRST — before any parsing or work.
 *   3. Validate input with the shared Zod schema.
 *   4. Do the work.
 *   5. Return an ActionResult (never throw across the boundary for expected
 *      failures).
 *
 * `input` is typed `unknown` on purpose: the trust boundary is Zod, not
 * TypeScript. The client can send anything; step 3 is what makes it safe.
 */
export async function createDraftEvent(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const session = await auth();
  const user = session?.user;

  try {
    // 2. Permission first. Throws PermissionError if the user is missing or
    //    lacks the capability; we convert that to an ActionResult below.
    requirePermission(user, "event:create");

    // 3. Validate. On failure, return field errors the form can render.
    const parsed = createDraftEventSchema.safeParse(input);
    if (!parsed.success) {
      return err(
        "Please fix the highlighted fields.",
        parsed.error.flatten().fieldErrors,
      );
    }

    // 4. Do the work. A draft only needs a name and (optional) description;
    //    the organiser completes the rest before submitting for review.
    //    `user` is guaranteed defined here — requirePermission would have
    //    thrown otherwise.
    const event = await prisma.event.create({
      data: {
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        status: "DRAFT",
        organiserId: user!.id,
      },
      select: { id: true },
    });

    // Refresh the list this action feeds.
    revalidatePath("/organiser/events");

    // 5. Success.
    return ok({ id: event.id });
  } catch (error) {
    if (error instanceof PermissionError) {
      return err(error.message);
    }
    // Anything else is a real bug — let it surface.
    throw error;
  }
}
