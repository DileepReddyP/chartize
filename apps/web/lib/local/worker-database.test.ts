import "fake-indexeddb/auto";
import { DatasetManifestSchema } from "@chartize/contracts";
import { beforeEach, describe, expect, it } from "vitest";
import { makeBlankDraft } from "../ggsql/serialize";
import {
  deleteLocalSource,
  listLocalDatasets,
  loadStoredWorkspace,
  readArtifact,
  readCatalog,
  readLocalSource,
  saveStoredWorkspace,
  workerDatabase,
  writeArtifact,
  writeCatalog,
  writeLocalSource,
} from "./worker-database";

const dataset = DatasetManifestSchema.parse({
  id: "approval-v1",
  slug: "presidential_approval_average",
  title: "Presidential approval",
  version: "20260720010736",
  tableName: "presidential_approval_average",
  publishedAt: "2026-07-20T01:07:36Z",
  fields: [],
});

describe("worker-owned browser database", () => {
  beforeEach(async () => {
    await workerDatabase.delete();
    await workerDatabase.open();
  });

  it("persists the catalog and complete canonical Parquet bytes", async () => {
    const bytes = new Uint8Array([80, 65, 82, 49]).buffer;
    await writeCatalog([dataset]);
    await writeArtifact(dataset, bytes);

    expect(await readCatalog()).toEqual([dataset]);
    const artifact = await readArtifact(dataset);
    expect([...new Uint8Array(artifact!.bytes)]).toEqual([80, 65, 82, 49]);
    expect(artifact?.byteLength).toBe(4);
  });

  it("owns the full local-upload lifecycle independently of React state", async () => {
    const local = {
      id: "user:tiny_poll",
      title: "tiny poll",
      tableName: "tiny_poll",
      description: "tiny_poll.csv · private to this browser",
      spatial: false,
      fields: [{ name: "value", dataType: "INTEGER", nullable: true, semanticType: "measure" as const }],
      fileName: "tiny_poll.csv",
    };
    await writeLocalSource({
      tableName: local.tableName,
      format: "csv",
      bytes: new TextEncoder().encode("value\n1\n2\n").buffer,
      dataset: local,
      updatedAt: "2026-07-20T01:00:00Z",
    });

    expect((await readLocalSource("tiny_poll"))?.dataset).toEqual(local);
    expect(await listLocalDatasets()).toEqual([local]);
    await deleteLocalSource("tiny_poll");
    expect(await listLocalDatasets()).toEqual([]);
  });

  it("stores workspace documents without duplicating source bytes", async () => {
    const workspace = {
      id: "current",
      title: "local chart",
      query: "SELECT * FROM user:tiny_poll",
      draft: makeBlankDraft(),
      savedAt: "2026-07-20T01:00:00Z",
    };
    await saveStoredWorkspace(workspace);
    expect(await loadStoredWorkspace("current")).toEqual(workspace);
  });
});
