import "server-only";

import { AuthError, chatUser, type ChatUser } from "./session";
import { authStore } from "./store";

/** Adds current database-backed permissions to the verified ATProto profile. */
export function withAdminRole(user: ChatUser | null) {
  return user ? { ...user, isAdmin: authStore().isAdmin("atproto", user.did) } : null;
}

/** Requires an active session whose provider and account ID have admin membership. */
export async function requireAdmin() {
  const user = withAdminRole(await chatUser());
  if (!user) throw new AuthError("Sign in to access Chartize admin.", 401);
  if (!user.isAdmin) throw new AuthError("This account does not have admin access.", 403);
  return user;
}
