"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";

/**
 * Toast host. The app is a single light theme, so we simply hand Sonner the
 * light theme and style it to match our frosted cards.
 */
function Toaster(props: ToasterProps) {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:border-border/60 group-[.toaster]:bg-card/90 group-[.toaster]:text-card-foreground group-[.toaster]:shadow-glass group-[.toaster]:backdrop-blur-glass",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
}

export { Toaster };
