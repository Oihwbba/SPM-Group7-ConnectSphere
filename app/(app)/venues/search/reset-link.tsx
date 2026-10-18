"use client";

import Link from "next/link";
import type { ComponentProps } from "react";

/**
 * SCRUM-38 — Reset: back to the search as it opens. Following the link alone
 * left anything typed but not searched on screen, because the address it goes
 * to can be the one already open, so the form is reset as well.
 */
export function ResetLink({
  formId,
  ...props
}: ComponentProps<typeof Link> & { formId: string }) {
  return (
    <Link
      {...props}
      onClick={() => {
        const form = document.getElementById(formId);
        if (form instanceof HTMLFormElement) form.reset();
      }}
    />
  );
}
