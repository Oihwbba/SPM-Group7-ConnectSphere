import { NotFoundMessage } from "@/components/app/not-found-message";

/** A page in the app that calls notFound(): shown inside the app's own frame. */
export default function AppNotFound() {
  return <NotFoundMessage />;
}
