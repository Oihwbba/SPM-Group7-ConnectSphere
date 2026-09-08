import { cn } from "@/lib/utils";
import styles from "@/components/auth/animated-sphere.module.css";

/**
 * The app's brand mark: a miniature of the login sphere. Same glass-orb recipe
 * (see animated-sphere.module.css `.logo`), sized by the caller. Decorative, so
 * it's hidden from assistive tech — the "ConnectSphere" wordmark carries the
 * name.
 */
export function SphereLogo({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(styles.logo, "inline-block shrink-0", className)}
    />
  );
}
