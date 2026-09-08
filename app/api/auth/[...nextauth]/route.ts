// Auth.js route handlers. This exposes the endpoints Auth.js needs (callback,
// signout, session, etc.) under /api/auth/*. Nothing here is called directly;
// server actions use `signIn`/`signOut` from @/auth instead.
import { handlers } from "@/auth";

export const { GET, POST } = handlers;
