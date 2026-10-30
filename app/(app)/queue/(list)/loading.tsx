import { QueueLoading } from "@/components/queues/queue-loading";

/** Streamed while the server component loads the Lead's Unassigned queue. */
export default function Loading() {
  return <QueueLoading label="Loading the unassigned queue" />;
}
