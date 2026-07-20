import init, { GgsqlContext, initExtensionLoader, installExtension } from "ggsql-wasm";
import type { Feature, FeatureCollection, GeoJsonObject } from "geojson";
import { geojsonToParquet, parseJsonRows, rowsToParquet } from "./parquet";
import { BrowserSqlResultSchema, LocalFormatSchema, type LocalFormat } from "./worker-protocol";

let wasmPromise: ReturnType<typeof init> | undefined;
let spatialiteUrl = "/wasm/mod_spatialite.wasm";
let spatialReady = false;
let spatialPromise: Promise<void> | undefined;
const contexts = new Map<string, GgsqlContext>();
const contextPromises = new Map<string, Promise<GgsqlContext>>();
const registrations = new Map<string, string>();

export function setSpatialiteExtensionUrl(url: string) {
  spatialiteUrl = url;
}

export async function workspaceEngine(workspaceId: string) {
  const existing = contexts.get(workspaceId);
  if (existing) return existing;
  let pending = contextPromises.get(workspaceId);
  if (!pending) {
    pending = (async () => {
      if (!wasmPromise) wasmPromise = init();
      const exports = await wasmPromise;
      initExtensionLoader(exports);
      const engine = new GgsqlContext();
      await engine.register_builtin_datasets();
      contexts.set(workspaceId, engine);
      return engine;
    })();
    contextPromises.set(workspaceId, pending);
  }
  try {
    return await pending;
  } catch (error) {
    contextPromises.delete(workspaceId);
    throw error;
  }
}

async function ensureSpatial(workspaceId: string) {
  if (spatialReady) return;
  if (!spatialPromise) {
    spatialPromise = (async () => {
      await workspaceEngine(workspaceId);
      await installExtension("mod_spatialite", spatialiteUrl);
      spatialReady = true;
    })();
  }
  try {
    await spatialPromise;
  } catch (error) {
    spatialPromise = undefined;
    throw error;
  }
}

function parseGeojson(data: Uint8Array): GeoJsonObject {
  const value = JSON.parse(new TextDecoder().decode(data)) as GeoJsonObject;
  if (!value || typeof value !== "object" || !("type" in value)) throw new Error("Invalid GeoJSON document.");
  return value;
}

async function shapefileToGeojson(data: ArrayBuffer): Promise<GeoJsonObject> {
  const module = await import("shpjs");
  const parse = module.default as unknown as (value: ArrayBuffer) => Promise<GeoJsonObject | GeoJsonObject[]>;
  const result = await parse(data);
  if (!Array.isArray(result)) return result;
  const features = result.flatMap((item) => item.type === "FeatureCollection" ? (item as FeatureCollection).features : [] as Feature[]);
  return { type: "FeatureCollection", features } as GeoJsonObject;
}

function parseTsv(data: Uint8Array) {
  const lines = new TextDecoder().decode(data).split(/\r?\n/).filter(Boolean);
  const headers = lines.shift()?.split("\t") ?? [];
  if (!headers.length) throw new Error("The TSV file has no header row.");
  return lines.map((line) => Object.fromEntries(headers.map((header, index) => [header, line.split("\t")[index] ?? null])));
}

export async function registerWorkspaceSource(
  workspaceId: string,
  name: string,
  formatInput: LocalFormat,
  data: ArrayBuffer,
  version: string,
) {
  const format = LocalFormatSchema.parse(formatInput);
  const registrationKey = `${workspaceId}:${name}`;
  if (registrations.get(registrationKey) === version) return;
  const engine = await workspaceEngine(workspaceId);
  if (registrations.has(registrationKey)) engine.unregister(name);
  const bytes = new Uint8Array(data);
  if (format === "csv") {
    engine.register_csv(name, bytes);
  } else if (format === "tsv") {
    await engine.register_parquet(name, rowsToParquet(parseTsv(bytes)));
  } else if (format === "parquet" || format === "geoparquet") {
    if (format === "geoparquet") await ensureSpatial(workspaceId);
    await engine.register_parquet(name, bytes);
  } else if (format === "json" || format === "ndjson") {
    await engine.register_parquet(name, rowsToParquet(parseJsonRows(bytes, format === "ndjson")));
  } else {
    await ensureSpatial(workspaceId);
    const geojson = format === "shapefile" ? await shapefileToGeojson(data) : parseGeojson(bytes);
    await engine.register_parquet(name, geojsonToParquet(geojson).bytes);
  }
  registrations.set(registrationKey, version);
}

export function quoteWorkspaceIdentifier(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

export async function describeWorkspaceSource(workspaceId: string, name: string) {
  const engine = await workspaceEngine(workspaceId);
  return BrowserSqlResultSchema.parse(JSON.parse(
    engine.execute_sql(`PRAGMA table_info(${quoteWorkspaceIdentifier(name)})`),
  ) as unknown);
}

export async function executeWorkspaceGgsql(workspaceId: string, query: string) {
  const engine = await workspaceEngine(workspaceId);
  return JSON.parse(engine.execute(query)) as unknown;
}

export async function executeWorkspaceSqlRaw(workspaceId: string, query: string) {
  const engine = await workspaceEngine(workspaceId);
  return BrowserSqlResultSchema.parse(JSON.parse(engine.execute_sql(query)) as unknown);
}

export async function listWorkspaceTables(workspaceId: string) {
  return (await workspaceEngine(workspaceId)).list_tables();
}

export function resetWorkspacesContainingSource(name: string) {
  const suffix = `:${name}`;
  const workspaceIds = new Set(
    [...registrations.keys()]
      .filter((key) => key.endsWith(suffix))
      .map((key) => key.slice(0, -suffix.length)),
  );
  for (const workspaceId of workspaceIds) {
    contexts.get(workspaceId)?.free();
    contexts.delete(workspaceId);
    contextPromises.delete(workspaceId);
    for (const key of [...registrations.keys()]) {
      if (key.startsWith(`${workspaceId}:`)) registrations.delete(key);
    }
  }
  return [...workspaceIds];
}

export function releaseWorkspaceEngine(workspaceId: string) {
  contexts.get(workspaceId)?.free();
  contexts.delete(workspaceId);
  contextPromises.delete(workspaceId);
  for (const key of [...registrations.keys()]) {
    if (key.startsWith(`${workspaceId}:`)) registrations.delete(key);
  }
}
