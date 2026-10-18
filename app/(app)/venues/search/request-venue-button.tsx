"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

/**
 * SCRUM-38 AC9 — sends the search form, as it is on screen, to the request
 * form with this venue chosen. next/form builds its URL from the form alone,
 * leaving out the clicked button's name and value, so the venue is added
 * here; without JavaScript, the browser's own submit includes it.
 */
export function RequestVenueButton({
  formId,
  venueId,
}: {
  formId: string;
  venueId: string;
}) {
  const router = useRouter();
  return (
    <Button
      type="submit"
      size="sm"
      form={formId}
      formAction="/bookings/new"
      name="venue"
      value={venueId}
      onClick={(e) => {
        const form = e.currentTarget.form;
        if (!form) return;
        e.preventDefault();
        const params = new URLSearchParams();
        for (const [name, value] of new FormData(form, e.currentTarget)) {
          if (typeof value === "string") params.append(name, value);
        }
        router.push(`/bookings/new?${params}`);
      }}
    >
      Request this venue
    </Button>
  );
}
