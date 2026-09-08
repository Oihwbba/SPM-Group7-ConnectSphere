import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge Tailwind class names, resolving conflicts (the later class wins).
 * Used by every shadcn/ui component. This is the only utility that belongs
 * here — do not turn lib/utils into a junk drawer.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
