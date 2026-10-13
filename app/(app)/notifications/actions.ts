"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { PermissionError, requirePermission } from "@/lib/auth/can";
import { err, ok, type ActionResult } from "@/lib/action-result";
import { visibleNotificationsWhere } from "@/lib/notifications";
import { markNotificationReadSchema } from "@/lib/schemas/notification";

const NOT_FOUND = "Notification not found.";

/**
 * SCRUM-48 AC2 — opening an unread notification marks it read.
 *
 * Someone else's notification, one that doesn't exist and one that isn't
 * showing yet all give the same "not found" (AC6, AC8). Opening a read one
 * again succeeds and keeps the first read time.
 */
export async function markNotificationRead(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const session = await auth();
  try {
    requirePermission(session?.user, "notification:read");
    const parsed = markNotificationReadSchema.safeParse(input);
    if (!parsed.success) {
      return err(NOT_FOUND, parsed.error.flatten().fieldErrors);
    }
    const { id } = parsed.data;
    const now = new Date();
    const visible = visibleNotificationsWhere(session!.user.id, now);

    const notification = await prisma.notification.findFirst({
      where: { id, ...visible },
      select: { id: true },
    });
    if (!notification) return err(NOT_FOUND);

    await prisma.notification.updateMany({
      where: { id, ...visible, readAt: null },
      data: { readAt: now },
    });

    // The unread count is in the layout's header (AC3).
    revalidatePath("/", "layout");
    return ok({ id });
  } catch (e) {
    if (e instanceof PermissionError) return err(e.message);
    throw e;
  }
}
