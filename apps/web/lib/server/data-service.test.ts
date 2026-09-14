import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import {
  activeDatasetArtifact,
  assertAdminToken,
  listDatasets,
  publishDataset,
  rollbackDataset,
} from "./data-service";

describe("Next data service", { concurrent: false }, () => {
  let root = "";
  let firstVersion = "";

  beforeAll(async () => {
    root = await mkdtemp(path.join(tmpdir(), "chartize-data-service-"));
    process.env.CHARTIZE_DATA_ROOT = root;
    process.env.ADMIN_TOKEN = "test-admin-token";
    globalThis.chartizeDuckDb = undefined;
    globalThis.chartizeDataWriteQueue = undefined;
  });

  afterAll(async () => {
    const instance = await globalThis.chartizeDuckDb;
    instance?.closeSync();
    globalThis.chartizeDuckDb = undefined;
    globalThis.chartizeDataWriteQueue = undefined;
    await rm(root, { recursive: true, force: true });
    delete process.env.CHARTIZE_DATA_ROOT;
    delete process.env.ADMIN_TOKEN;
  });

  it("publishes an uncompressed, version-pinned Parquet artifact", async () => {
    assertAdminToken("test-admin-token");
    expect(() => assertAdminToken("wrong-token")).toThrow("valid x-admin-token");

    const form = new FormData();
    form.set("file", new File(["place,value\nNorth,10\nSouth,20\n"], "places.csv", { type: "text/csv" }));
    form.set("title", "Places");
    form.set("slug", "places");
    form.set("description", "A tiny import fixture.");
    const manifest = await publishDataset(form);
    firstVersion = manifest.version;

    expect(manifest).toMatchObject({ slug: "places", rowCount: 2, spatial: false });
    expect((await listDatasets()).map((dataset) => dataset.slug)).toEqual(["places"]);
    const artifact = await activeDatasetArtifact("places", manifest.version);
    expect((await readFile(artifact.path)).subarray(0, 4).toString()).toBe("PAR1");
    await expect(activeDatasetArtifact("places", "stale")).rejects.toThrow("not active");
  });

  it("keeps prior versions available for authenticated rollback", async () => {
    const form = new FormData();
    form.set("file", new File(["place,value\nWest,30\n"], "places.csv", { type: "text/csv" }));
    form.set("title", "Places");
    form.set("slug", "places");
    const second = await publishDataset(form);
    expect(second.version).not.toBe(firstVersion);
    expect(second.rowCount).toBe(1);

    const rolledBack = await rollbackDataset("places");
    expect(rolledBack.version).toBe(firstVersion);
    expect(rolledBack.rowCount).toBe(2);
  });
});
