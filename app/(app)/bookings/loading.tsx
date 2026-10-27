import { QueueLoading } from "@/components/queues/queue-loading";

/** Streamed while the server component loads the booking queue (SCRUM-52). */
export default function Loading() {
  return <QueueLoading label="Loading booking requests" />;
}
