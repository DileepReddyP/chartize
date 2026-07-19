import type { LocalFormat } from "./worker-protocol";

export function detectFormat(file: File): LocalFormat {
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv")) return "csv";
  if (name.endsWith(".tsv")) return "tsv";
  if (name.endsWith(".parquet")) return "parquet";
  if (name.endsWith(".geoparquet")) return "geoparquet";
  if (name.endsWith(".geojson")) return "geojson";
  if (name.endsWith(".ndjson") || name.endsWith(".jsonl")) return "ndjson";
  if (name.endsWith(".zip")) return "shapefile";
  if (name.endsWith(".json")) return "json";
  throw new Error(`Unsupported file type for ${file.name}.`);
}

export function tableNameFromFile(name: string) {
  const base = name.replace(/\.(geo)?json$|\.(csv|tsv|parquet|geoparquet|ndjson|jsonl|zip)$/i, "");
  const safe = base.toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "");
  return safe || `dataset_${Date.now()}`;
}
