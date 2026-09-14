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
  selectWorkerProfile,
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
    selectWorkerProfile("anonymous");
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

  it("separates anonymous and account sessions and uploads while sharing published artifacts", async () => {
    const savedAt = new Date().toISOString();
    const record = (owner: string) => ({ id: "session" as const, payload: JSON.stringify({ owner }), savedAt });
    const upload = (owner: string) => ({
      tableName: "private_values", format: "csv" as const,
      bytes: new TextEncoder().encode(`owner\n${owner}\n`).buffer,
      dataset: { id: "user:private_values", title: owner, tableName: "private_values", description: owner, spatial: false, fields: [] },
      updatedAt: new Date().toISOString(),
    });
    const accounts = [`did:plc:${crypto.randomUUID().replaceAll("-", "").slice(0, 24)}`, `did:plc:${crypto.randomUUID().replaceAll("-", "").slice(0, 24)}`];
    await saveStoredWorkspace(record("anonymous"));
    await writeLocalSource(upload("anonymous"));
    await writeArtifact(dataset, new Uint8Array([80, 65, 82, 49]).buffer);
    for (const account of accounts) {
      selectWorkerProfile(account);
      expect(await loadStoredWorkspace("session")).toBeNull();
      expect(await listLocalDatasets()).toEqual([]);
      expect(await readLocalSource("private_values")).toBeUndefined();
      expect((await readArtifact(dataset))?.byteLength).toBe(4);
      await saveStoredWorkspace(record(account));
      await writeLocalSource(upload(account));
    }
    for (const owner of ["anonymous", ...accounts]) {
      selectWorkerProfile(owner);
      expect((await loadStoredWorkspace("session"))).toEqual(record(owner));
      expect((await listLocalDatasets()).map((item) => item.title)).toEqual([owner]);
      expect(new TextDecoder().decode((await readLocalSource("private_values"))!.bytes)).toBe(`owner\n${owner}\n`);
    }
    selectWorkerProfile(accounts[0]!);
    await deleteLocalSource("private_values");
    selectWorkerProfile("anonymous");
    expect((await readLocalSource("private_values"))?.dataset.title).toBe("anonymous");
  });
});
