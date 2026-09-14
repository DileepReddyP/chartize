import { DatasetManifestSchema, type DatasetManifest } from "@chartize/contracts";
import Dexie, { type Table } from "dexie";
import { z } from "zod";
import {
  BrowserLocalDatasetSchema,
  BrowserProfileIdSchema,
  BrowserStoredWorkspaceSchema,
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
