import "fake-indexeddb/auto";
import { readFile } from "node:fs/promises";
import { DatasetManifestSchema } from "@chartize/contracts";
import init from "ggsql-wasm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { rowsToParquet } from "./parquet";
import { workerDatabase, writeCatalog } from "./worker-database";
import { executeWorkspaceSqlRaw } from "./workspace-engine";
import { prepareWorkerQuery, resetWorkerSourceRegistryForTests } from "./worker-source-registry";

const dataset = DatasetManifestSchema.parse({
  id: "tiny-v1",
  slug: "tiny_values",
  title: "Tiny values",
  version: "20260720040000",
  tableName: "tiny_values",
  publishedAt: "2026-07-20T04:00:00Z",
  fields: [{ name: "value", dataType: "BIGINT", nullable: false, semanticType: "measure" }],
});

describe("worker source hydration", () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    resetWorkerSourceRegistryForTests();
    await workerDatabase.delete();
    await workerDatabase.open();
    await writeCatalog([dataset]);
    const wasm = await readFile(new URL("../../node_modules/ggsql-wasm/ggsql_wasm_bg.wasm", import.meta.url));
    await init({ module_or_path: wasm });
  });

  it("downloads one complete chartize source, persists it, then hydrates another workspace locally", async () => {
    const bytes = rowsToParquet([{ value: 1 }, { value: 2 }]);
    const fetcher = vi.fn(async () => new Response(Uint8Array.from(bytes).buffer, { headers: {
      "content-type": "application/vnd.apache.parquet",
      "content-length": String(bytes.byteLength),
      etag: `"${dataset.version}"`,
    } }));
    vi.stubGlobal("fetch", fetcher);
    const emit = vi.fn();

    const firstQuery = await prepareWorkerQuery("cold-workspace", "SELECT value FROM chartize:tiny_values ORDER BY value", "cold", emit);
    const first = await executeWorkspaceSqlRaw("cold-workspace", firstQuery);
    const secondQuery = await prepareWorkerQuery("warm-workspace", "SELECT value FROM chartize:tiny_values ORDER BY value", "warm", emit);
    const second = await executeWorkspaceSqlRaw("warm-workspace", secondQuery);

    expect(first.rows).toEqual([["1"], ["2"]]);
    expect(second.rows).toEqual(first.rows);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(firstQuery).not.toContain("chartize:");
    expect(secondQuery).not.toContain("chartize:");
  });
});
