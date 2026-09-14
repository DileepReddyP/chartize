import { DatasetManifestSchema, type DatasetManifest } from "@chartize/contracts";
import Dexie, { type Table } from "dexie";
import { z } from "zod";
import { resolveNamespacedSources, sourcesFromQuery } from "../ggsql/query-context";
import { WorkspaceSessionSchema } from "../workspace/document";
import {
  BrowserLocalDatasetSchema,
  BrowserProfileIdSchema,
  BrowserStoredWorkspaceSchema,
  BrowserWorkspaceSessionRecordSchema,
  LocalFormatSchema,
  type BrowserLocalDataset,
  type BrowserStoredWorkspace,
  type LocalFormat,
} from "./worker-protocol";

interface CatalogRecord {
  id: "active";
  datasets: DatasetManifest[];
  storedAt: string;
}

const CatalogRecordSchema = z.object({
  id: z.literal("active"),
  datasets: z.array(DatasetManifestSchema),
  storedAt: z.string(),
});

export interface DatasetArtifactRecord {
  key: string;
  slug: string;
  version: string;
  tableName: string;
  spatial: boolean;
  bytes: ArrayBuffer;
  byteLength: number;
  storedAt: string;
}

const DatasetArtifactRecordSchema = z.object({
  key: z.string().min(1),
  slug: z.string().min(1),
  version: z.string().min(1),
  tableName: z.string().min(1),
  spatial: z.boolean(),
  bytes: z.instanceof(ArrayBuffer),
  byteLength: z.number().int().positive(),
  storedAt: z.string(),
});

export interface LocalSourceRecord {
  tableName: string;
  format: LocalFormat;
  bytes: ArrayBuffer;
  dataset: BrowserLocalDataset;
  updatedAt: string;
}

class ChartizeWorkerDatabase extends Dexie {
  catalog!: Table<CatalogRecord, "active">;
  artifacts!: Table<DatasetArtifactRecord, string>;
  localSources!: Table<LocalSourceRecord, string>;
  workspaces!: Table<BrowserStoredWorkspace, string>;

  constructor(name = "chartize-local") {
    super(name);
    this.version(1).stores({
      catalog: "id, storedAt",
      artifacts: "key, [slug+version], slug, version, storedAt",
      localSources: "tableName, updatedAt",
      workspaces: "id, savedAt",
    });
  }
}

export const workerDatabase = new ChartizeWorkerDatabase();
let profileDatabase = workerDatabase;

/** Selects the profile's private workspace and upload collection. */
export function selectWorkerProfile(id: string) {
  const profileId = BrowserProfileIdSchema.parse(id);
  const name = profileId === "anonymous" ? "chartize-local" : `chartize-profile:${encodeURIComponent(profileId)}`;
  if (profileDatabase.name === name) return;
  if (profileDatabase !== workerDatabase) profileDatabase.close();
  profileDatabase = name === workerDatabase.name ? workerDatabase : new ChartizeWorkerDatabase(name);
}

export function artifactKey(dataset: Pick<DatasetManifest, "slug" | "version">) {
  return `${dataset.slug}:${dataset.version}`;
}

export async function readCatalog() {
  const record = await workerDatabase.catalog.get("active");
  return record ? CatalogRecordSchema.parse(record).datasets : undefined;
}

export async function writeCatalog(datasets: DatasetManifest[]) {
  await workerDatabase.catalog.put({ id: "active", datasets, storedAt: new Date().toISOString() });
}

export function readArtifact(dataset: Pick<DatasetManifest, "slug" | "version">) {
  return workerDatabase.artifacts.get(artifactKey(dataset)).then((record) => (
    record ? DatasetArtifactRecordSchema.parse(record) : undefined
  ));
}

export async function writeArtifact(dataset: DatasetManifest, bytes: ArrayBuffer) {
  await workerDatabase.artifacts.put(DatasetArtifactRecordSchema.parse({
    key: artifactKey(dataset),
    slug: dataset.slug,
    version: dataset.version,
    tableName: dataset.tableName,
    spatial: dataset.spatial,
    bytes,
    byteLength: bytes.byteLength,
    storedAt: new Date().toISOString(),
  }));
}

export async function writeLocalSource(record: LocalSourceRecord) {
  const parsed: LocalSourceRecord = {
    ...record,
    format: LocalFormatSchema.parse(record.format),
    dataset: BrowserLocalDatasetSchema.parse(record.dataset),
  };
  await profileDatabase.localSources.put(parsed);
}

export async function readLocalSource(tableName: string) {
  const record = await profileDatabase.localSources.get(tableName);
  return record ? { ...record, dataset: BrowserLocalDatasetSchema.parse(record.dataset) } : undefined;
}

export function deleteLocalSource(tableName: string) {
  return profileDatabase.localSources.delete(tableName);
}

export async function listLocalDatasets() {
  const records = await profileDatabase.localSources.orderBy("updatedAt").reverse().toArray();
  return records.map((record) => BrowserLocalDatasetSchema.parse(record.dataset));
}

export async function saveStoredWorkspace(workspace: BrowserStoredWorkspace) {
  await profileDatabase.workspaces.put(BrowserStoredWorkspaceSchema.parse(workspace));
}

export async function loadStoredWorkspace(id: string) {
  const workspace = await profileDatabase.workspaces.get(id);
  return workspace ? BrowserStoredWorkspaceSchema.parse(workspace) : null;
}

/** Copies the active guest workspace and its uploads into the signed-in profile. */
export async function adoptAnonymousWorkspace(profileId: string, record: BrowserStoredWorkspace) {
  const targetId = BrowserProfileIdSchema.parse(profileId);
  if (targetId === "anonymous" || profileDatabase !== workerDatabase) {
    throw new Error("A workspace can be carried over only when signing in from the anonymous profile.");
  }
  const incoming = WorkspaceSessionSchema.parse(JSON.parse(BrowserWorkspaceSessionRecordSchema.parse(record).payload));
  const document = incoming.workspaceDocuments.find((item) => item.id === incoming.activeWorkspaceId)!;
  const sources = new Set([
    document.draft.source, document.dockSource, ...sourcesFromQuery(document.query),
    ...document.draft.joins.map((join) => join.table),
    ...document.workspaceActions.flatMap((action) => sourcesFromQuery(action.sql)),
  ]);
  const uploads = await workerDatabase.localSources.where("tableName")
    .anyOf([...sources].filter((name) => name.startsWith("user:")).map((name) => name.slice(5))).toArray();
  const target = new ChartizeWorkerDatabase(`chartize-profile:${encodeURIComponent(targetId)}`);
  try {
    await target.transaction("rw", target.workspaces, target.localSources, async () => {
      const existing = await target.workspaces.get("session");
      const session = existing
        ? WorkspaceSessionSchema.parse(JSON.parse(BrowserWorkspaceSessionRecordSchema.parse(existing).payload))
        : { ...incoming, workspaceDocuments: [] };
      const renames = new Map<string, string>();
      for (const upload of uploads) {
        const saved = await target.localSources.get(upload.tableName);
        const bytes = new Uint8Array(upload.bytes);
        if (saved && saved.format === upload.format && saved.bytes.byteLength === upload.bytes.byteLength
          && new Uint8Array(saved.bytes).every((value, index) => value === bytes[index])) continue;
        const tableName = saved ? `${upload.tableName}_${crypto.randomUUID().replaceAll("-", "").slice(0, 8)}` : upload.tableName;
        if (tableName !== upload.tableName) renames.set(`user:${upload.tableName}`, `user:${tableName}`);
        await target.localSources.add({ ...upload, tableName, dataset: { ...upload.dataset, tableName, id: `user:${tableName}` } });
      }
      if (renames.size) {
        const rewrite = (query: string) => resolveNamespacedSources(query, (namespace, name) => renames.get(`${namespace}:${name}`) ?? `${namespace}:${name}`);
        document.query = rewrite(document.query);
        document.workspaceActions = document.workspaceActions.map((action) => ({ ...action, sql: rewrite(action.sql) }));
        document.draft.source = renames.get(document.draft.source) ?? document.draft.source;
        document.draft.joins = document.draft.joins.map((join) => ({ ...join, table: renames.get(join.table) ?? join.table }));
        document.dockSource = renames.get(document.dockSource) ?? document.dockSource;
      }
      const duplicate = session.workspaceDocuments.find((item) => JSON.stringify(item) === JSON.stringify(document));
      if (duplicate) {
        session.activeWorkspaceId = duplicate.id;
      } else {
        if (session.workspaceDocuments.length >= 40) throw new Error("This account has 40 workspaces. Close one before carrying this workspace over.");
        if (session.workspaceDocuments.some((item) => item.id === document.id)) document.id = `workspace-${crypto.randomUUID()}`;
        session.workspaceDocuments.push(document);
        session.activeWorkspaceId = document.id;
      }
      await target.workspaces.put(BrowserWorkspaceSessionRecordSchema.parse({
        id: "session", payload: JSON.stringify(WorkspaceSessionSchema.parse(session)), savedAt: new Date().toISOString(),
      }));
    });
  } finally {
    target.close();
  }
}
