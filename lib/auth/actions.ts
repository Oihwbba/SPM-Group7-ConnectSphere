"use server";

import { AuthError } from "next-auth";

import { signIn, signOut } from "@/auth";

/**
 * Sign-in server action, wired to the login form via React's useActionState.
 * Returns an error string on failure; on success `signIn` throws a redirect
 * (NEXT_REDIRECT) which we deliberately re-throw so Next.js can navigate to
 * the app root, which then routes the user to their role's landing page.
 */
export async function authenticate(
  _prevState: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: "/",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      // The Credentials provider throws CredentialsSignin for any bad login —
      // we intentionally don't reveal whether it was the email or password.
      if (error.type === "CredentialsSignin") {
        return "Invalid email or password.";
      }
      return "Something went wrong signing in. Please try again.";
    }
    // Re-throw redirects and anything unexpected.
    throw error;
  }
  return undefined;
}

/** Sign out and return to the login page. */
export async function signOutAction(): Promise<void> {
  await signOut({ redirectTo: "/login" });
}
