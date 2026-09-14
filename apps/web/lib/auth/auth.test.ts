import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { jar, profileFetch } = vi.hoisted(() => ({ jar: new Map<string, string>(), profileFetch: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@atproto-labs/fetch-node", () => ({ safeFetchWrap: () => profileFetch }));
vi.mock("next/headers", () => ({ cookies: async () => ({
  get: (name: string) => jar.has(name) ? { value: jar.get(name) } : undefined,
  set: (name: string, value: string) => { jar.set(name, value); },
}) }));
vi.mock("../ai/turn", () => ({ completeAiTurn: vi.fn() }));

import { AuthStore } from "./store";
import { chatUser, createChatSession, hashToken, LOGIN_COOKIE, LOGIN_TTL, logout, readJson, SESSION_COOKIE } from "./session";
import { completeLogin, finishLogin, oauthClient } from "./atproto";
import { reserveAiRequest } from "./ai-access";
import { POST } from "@/app/api/ai/query/route";
import { GET as authGet, POST as authPost } from "@/app/api/auth/[action]/route";
import { GET as loginCallback } from "@/app/api/auth/callback/route";
import { withPublicProfile } from "./public-profile";
import { completeAiTurn } from "../ai/turn";

describe("chat-only authentication", () => {
  let store: AuthStore;
  beforeEach(() => {
    jar.clear();
    vi.clearAllMocks();
    profileFetch.mockReset().mockRejectedValue(new Error("Profile unavailable."));
    vi.stubEnv("CHARTIZE_PUBLIC_URL", "http://localhost:3000");
    store = new AuthStore(new DatabaseSync(":memory:"));
    vi.stubGlobal("chartizeAuthStore", store);
    vi.stubGlobal("chartizeOAuthClient", undefined);
  });
  afterEach(() => { store.db.close(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

  it("requires a real session and same-origin request before any model call", async () => {
    const request = (origin: string) => new Request("http://localhost:3000/api/ai/query", { method: "POST", headers: { origin, "content-type": "application/json" }, body: "{}" });
    expect((await POST(request("https://another-site.example"))).status).toBe(403);
    expect((await POST(request("http://localhost:3000"))).status).toBe(401);
    expect(completeAiTurn).not.toHaveBeenCalled();
    const user = { did: "did:plc:test", handle: "test.bsky.social" };
    await createChatSession(user);
    const token = jar.get(SESSION_COOKIE)!;
    expect(store.get("session", token)).toBeUndefined();
    expect(store.get("session", hashToken(token))).toEqual(user);
    expect(await chatUser()).toEqual(user);
    const stale = request("http://localhost:3000");
    stale.headers.set("x-chartize-profile", "did:plc:another");
    expect((await POST(stale)).status).toBe(409);
    expect(completeAiTurn).not.toHaveBeenCalled();
    await logout();
    jar.set(SESSION_COOKIE, token); // A copied, logged-out cookie is revoked server-side.
    expect(await chatUser()).toBeNull();
  });

  it("opens the configured provider and binds a login cookie without accepting arbitrary issuers", async () => {
    const authorize = vi.fn().mockResolvedValue(new URL("https://bsky.social/oauth/authorize?request_uri=test"));
    vi.stubGlobal("chartizeOAuthClient", Promise.resolve({ authorize }));
    const request = (provider: string) => new Request("http://localhost:3000/api/auth/login", { method: "POST", headers: { origin: "http://localhost:3000", "content-type": "application/json" }, body: JSON.stringify({ provider }) });
    const context = { params: Promise.resolve({ action: "login" }) };
    expect((await authPost(request("https://another-provider.example"), context)).status).toBe(400);
    expect(authorize).not.toHaveBeenCalled();
    const response = await authPost(request("atproto"), context);
    expect(response.status).toBe(200);
    expect((await response.json()).url).toMatch(/^https:\/\/bsky.social\/oauth\/authorize/);
    expect(authorize).toHaveBeenCalledWith("https://bsky.social", expect.objectContaining({ scope: "atproto", state: expect.any(String) }));
    const attempt = authorize.mock.calls[0]![1].state;
    expect(store.get("login-secret", hashToken(jar.get(LOGIN_COOKIE)!))).toBe(attempt);
    expect(store.get("login", attempt)).toEqual({});
  });

  it("binds the verified OAuth identity to the initiating browser, then consumes login once", async () => {
    const user = { did: "did:plc:verified", handle: "verified.bsky.social" };
    vi.stubGlobal("chartizeOAuthClient", Promise.resolve({ callback: async () => ({ state: "attempt", session: { did: user.did } }) }));
    store.set("login", "attempt", {}, LOGIN_TTL);
    store.set("login-secret", hashToken("browser-secret"), "attempt", LOGIN_TTL);
    await finishLogin(new URLSearchParams("code=provider-verified-in-sdk"));
    jar.set(LOGIN_COOKIE, "different-browser");
    await expect(completeLogin()).rejects.toThrow("expired");
    expect(await chatUser()).toBeNull();
    jar.set(LOGIN_COOKIE, "browser-secret");
    expect((await completeLogin())?.did).toBe(user.did);
    expect((await chatUser())?.did).toBe(user.did);
    jar.set(LOGIN_COOKIE, "browser-secret");
    await expect(completeLogin()).rejects.toThrow("expired");
  });

  it("loads a public avatar for an existing session and reuses the profile lookup", async () => {
    const user = { did: "did:plc:existing", handle: "existing.bsky.social" };
    const avatar = "https://cdn.bsky.app/img/avatar/plain/did:plc:existing/photo@jpeg";
    await createChatSession(user);
    profileFetch.mockResolvedValue(Response.json({ ...user, avatar }));
    const request = new Request("http://localhost:3000/api/auth/session");
    const context = { params: Promise.resolve({ action: "session" }) };
    expect(await (await authGet(request, context)).json()).toEqual({ user: { ...user, avatar } });
    expect(await (await authGet(request, context)).json()).toEqual({ user: { ...user, avatar } });
    expect(profileFetch).toHaveBeenCalledTimes(1);
    expect(await chatUser()).toEqual(user);
    jar.clear();
    expect(await (await authGet(request, context)).json()).toEqual({ user: null });
    expect(profileFetch).toHaveBeenCalledTimes(1);
  });

  it("keeps the verified identity and filters untrusted avatar locations", async () => {
    const user = { did: "did:plc:verified", handle: "verified.bsky.social" };
    profileFetch.mockResolvedValue(Response.json({ did: "did:plc:someoneelse", handle: "another.bsky.social", avatar: "https://cdn.bsky.app/img/avatar/plain/photo@jpeg" }));
    expect(await withPublicProfile(user, true)).toEqual(user);
    for (const avatar of ["javascript:alert(1)", "http://cdn.bsky.app/img/avatar/plain/photo", "https://another-site.example/photo.jpg"]) {
      profileFetch.mockResolvedValue(Response.json({ ...user, avatar }));
      expect(await withPublicProfile(user, true)).toEqual(user);
    }
  });

  it("hands off callback results to the styled page with provider parameters removed", async () => {
    const callback = vi.fn().mockRejectedValue(new Error("provider details"));
    vi.stubGlobal("chartizeOAuthClient", Promise.resolve({ callback }));
    const request = new Request("http://127.0.0.1:3000/api/auth/callback?code=provider-secret&state=private-state");
    const failed = await loginCallback(request);
    expect(failed.status).toBe(303);
    expect(failed.headers.get("location")).toBe("http://localhost:3000/login/complete?status=incomplete");
    expect(failed.headers.get("referrer-policy")).toBe("no-referrer");
    callback.mockResolvedValue({ state: "attempt", session: { did: "did:plc:verified" } });
    store.set("login", "attempt", {}, LOGIN_TTL);
    const success = await loginCallback(request);
    expect(success.headers.get("location")).toBe("http://localhost:3000/login/complete?status=confirmed");
    expect(await chatUser()).toBeNull();
    expect(store.get("login", "attempt")).toEqual({ user: { did: "did:plc:verified", handle: "did:plc:verified" } });
  });

  it("uses identity-only loopback metadata locally and publishes no private signing key", async () => {
    const local = await oauthClient();
    expect(local.clientMetadata.scope).toBe("atproto");
    expect(local.clientMetadata.redirect_uris).toEqual(["http://127.0.0.1:3000/api/auth/callback"]);
    vi.stubGlobal("chartizeOAuthClient", undefined);
    vi.stubEnv("CHARTIZE_PUBLIC_URL", "https://chartize.example.com");
    const production = await oauthClient();
    expect(production.clientMetadata.token_endpoint_auth_method).toBe("private_key_jwt");
    expect(production.jwks.keys).toHaveLength(1);
    expect(JSON.parse(JSON.stringify(production.jwks)).keys[0]).not.toHaveProperty("d");
  });

  it("counts a user turn once, enforces concurrent/daily limits, and rolls back rejected reservations", () => {
    vi.stubEnv("CHARTIZE_AI_USER_DAILY_TURNS", "1");
    const first = reserveAiRequest("did:plc:quota", true);
    expect(() => reserveAiRequest("did:plc:quota", false)).toThrow("still running");
    first.release();
    const continuation = reserveAiRequest("did:plc:quota", false);
    continuation.release();
    expect(() => reserveAiRequest("did:plc:quota", true)).toThrow("limit");
    expect(store.reserve([{ key: "allowed", max: 10, ttl: 1000 }, { key: "blocked", max: 0, ttl: 1000 }])).toBe(false);
    expect(store.get("quota", "allowed")).toBeUndefined();
  });

  it("limits actual request bytes even when the declared size is missing or false", async () => {
    const request = new Request("http://localhost:3000/api/ai/query", { method: "POST", headers: { "content-type": "application/json", "content-length": "1" }, body: JSON.stringify({ tooLarge: "x".repeat(100) }) });
    await expect(readJson(request, 50)).rejects.toThrow("too large");
    store.set("session", "expired", { did: "old" }, -1);
    expect(store.get("session", "expired")).toBeUndefined();
  });
});
