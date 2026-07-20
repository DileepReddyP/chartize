import {
  DatasetArtifactHeadersSchema,
  DatasetArtifactRequestSchema,
  DatasetManifestSchema,
  type DatasetManifest,
} from "@chartize/contracts";
import { resolveNamespacedSources, sourcesFromQuery } from "../ggsql/query-context";
import {
  artifactKey,
  deleteLocalSource,
  listLocalDatasets,
  readArtifact,
  readCatalog,
  readLocalSource,
  writeArtifact,
  writeCatalog,
  writeLocalSource,
} from "./worker-database";
import { fetchWithDeadline } from "./worker-network";
import {
  describeWorkspaceSource,
  listWorkspaceTables,
  registerWorkspaceSource,
  releaseWorkspaceEngine,
  resetWorkspacesContainingSource,
} from "./workspace-engine";
import {
  BrowserLocalDatasetSchema,
  LocalFormatSchema,
  type BrowserEngineProgress,
  type LocalWorkerRequest,
} from "./worker-protocol";

const CATALOG_URL = "/engine/api/catalog";
const FETCH_TIMEOUT_MS = 60_000;

export type WorkerProgressEmitter = (id: string, progress: BrowserEngineProgress) => void;

let catalog: DatasetManifest[] | undefined;
let catalogPromise: Promise<DatasetManifest[]> | undefined;
let catalogRefreshPromise: Promise<DatasetManifest[]> | undefined;
const artifactLoads = new Map<string, Promise<ArrayBuffer>>();
const registeredSources = new Map<string, string>();
const sourceLoads = new Map<string, Promise<string>>();

function internalTableName(namespace: "chartize" | "user", name: string) {
  return `__${namespace}_${name.replaceAll(/[^a-z0-9_]+/gi, "_")}`;
}

export async function loadWorkerCatalog(id: string, emit: WorkerProgressEmitter) {
  if (catalog) return catalog;
  if (!catalogPromise) {
    catalogPromise = (async () => {
      const local = await readCatalog();
      if (local) {
        catalog = DatasetManifestSchema.array().parse(local);
        return catalog;
      }
      emit(id, { phase: "catalog", message: "loading sources…" });
      const response = await fetchWithDeadline(CATALOG_URL, { headers: { accept: "application/json" } }, FETCH_TIMEOUT_MS);
      if (!response.ok) throw new Error(`The source catalog could not be loaded (${response.status}).`);
      const datasets = DatasetManifestSchema.array().parse(await response.json());
      await writeCatalog(datasets);
      catalog = datasets;
      return datasets;
    })();
  }
  try {
    return await catalogPromise;
  } catch (error) {
    catalogPromise = undefined;
    throw error;
  }
}

async function refreshWorkerCatalog(id: string, emit: WorkerProgressEmitter) {
  if (!catalogRefreshPromise) {
    catalogRefreshPromise = (async () => {
      emit(id, { phase: "catalog", message: "checking for this source…" });
      const response = await fetchWithDeadline(CATALOG_URL, {
        cache: "no-store",
        headers: { accept: "application/json" },
      }, FETCH_TIMEOUT_MS);
      if (!response.ok) throw new Error(`The source catalog could not be refreshed (${response.status}).`);
      const datasets = DatasetManifestSchema.array().parse(await response.json());
      await writeCatalog(datasets);
      catalog = datasets;
      return datasets;
    })();
  }
  try {
    return await catalogRefreshPromise;
  } finally {
    catalogRefreshPromise = undefined;
  }
}

export function datasetParquetUrl(dataset: DatasetManifest) {
  const request = DatasetArtifactRequestSchema.parse({ slug: dataset.slug, version: dataset.version });
  return `/engine/api/datasets/${encodeURIComponent(request.slug)}/parquet?${new URLSearchParams({ version: request.version })}`;
}

async function artifactBytes(dataset: DatasetManifest, id: string, emit: WorkerProgressEmitter) {
  const key = artifactKey(dataset);
  const existing = artifactLoads.get(key);
  if (existing) return existing;
  const operation = (async () => {
    emit(id, { phase: "loading", message: "preparing data…", source: `chartize:${dataset.slug}` });
    const local = await readArtifact(dataset);
    if (local) return local.bytes;

    emit(id, { phase: "downloading", message: "loading data…", source: `chartize:${dataset.slug}` });
    const response = await fetchWithDeadline(datasetParquetUrl(dataset), {
      headers: { accept: "application/vnd.apache.parquet" },
    }, FETCH_TIMEOUT_MS);
    if (!response.ok) {
      let message = `Dataset download failed with ${response.status}.`;
      try {
        const body: unknown = await response.json();
        if (typeof body === "object" && body && "error" in body) message = String(body.error);
      } catch { /* A proxy may return a non-JSON error. */ }
      throw new Error(message);
    }
    const headers = DatasetArtifactHeadersSchema.parse({
      contentType: response.headers.get("content-type"),
      etag: response.headers.get("etag"),
      contentLength: Number(response.headers.get("content-length")),
    });
    if (headers.etag !== `"${dataset.version}"`) {
      throw new Error("The dataset response version does not match the active catalog version.");
    }
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength !== headers.contentLength) throw new Error("The dataset response was incomplete.");
    await writeArtifact(dataset, bytes);
    return bytes;
  })();
  artifactLoads.set(key, operation);
  try {
    return await operation;
  } finally {
    artifactLoads.delete(key);
  }
}

async function ensureChartizeSource(workspaceId: string, name: string, id: string, emit: WorkerProgressEmitter) {
  const loadKey = `${workspaceId}:chartize:${name}`;
  const existing = sourceLoads.get(loadKey);
  if (existing) return existing;
  const operation = (async () => {
    let datasets = await loadWorkerCatalog(id, emit);
    let dataset = datasets.find((candidate) => candidate.slug === name || candidate.tableName === name);
    if (!dataset) {
      datasets = await refreshWorkerCatalog(id, emit);
      dataset = datasets.find((candidate) => candidate.slug === name || candidate.tableName === name);
    }
    if (!dataset) throw new Error(`The source catalog does not contain chartize:${name}.`);
    const internalName = internalTableName("chartize", dataset.tableName);
    const registrationKey = `${workspaceId}:chartize:${dataset.tableName}`;
    if (registeredSources.get(registrationKey) !== dataset.version) {
      const bytes = await artifactBytes(dataset, id, emit);
      emit(id, { phase: "registering", message: "preparing data…", source: `chartize:${dataset.slug}` });
      await registerWorkspaceSource(workspaceId, internalName, dataset.spatial ? "geoparquet" : "parquet", bytes, dataset.version);
      registeredSources.set(registrationKey, dataset.version);
    }
    return internalName;
  })();
  sourceLoads.set(loadKey, operation);
  try {
    return await operation;
  } finally {
    sourceLoads.delete(loadKey);
  }
}

async function ensureUserSource(workspaceId: string, name: string, id: string, emit: WorkerProgressEmitter) {
  const loadKey = `${workspaceId}:user:${name}`;
  const existing = sourceLoads.get(loadKey);
  if (existing) return existing;
  const operation = (async () => {
    const record = await readLocalSource(name);
    if (!record) throw new Error(`The browser does not contain user:${name}. Import that source first.`);
    const internalName = internalTableName("user", record.tableName);
    const registrationKey = `${workspaceId}:user:${record.tableName}`;
    if (registeredSources.get(registrationKey) !== record.updatedAt) {
      emit(id, { phase: "registering", message: "preparing data…", source: `user:${record.tableName}` });
      await registerWorkspaceSource(workspaceId, internalName, record.format, record.bytes, record.updatedAt);
      registeredSources.set(registrationKey, record.updatedAt);
    }
    return internalName;
  })();
  sourceLoads.set(loadKey, operation);
  try {
    return await operation;
  } finally {
    sourceLoads.delete(loadKey);
  }
}

export async function prepareWorkerQuery(workspaceId: string, query: string, id: string, emit: WorkerProgressEmitter) {
  const resolved = new Map<string, string>();
  for (const source of sourcesFromQuery(query)) {
    if (source.startsWith("chartize:")) {
      const name = source.slice("chartize:".length);
      resolved.set(source, await ensureChartizeSource(workspaceId, name, id, emit));
    } else if (source.startsWith("user:")) {
      const name = source.slice("user:".length);
      resolved.set(source, await ensureUserSource(workspaceId, name, id, emit));
    }
  }
  return resolveNamespacedSources(query, (namespace, name) => resolved.get(`${namespace}:${name}`));
}

function semanticType(name: string, dataType: string) {
  if (name === "geometry") return "geometry" as const;
  if (/date|time|year/i.test(name) || /date|time/i.test(dataType)) return "temporal" as const;
  if (/id$|fips|geoid/i.test(name)) return "identifier" as const;
  if (/int|double|float|decimal|number|real/i.test(dataType)) return "measure" as const;
  return "dimension" as const;
}

export async function registerWorkerLocalSource(
  request: Extract<LocalWorkerRequest, { type: "register" }>,
  emit: WorkerProgressEmitter,
) {
  const format = LocalFormatSchema.parse(request.format);
  const updatedAt = new Date().toISOString();
  const internalName = internalTableName("user", request.name);
  emit(request.id, { phase: "registering", message: "preparing data…", source: `user:${request.name}` });
  await registerWorkspaceSource(request.workspaceId, internalName, format, request.data, updatedAt);
  const info = await describeWorkspaceSource(request.workspaceId, internalName);
  const nameIndex = info.columns.indexOf("name");
  const typeIndex = info.columns.indexOf("type");
  const fields = info.rows.map((row) => {
    const name = row[nameIndex] ?? row[1] ?? "field";
    const dataType = row[typeIndex] ?? row[2] ?? "VARCHAR";
    return { name, dataType, nullable: true, semanticType: semanticType(name, dataType) };
  });
  const dataset = BrowserLocalDatasetSchema.parse({
    id: `user:${request.name}`,
    title: request.file.name.replace(/\.[^.]+$/, "").replaceAll(/[_-]+/g, " "),
    tableName: request.name,
    description: `${request.file.name} · ${(request.file.size / 1024).toFixed(1)} KB · private to this browser`,
    spatial: format === "geojson" || format === "shapefile" || format === "geoparquet",
    fields,
    fileName: request.file.name,
  });
  await writeLocalSource({ tableName: request.name, format, bytes: request.data, dataset, updatedAt });
  registeredSources.set(`${request.workspaceId}:user:${request.name}`, updatedAt);
  return { dataset, tables: await listWorkspaceTables(request.workspaceId) };
}

export async function removeWorkerLocalSource(name: string) {
  await deleteLocalSource(name);
  resetWorkspacesContainingSource(internalTableName("user", name));
  for (const key of [...registeredSources.keys()]) {
    if (key.endsWith(`:user:${name}`)) registeredSources.delete(key);
  }
  return { localDatasets: await listLocalDatasets() };
}

export async function describeWorkerSource(workspaceId: string, name: string, id: string, emit: WorkerProgressEmitter) {
  const tableName = name.startsWith("chartize:")
    ? await ensureChartizeSource(workspaceId, name.slice("chartize:".length), id, emit)
    : name.startsWith("user:")
      ? await ensureUserSource(workspaceId, name.slice("user:".length), id, emit)
      : name;
  return describeWorkspaceSource(workspaceId, tableName);
}

export async function prefetchWorkerSources(workspaceId: string, sources: string[], id: string, emit: WorkerProgressEmitter) {
  for (const source of sources) {
    if (source.startsWith("chartize:")) await ensureChartizeSource(workspaceId, source.slice("chartize:".length), id, emit);
  }
}

export function releaseWorkerWorkspace(workspaceId: string) {
  releaseWorkspaceEngine(workspaceId);
  for (const key of [...registeredSources.keys()]) {
    if (key.startsWith(`${workspaceId}:`)) registeredSources.delete(key);
  }
  for (const key of [...sourceLoads.keys()]) {
    if (key.startsWith(`${workspaceId}:`)) sourceLoads.delete(key);
  }
}

export function resetWorkerSourceRegistryForTests() {
  catalog = undefined;
  catalogPromise = undefined;
  catalogRefreshPromise = undefined;
  artifactLoads.clear();
  registeredSources.clear();
  sourceLoads.clear();
}
