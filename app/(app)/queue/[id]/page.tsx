import { redirect } from "next/navigation";

/**
 * SCRUM-165 AC3 — a queued request's own address, kept for the links already
 * sent in notifications. SCRUM-211: it opens in the queue itself.
 */
export default async function QueueRequestPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/queue?status=all&open=${encodeURIComponent(id)}`);
}
