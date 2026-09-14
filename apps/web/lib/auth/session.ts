import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { authStore } from "./store";

/** Account identity stored in a chat session. */
export interface ChatUser { did: string; handle: string; avatar?: string }
export const LOGIN_TTL = 10 * 60_000;
export const SESSION_TTL = 7 * 24 * 60 * 60_000;
export const LOGIN_COOKIE = "chartize-login";
export const SESSION_COOKIE = "chartize-session";
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
export const newToken = () => randomBytes(32).toString("base64url");

export class AuthError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}

/** Resolves and validates the configured public origin. */
export function publicOrigin() {
  const url = new URL(process.env.CHARTIZE_PUBLIC_URL ?? (process.env.NODE_ENV === "production" ? "https://chartize.dileepreddy.com" : "http://localhost:3000"));
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.username || url.password || url.search || url.hash || url.pathname !== "/" || (url.protocol !== "https:" && !(loopback && url.protocol === "http:"))) {
    throw new Error("CHARTIZE_PUBLIC_URL must be an HTTPS origin (or HTTP loopback for local development).");
  }
  return url.origin;
}

/** Validates the Origin header of an authenticated mutation request. */
export function assertSameOrigin(request: Request) {
  if (request.headers.get("origin") !== publicOrigin()) throw new AuthError("Open Chartize on its configured site address and try again.", 403);
}

export async function setAuthCookie(name: string, token: string, ttl: number) {
  (await cookies()).set(name, token, { httpOnly: true, secure: publicOrigin().startsWith("https:"), sameSite: "lax", path: "/", maxAge: Math.floor(ttl / 1000) });
}

/** Looks up an unexpired session using the cookie's SHA-256 digest. */
export async function chatUser(): Promise<ChatUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token && /^[\w-]{43}$/.test(token) ? authStore().get<ChatUser>("session", hashToken(token)) ?? null : null;
}

/** Stores a new session digest and sets its HttpOnly bearer cookie. */
export async function createChatSession(user: ChatUser) {
  const token = newToken();
  authStore().set("session", hashToken(token), user, SESSION_TTL);
  await setAuthCookie(SESSION_COOKIE, token, SESSION_TTL);
}

/** Revokes the current session and pending login cookie. */
export async function logout() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) authStore().delete("session", hashToken(token));
  const pending = jar.get(LOGIN_COOKIE)?.value;
  if (pending) authStore().delete("login-secret", hashToken(pending));
  await setAuthCookie(SESSION_COOKIE, "", 0);
  await setAuthCookie(LOGIN_COOKIE, "", 0);
}

/** Reads a JSON body with a limit on the actual streamed byte count. */
export async function readJson(request: Request, maxBytes = 1_000_000): Promise<unknown> {
  if (!request.headers.get("content-type")?.includes("application/json")) throw new AuthError("Send a JSON request.", 415);
  const reader = request.body?.getReader();
  if (!reader) throw new AuthError("The request is empty.");
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) throw new AuthError("This request is too large. Try a smaller selection.", 413);
      chunks.push(value);
    }
    try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
    catch { throw new AuthError("The request is not valid JSON."); }
  } finally { await reader.cancel().catch(() => undefined); }
}
