import "server-only";

import { NodeOAuthClient, JoseKey, requestLocalLock, type NodeSavedSession, type NodeSavedState, type OAuthClientMetadataInput } from "@atproto/oauth-client-node";
import { safeFetchWrap } from "@atproto-labs/fetch-node";
import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { authStore } from "./store";
import { withPublicProfile } from "./public-profile";
import { AuthError, LOGIN_COOKIE, LOGIN_TTL, createChatSession, hashToken, newToken, publicOrigin, setAuthCookie, type ChatUser } from "./session";

const safeFetch = safeFetchWrap({ allowImplicitRedirect: true, timeout: 15_000, responseMaxSize: 512_000 });
const globals = globalThis as typeof globalThis & { chartizeOAuthClient?: Promise<NodeOAuthClient> };

/** Builds the shared ATProto client and its persistent signing key and state stores. */
export function oauthClient() {
  return globals.chartizeOAuthClient ??= (async () => {
    const origin = publicOrigin();
    const local = origin.startsWith("http:");
    const callback = new URL("/api/auth/callback", origin);
    if (local) callback.hostname = "127.0.0.1";
    const clientId = local
      ? `http://localhost?${new URLSearchParams({ redirect_uri: callback.href, scope: "atproto" })}`
      : `${origin}/api/auth/client-metadata.json`;
    const metadata: OAuthClientMetadataInput = {
      client_id: clientId, client_name: "Chartize", client_uri: origin,
      redirect_uris: [callback.href], scope: "atproto",
      grant_types: ["authorization_code", "refresh_token"], response_types: ["code"],
      application_type: local ? "native" : "web", dpop_bound_access_tokens: true,
      token_endpoint_auth_method: local ? "none" : "private_key_jwt",
      ...(!local ? { token_endpoint_auth_signing_alg: "ES256", jwks_uri: `${origin}/api/auth/jwks.json` } : {}),
    };
    const store = authStore();
    const keyset: JoseKey[] = [];
    if (!local) {
      let jwk = store.get<Record<string, unknown>>("key", "signing");
      if (!jwk) {
        const generated = await JoseKey.generate(["ES256"], "chartize-1");
        jwk = generated.jwk;
        store.set("key", "signing", jwk, 100 * 365 * 24 * 60 * 60_000);
      }
      keyset.push(await JoseKey.fromJWK(jwk));
    }
    return new NodeOAuthClient({
      clientMetadata: metadata, keyset, fetch: safeFetch, requestLock: requestLocalLock,
      stateStore: store.oauthStore<NodeSavedState>("oauth-state"),
      sessionStore: store.oauthStore<NodeSavedSession>("oauth-session"),
    });
  })().catch((error) => { delete globals.chartizeOAuthClient; throw error; });
}

interface LoginAttempt { user?: ChatUser }

/** Opens Bluesky's account chooser and binds the OAuth attempt to this browser. */
export async function startLogin(signal: AbortSignal) {
  const store = authStore();
  if (!store.reserve([{ key: `login:${Math.floor(Date.now() / 60_000)}`, max: 30, ttl: 120_000 }])) {
    throw new AuthError("There are a lot of sign-in attempts right now. Try again in a minute.", 429);
  }
  const id = randomUUID();
  const secret = newToken();
  const url = await (await oauthClient()).authorize("https://bsky.social", { state: id, scope: "atproto", signal: AbortSignal.any([signal, AbortSignal.timeout(45_000)]) });
  store.set("login", id, {}, LOGIN_TTL);
  store.set("login-secret", hashToken(secret), id, LOGIN_TTL);
  await setAuthCookie(LOGIN_COOKIE, secret, LOGIN_TTL);
  return url.href;
}

/** Verifies the provider callback and records the authenticated DID for browser completion. */
export async function finishLogin(params: URLSearchParams) {
  const client = await oauthClient();
  const { session, state } = await client.callback(params);
  const store = authStore();
  if (!state || !store.get<LoginAttempt>("login", state)) throw new AuthError("This sign-in expired. Start again in Chartize.");
  const user = await withPublicProfile({ did: session.did, handle: session.did }, true);
  store.set("login", state, { user }, LOGIN_TTL);
  store.delete("oauth-session", session.did);
}

/** Exchanges the initiating browser's login secret for an authenticated chat session. */
export async function completeLogin(): Promise<ChatUser | null> {
  const secret = (await cookies()).get(LOGIN_COOKIE)?.value;
  const store = authStore();
  const id = secret ? store.get<string>("login-secret", hashToken(secret)) : undefined;
  if (!id) throw new AuthError("This sign-in expired. Please try again.", 401);
  const attempt = store.get<LoginAttempt>("login", id);
  if (!attempt?.user) return null;
  store.delete("login", id);
  store.delete("login-secret", hashToken(secret!));
  await createChatSession(attempt.user);
  await setAuthCookie(LOGIN_COOKIE, "", 0);
  return attempt.user;
}
