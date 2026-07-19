import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("warehouse request cache", () => {
  it("coalesces catalog requests", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{
        id: "approval",
        slug: "approval",
        title: "Approval",
        version: "v1",
        tableName: "approval",
        publishedAt: "2026-01-01T00:00:00Z",
      }],
    });
    vi.stubGlobal("fetch", fetchMock);
    const { fetchWarehouseCatalog } = await import("./warehouse-client");

    const [first, second] = await Promise.all([fetchWarehouseCatalog(), fetchWarehouseCatalog()]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(first).toEqual(second);
    expect(first[0]?.slug).toBe("approval");
  });

  it("reuses a parsed table page with the same dataset version and sort", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ columns: ["value"], rows: [["1"]], totalRows: 1, offset: 0, limit: 100 }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const { fetchWarehousePreview } = await import("./warehouse-client");
    const request = { slug: "approval", version: "v1", offset: 0, sort: { column: "value", direction: "asc" as const } };

    const first = await fetchWarehousePreview(request);
    const second = await fetchWarehousePreview(request);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(second).toEqual(first);
    expect(fetchMock).toHaveBeenCalledWith("/engine/api/datasets/approval/preview?limit=100&offset=0&sort=value&direction=asc");
  });
});
