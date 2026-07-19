/// <reference lib="webworker" />

import init, { GgsqlContext, initExtensionLoader, installExtension } from "ggsql-wasm";
import type { Feature, FeatureCollection, GeoJsonObject } from "geojson";
import { geojsonToParquet, parseJsonRows, rowsToParquet } from "@/lib/local/parquet";
import type { LocalWorkerRequest, LocalWorkerResponse } from "@/lib/local/worker-protocol";
import { assertReadOnlyGgsql } from "@/lib/ggsql/query-context";

let context: GgsqlContext | undefined;
let spatialiteUrl = "https://ggsql.org/wasm/mod_spatialite.wasm";
let spatialReady = false;

async function ensureContext() {
  if (context) return context;
  const exports = await init();
  initExtensionLoader(exports);
  context = new GgsqlContext();
  await context.register_builtin_datasets();
  return context;
}

async function ensureSpatial() {
  if (spatialReady) return;
  await ensureContext();
  await installExtension("mod_spatialite", spatialiteUrl);
  spatialReady = true;
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

function quoteIdentifier(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

async function handle(request: LocalWorkerRequest): Promise<unknown> {
  const engine = await ensureContext();
  switch (request.type) {
    case "init":
      spatialiteUrl = request.spatialiteUrl;
      return { tables: engine.list_tables() };
    case "register": {
      const bytes = new Uint8Array(request.data);
      if (request.format === "csv") {
        engine.register_csv(request.name, bytes);
      } else if (request.format === "tsv") {
        await engine.register_parquet(request.name, rowsToParquet(parseTsv(bytes)));
      } else if (request.format === "parquet" || request.format === "geoparquet") {
        if (request.format === "geoparquet") await ensureSpatial();
        await engine.register_parquet(request.name, bytes);
      } else if (request.format === "json" || request.format === "ndjson") {
        await engine.register_parquet(request.name, rowsToParquet(parseJsonRows(bytes, request.format === "ndjson")));
      } else {
        await ensureSpatial();
        const geojson = request.format === "shapefile" ? await shapefileToGeojson(request.data) : parseGeojson(bytes);
        const converted = geojsonToParquet(geojson);
        await engine.register_parquet(request.name, converted.bytes);
      }
      return { name: request.name, tables: engine.list_tables() };
    }
    case "run":
      assertReadOnlyGgsql(request.query);
      return JSON.parse(engine.execute(request.query)) as unknown;
    case "sql":
      assertReadOnlyGgsql(request.query);
      return JSON.parse(engine.execute_sql(request.query)) as unknown;
    case "describe":
      return JSON.parse(engine.execute_sql(`PRAGMA table_info(${quoteIdentifier(request.name)})`)) as unknown;
    case "tables":
      return engine.list_tables();
    case "remove":
      engine.unregister(request.name);
      return engine.list_tables();
  }
}

self.onmessage = async (event: MessageEvent<LocalWorkerRequest>) => {
  const request = event.data;
  let response: LocalWorkerResponse;
  try {
    response = { id: request.id, ok: true, data: await handle(request) };
  } catch (error) {
    response = { id: request.id, ok: false, error: error instanceof Error ? error.message : String(error) };
  }
  self.postMessage(response);
};
