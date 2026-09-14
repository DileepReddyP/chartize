import "server-only";

import { safeFetchWrap } from "@atproto-labs/fetch-node";
import { authStore } from "./store";
import type { ChatUser } from "./session";

const fetchProfile = safeFetchWrap({ timeout: 3000, responseMaxSize: 512_000 });
type PublicProfile = Pick<ChatUser, "handle" | "avatar">;

/** Accepts avatar images served by Bluesky's image CDN. */
function avatarUrl(value: unknown) {
  if (typeof value !== "string" || value.length > 2048) return;
  try {
    const url = new URL(value);
    if (url.origin === "https://cdn.bsky.app" && !url.username && !url.password && url.pathname.startsWith("/img/avatar/")) return url.href;
  } catch { return; }
  return undefined;
}

/** Refreshes the verified account's public handle and photo for login and existing sessions. */
export async function withPublicProfile(user: ChatUser | null, refresh = false): Promise<ChatUser | null> {
  if (!user) return null;
  const store = authStore();
  const cached = refresh ? undefined : store.get<PublicProfile | null>("public-profile", user.did);
  if (cached !== undefined) return cached ? { did: user.did, ...cached } : user;
  try {
    const response = await fetchProfile(`https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?${new URLSearchParams({ actor: user.did })}`, { redirect: "error", signal: AbortSignal.timeout(3000) });
    if (!response.ok) throw new Error("Profile unavailable.");
    const profile = await response.json() as Record<string, unknown>;
    if (profile.did !== user.did || typeof profile.handle !== "string" || !profile.handle || profile.handle.length > 253) throw new Error("Invalid public profile.");
    const avatar = avatarUrl(profile.avatar);
    const details: PublicProfile = { handle: profile.handle, ...(avatar ? { avatar } : {}) };
    store.set("public-profile", user.did, details, 5 * 60_000);
    return { did: user.did, ...details };
  } catch {
    store.set("public-profile", user.did, null, 30_000);
    return user;
  }
}
