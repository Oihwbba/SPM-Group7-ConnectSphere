import { z } from "zod";

/**
 * Shared by the login form and the Credentials `authorize` callback so the
 * rules are written once. Kept deliberately loose on the password (we only
 * check presence at sign-in; strength rules belong on registration, which is
 * not part of the foundation).
 */
export const loginSchema = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});

export type LoginInput = z.infer<typeof loginSchema>;
