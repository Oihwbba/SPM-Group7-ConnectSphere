import { redirect } from "next/navigation";

/**
 * SCRUM-166 AC2 — a check's own address, kept for the links already sent in
 * notifications. SCRUM-211: it opens in the queue itself.
 */
export default async function SafetyCheckReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/safety-checks?status=all&open=${encodeURIComponent(id)}`);
}
