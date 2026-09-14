import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DatasetManifestSchema } from "@chartize/contracts";

const { jar } = vi.hoisted(() => ({ jar: new Map<string, string>() }));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({
  get: (name: string) => jar.has(name) ? { value: jar.get(name) } : undefined,
  set: (name: string, value: string) => { jar.set(name, value); },
}) }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`redirect:${url}`); } }));
vi.mock("./public-profile", () => ({ withPublicProfile: async (user: unknown) => user }));
vi.mock("../server/data-service", async (original) => ({
  ...await original<typeof import("../server/data-service")>(),
  listDatasets: vi.fn(), publishDataset: vi.fn(), rollbackDataset: vi.fn(),
}));

import { AuthStore } from "./store";
import { createChatSession, logout } from "./session";
import { requireAdmin, withAdminRole } from "./admin";
import { GET as session } from "@/app/api/auth/[action]/route";
import AdminPage from "@/app/admin/page";
import { getAdminCatalog, publishAdminDataset, rollbackAdminDataset } from "@/app/admin/actions";
import { POST as importRoute } from "@/app/engine/api/admin/imports/route";
import { POST as rollbackRoute } from "@/app/engine/api/admin/datasets/[slug]/rollback/route";
import { assertAdminRequest, listDatasets, publishDataset, rollbackDataset } from "../server/data-service";

const owner = { did: "did:plc:aaaaaaaaaaaaaaaaaaaaaaaa", handle: "admin.example" };
const dataset = DatasetManifestSchema.parse({ id: "fixture", slug: "fixture", title: "Fixture", version: "1", tableName: "fixture", publishedAt: "2026-09-14T00:00:00Z" });
const request = (origin = "http://localhost:3000") => new Request("http://localhost:3000/engine/api/admin/imports", { method: "POST", headers: { origin }, body: new FormData() });

describe("database-backed admin access", () => {
  let store: AuthStore;
  const grant = (provider = "atproto", subject = owner.did) => store.db.prepare("INSERT INTO admin_accounts (provider, subject) VALUES (?, ?)").run(provider, subject);
  beforeEach(() => {
    jar.clear();
    vi.clearAllMocks();
    vi.stubEnv("CHARTIZE_PUBLIC_URL", "http://localhost:3000");
    store = new AuthStore(new DatabaseSync(":memory:"));
    vi.stubGlobal("chartizeAuthStore", store);
    vi.mocked(listDatasets).mockResolvedValue([dataset]);
    vi.mocked(publishDataset).mockResolvedValue(dataset);
    vi.mocked(rollbackDataset).mockResolvedValue(dataset);
  });
  afterEach(() => { store.db.close(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

  it("reads provider/DID membership on existing sessions and immediately reflects grants and revocations", async () => {
    await createChatSession(owner);
    const profile = async () => (await (await session(new Request("http://localhost:3000/api/auth/session"), { params: Promise.resolve({ action: "session" }) })).json()).user;
    expect(await profile()).toMatchObject({ isAdmin: false });
    grant("another-provider");
    expect(await profile()).toMatchObject({ isAdmin: false });
    grant();
    expect(await profile()).toMatchObject({ isAdmin: true });
    expect(withAdminRole({ ...owner, handle: "new-handle.example" })?.isAdmin).toBe(true);
    expect(new AuthStore(store.db).isAdmin("atproto", owner.did)).toBe(true);
    store.db.prepare("DELETE FROM admin_accounts WHERE provider = ? AND subject = ?").run("atproto", owner.did);
    expect(await profile()).toMatchObject({ isAdmin: false });
    expect(new AuthStore(store.db).isAdmin("atproto", owner.did)).toBe(false);
    await expect(requireAdmin()).rejects.toMatchObject({ status: 403 });
  });

  it("protects the page and every server action from anonymous and non-admin callers", async () => {
    grant();
    for (const user of [null, { did: "did:plc:another", handle: owner.handle, isAdmin: true }]) {
      jar.clear();
      if (user) await createChatSession(user);
      await expect(AdminPage()).rejects.toThrow(/^redirect:\/$/);
      await expect(getAdminCatalog()).rejects.toMatchObject({ status: user ? 403 : 401 });
      await expect(publishAdminDataset(new FormData())).rejects.toMatchObject({ status: user ? 403 : 401 });
      await expect(rollbackAdminDataset("fixture")).rejects.toMatchObject({ status: user ? 403 : 401 });
    }
    expect(listDatasets).not.toHaveBeenCalled();
    expect(publishDataset).not.toHaveBeenCalled();
    expect(rollbackDataset).not.toHaveBeenCalled();
  });

  it("allows an admin's console actions and blocks the same session after logout", async () => {
    grant();
    await createChatSession(owner);
    expect(await AdminPage()).toBeTruthy();
    expect(await getAdminCatalog()).toEqual([dataset]);
    expect(await publishAdminDataset(new FormData())).toEqual(dataset);
    expect(await rollbackAdminDataset("fixture")).toEqual(dataset);
    expect(publishDataset).toHaveBeenCalledTimes(1);
    expect(rollbackDataset).toHaveBeenCalledWith("fixture");
    await logout();
    await expect(requireAdmin()).rejects.toMatchObject({ status: 401 });
  });

  it("requires the admin session and same origin on both HTTP mutation routes", async () => {
    grant();
    const rollback = (req: Request) => rollbackRoute(req, { params: Promise.resolve({ slug: "fixture" }) });
    for (const route of [importRoute, rollback]) {
      jar.clear();
      expect((await route(request())).status).toBe(401);
      await createChatSession({ did: "did:plc:another", handle: owner.handle });
      const forged = request();
      forged.headers.set("x-chartize-profile", owner.did);
      expect((await route(forged)).status).toBe(403);
      await createChatSession(owner);
      expect((await route(request("https://another-site.example"))).status).toBe(403);
      const missingOrigin = request();
      missingOrigin.headers.delete("origin");
      expect((await route(missingOrigin)).status).toBe(403);
      expect((await route(request())).status).toBe(200);
    }
    expect(publishDataset).toHaveBeenCalledTimes(1);
    expect(rollbackDataset).toHaveBeenCalledTimes(1);
  });

  it("keeps explicit dataset-seeding tokens separate from browser admin membership", async () => {
    vi.stubEnv("ADMIN_TOKEN", "test-seeding-token");
    const seed = request();
    seed.headers.delete("origin");
    seed.headers.set("x-admin-token", "wrong-token");
    await expect(assertAdminRequest(seed)).rejects.toMatchObject({ status: 401 });
    seed.headers.set("x-admin-token", "test-seeding-token");
    await expect(assertAdminRequest(seed)).resolves.toBeUndefined();
    await expect(requireAdmin()).rejects.toMatchObject({ status: 401 });
  });
});
