import "fake-indexeddb/auto";
import { DatasetManifestSchema } from "@chartize/contracts";
import { beforeEach, describe, expect, it } from "vitest";
import { makeBlankDraft } from "../ggsql/serialize";
import { useChartizeWorkspace } from "../workspace/store";
import { WorkspaceSessionSchema } from "../workspace/document";
import {
  adoptAnonymousWorkspace,
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

  const sessionRecord = (id: string, query: string, prompt = "") => ({
    id: "session" as const,
    payload: JSON.stringify({
      version: 1, activeWorkspaceId: id, leftPaneRatio: 0.44, codePaneRatio: 0.56,
      workspaceDocuments: [{ ...useChartizeWorkspace.getInitialState().workspaceDocuments[0]!, id, title: id, query, aiPrompt: prompt }],
    }),
    savedAt: new Date().toISOString(),
  });
  const readSession = async () => WorkspaceSessionSchema.parse(JSON.parse((await loadStoredWorkspace("session") as { payload: string }).payload));

  it("continues the active guest chart and unsent prompt while preserving account work", async () => {
    const account = `did:plc:${crypto.randomUUID()}`;
    const guest = sessionRecord("june-temperatures", "SELECT * FROM chartize:weather", "Explain this heatmap");
    await saveStoredWorkspace(guest);
    selectWorkerProfile(account);
    await saveStoredWorkspace(sessionRecord("existing-chart", "SELECT 42"));
    selectWorkerProfile("anonymous");
    await adoptAnonymousWorkspace(account, guest);
    expect(await loadStoredWorkspace("session")).toEqual(guest);
    await adoptAnonymousWorkspace(account, guest);
    selectWorkerProfile(account);
    const result = await readSession();
    expect(result.activeWorkspaceId).toBe("june-temperatures");
    expect(result.workspaceDocuments).toHaveLength(2);
    expect(result.workspaceDocuments[0]).toMatchObject({ id: "existing-chart", query: "SELECT 42" });
    expect(result.workspaceDocuments[1]).toMatchObject({ query: "SELECT * FROM chartize:weather", aiPrompt: "Explain this heatmap" });
    await expect(adoptAnonymousWorkspace(`did:plc:${crypto.randomUUID()}`, guest)).rejects.toThrow("anonymous profile");
  });

  it("creates the first account session from the guest workspace and keeps colliding uploads separate", async () => {
    const account = `did:plc:${crypto.randomUUID()}`;
    const upload = (value: number) => ({
      tableName: "values", format: "csv" as const, bytes: new TextEncoder().encode(`value\n${value}\n`).buffer,
      dataset: { id: "user:values", tableName: "values", title: "values", description: "values.csv", spatial: false, fields: [] },
      updatedAt: new Date().toISOString(),
    });
    await writeLocalSource(upload(7));
    await writeLocalSource({ ...upload(8), tableName: "unrelated", dataset: { ...upload(8).dataset, id: "user:unrelated", tableName: "unrelated" } });
    const guest = sessionRecord("my-upload", "SELECT * FROM user:values");
    selectWorkerProfile(account);
    await writeLocalSource(upload(99));
    selectWorkerProfile("anonymous");
    await adoptAnonymousWorkspace(account, guest);
    selectWorkerProfile(account);
    const result = await readSession();
    expect(result.activeWorkspaceId).toBe("my-upload");
    expect(result.workspaceDocuments[0]!.query).toMatch(/^SELECT \* FROM "user:values_[a-f0-9]+"$/);
    expect(new TextDecoder().decode((await readLocalSource("values"))!.bytes)).toBe("value\n99\n");
    const copied = (await listLocalDatasets()).find((item) => item.tableName !== "values")!;
    expect(new TextDecoder().decode((await readLocalSource(copied.tableName))!.bytes)).toBe("value\n7\n");
    expect(await readLocalSource("unrelated")).toBeUndefined();
  });

  it("rolls back a failed handoff without losing either profile's work or writing orphan uploads", async () => {
    const account = `did:plc:${crypto.randomUUID()}`;
    const full = JSON.parse(sessionRecord("full", "SELECT 1").payload);
    full.workspaceDocuments = Array.from({ length: 40 }, (_, index) => ({ ...full.workspaceDocuments[0], id: String(index) }));
    full.activeWorkspaceId = "0";
    selectWorkerProfile(account);
    const saved = { id: "session" as const, payload: JSON.stringify(full), savedAt: new Date().toISOString() };
    await saveStoredWorkspace(saved);
    selectWorkerProfile("anonymous");
    await writeLocalSource({ tableName: "values", format: "csv", bytes: new TextEncoder().encode("value\n7\n").buffer,
      dataset: { id: "user:values", tableName: "values", title: "values", description: "", spatial: false, fields: [] }, updatedAt: new Date().toISOString() });
    await expect(adoptAnonymousWorkspace(account, sessionRecord("guest", "SELECT * FROM user:values"))).rejects.toThrow("40 workspaces");
    expect(await readLocalSource("values")).toBeDefined();
    selectWorkerProfile(account);
    expect(await loadStoredWorkspace("session")).toEqual(saved);
    expect(await listLocalDatasets()).toEqual([]);
  });
});
